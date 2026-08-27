// ---------------------------------------------------------------------------
// The circuit breaker in lib/upstream.ts.
//
// It exists because `retryOn: [403]` with two retries makes every refusal cost
// three requests, at the exact moment the host is telling us to stop. A 25-reader
// load rehearsal drew 1,470 refusals from The Met against ~3,181 requests, and
// CLAUDE.md §4 records that repeated tripping shrinks their budget for a day.
//
// So the property that actually matters here is not "it opens" — it is **that an
// open circuit makes NO network call at all**. A breaker that still fetches is
// worse than none, because it looks like protection. Every test below that
// touches the open state asserts on the fetch mock's call count, not just on the
// thrown error.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  makeGate,
  makeBreaker,
  fetchJson,
  isCircuitOpen,
  CircuitOpenError,
  UpstreamError,
  upstreamStatus,
  GateBudgetError,
  isBudgetExhausted,
} from "./upstream";

function res(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response;
}

const noSleep = async () => {};
const URL_ = "https://collectionapi.metmuseum.org/public/collection/v1/objects/1";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Silence the breaker's own log lines; they are asserted on in the rig, not here. */
function quiet() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
}

describe("makeBreaker state machine", () => {
  it("starts closed and stays closed below the threshold", () => {
    quiet();
    const b = makeBreaker({ threshold: 3 });
    expect(b.state()).toBe("closed");
    b.record(true);
    b.record(true);
    expect(b.state()).toBe("closed");
    expect(() => b.guard(URL_)).not.toThrow();
  });

  it("opens exactly at the threshold", () => {
    quiet();
    const b = makeBreaker({ threshold: 3 });
    b.record(true);
    b.record(true);
    expect(b.state()).toBe("closed");
    b.record(true);
    expect(b.state()).toBe("open");
    expect(() => b.guard(URL_)).toThrow(/circuit open/i);
  });

  it("counts CONSECUTIVE throttles: a success resets the run", () => {
    // A scattering of refusals across a healthy hour is not the failure mode
    // this is for; a run of them is.
    quiet();
    const b = makeBreaker({ threshold: 3 });
    b.record(true);
    b.record(true);
    b.record(false);
    b.record(true);
    b.record(true);
    expect(b.state()).toBe("closed");
  });

  it("goes half-open after the cooldown and lets exactly one probe through", () => {
    quiet();
    let t = 1000;
    const b = makeBreaker({ threshold: 1, cooldownMs: 35_000, now: () => t });
    b.record(true);
    expect(b.state()).toBe("open");

    t += 34_000;
    expect(() => b.guard(URL_)).toThrow(); // still cooling

    t += 2_000; // past the cooldown
    expect(b.state()).toBe("half-open");
    expect(() => b.guard(URL_)).not.toThrow(); // the probe
    // Everyone else still waits, so a queue of callers cannot all probe at once.
    expect(() => b.guard(URL_)).toThrow();
  });

  it("closes when the probe succeeds", () => {
    quiet();
    let t = 0;
    const b = makeBreaker({ threshold: 1, cooldownMs: 100, now: () => t });
    b.record(true);
    t = 200;
    b.guard(URL_); // probe
    b.record(false);
    expect(b.state()).toBe("closed");
    expect(() => b.guard(URL_)).not.toThrow();
  });

  it("re-opens for another full cooldown when the probe fails", () => {
    quiet();
    let t = 0;
    const b = makeBreaker({ threshold: 5, cooldownMs: 100, now: () => t });
    for (let i = 0; i < 5; i++) b.record(true);
    t = 200;
    b.guard(URL_); // probe
    b.record(true); // …and it is still angry
    expect(b.state()).toBe("open");
    t = 250;
    expect(() => b.guard(URL_)).toThrow();
    t = 400;
    expect(b.state()).toBe("half-open");
  });
});

describe("a breaker wired into fetchJson", () => {
  it("stops making requests once open — the whole point", async () => {
    quiet();
    const fetchMock = vi.fn().mockResolvedValue(res(403));
    vi.stubGlobal("fetch", fetchMock);
    const breaker = makeBreaker({ threshold: 2, cooldownMs: 60_000 });

    // Two calls, each retrying once, is four requests and trips the threshold.
    for (let i = 0; i < 2; i++) {
      await expect(
        fetchJson(URL_, { retries: 1, retryOn: [403], sleep: noSleep, breaker }),
      ).rejects.toThrow();
    }
    const before = fetchMock.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    // Now the circuit is open: further calls must cost NOTHING.
    for (let i = 0; i < 5; i++) {
      await expect(
        fetchJson(URL_, { retries: 1, retryOn: [403], sleep: noSleep, breaker }),
      ).rejects.toThrow(/circuit open/i);
    }
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it("does not count a 404 — a healthy host answering honestly", async () => {
    // The museum's own search hands us ids whose records 404. Counting those
    // would open the circuit on a source that is perfectly well.
    quiet();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(404)));
    const breaker = makeBreaker({ threshold: 2 });
    for (let i = 0; i < 5; i++) {
      await expect(
        fetchJson(URL_, { retries: 0, retryOn: [403], sleep: noSleep, breaker }),
      ).rejects.toThrow(/404/);
    }
    expect(breaker.state()).toBe("closed");
  });

  it("closes again once the host recovers", async () => {
    quiet();
    let t = 0;
    const breaker = makeBreaker({ threshold: 1, cooldownMs: 100, now: () => t });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(403)));
    await expect(
      fetchJson(URL_, { retries: 0, retryOn: [403], sleep: noSleep, breaker }),
    ).rejects.toThrow();
    expect(breaker.state()).toBe("open");

    t = 500;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, { ok: true })));
    await expect(
      fetchJson(URL_, { retries: 0, sleep: noSleep, breaker }),
    ).resolves.toEqual({ ok: true });
    expect(breaker.state()).toBe("closed");
  });

  it("is inert when no breaker is passed, so every other source is untouched", async () => {
    quiet();
    const fetchMock = vi.fn().mockResolvedValue(res(429, {}, { "retry-after": "0" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchJson("https://en.wikipedia.org/w/api.php", { retries: 2, sleep: noSleep }),
    ).rejects.toThrow(/429/);
    // Retried in full, exactly as before this existed: Wikimedia gets no breaker.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("CircuitOpenError", () => {
  // A distinct type rather than a string to match on, because callers need to
  // tell "we chose not to ask" from "we asked and it broke". Logging the first
  // as a crash with a stack trace is exactly what made the breaker's first real
  // firing look like a bug.
  it("identifies a breaker refusal and nothing else", async () => {
    quiet();
    const breaker = makeBreaker({ threshold: 1, cooldownMs: 60_000 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(403)));
    await fetchJson(URL_, { retries: 0, retryOn: [403], sleep: noSleep, breaker }).catch(
      () => {},
    );

    const refusal = await fetchJson(URL_, {
      retries: 0,
      retryOn: [403],
      sleep: noSleep,
      breaker,
    }).catch((e: unknown) => e);

    expect(isCircuitOpen(refusal)).toBe(true);
    expect((refusal as CircuitOpenError).host).toBe("collectionapi.metmuseum.org");
    // An ordinary upstream failure must NOT be mistaken for one.
    expect(isCircuitOpen(new Error("Upstream responded 500"))).toBe(false);
    expect(isCircuitOpen(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The failure that was actually reported: the Gallery went dead and STAYED dead.
// ---------------------------------------------------------------------------

describe("a probe that never reports back", () => {
  it("does not wedge the circuit open forever", () => {
    quiet();
    let t = 0;
    const b = makeBreaker({ threshold: 1, cooldownMs: 100, now: () => t });
    b.record(true);

    // The cooldown elapses and one caller is let through to probe.
    t = 200;
    expect(() => b.guard(URL_)).not.toThrow();
    // …and its fetch THROWS, so `record` is never reached. Nothing tells the
    // breaker how the probe went.

    // Everyone else still waits out the cooldown, which is the point of a probe.
    t = 250;
    expect(() => b.guard(URL_)).toThrow(CircuitOpenError);

    // But the slot is time-boxed, so the next cooldown lets someone try again.
    // Before this fix the circuit stayed shut for the life of the process and
    // the log read "[met] search skipped: circuit open" forever.
    t = 400;
    expect(b.state()).toBe("half-open");
    expect(() => b.guard(URL_)).not.toThrow();
  });

  it("recovers through fetchJson after a timed-out probe, once the host is well", async () => {
    quiet();
    let t = 0;
    const breaker = makeBreaker({ threshold: 2, cooldownMs: 100, now: () => t });
    const opts = { breaker, retries: 0, retryOn: [403], sleep: noSleep };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(403)));
    await expect(fetchJson(URL_, opts)).rejects.toThrow();
    await expect(fetchJson(URL_, opts)).rejects.toThrow();
    expect(breaker.state()).toBe("open");

    // The probe times out: fetch rejects, so there is no response to record.
    t = 200;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("TimeoutError")));
    await expect(fetchJson(URL_, opts)).rejects.toThrow("TimeoutError");

    // The host recovers. The next probe window must actually serve a request.
    t = 400;
    const healthy = vi.fn().mockResolvedValue(res(200, { ok: true }));
    vi.stubGlobal("fetch", healthy);
    await expect(fetchJson(URL_, opts)).resolves.toEqual({ ok: true });
    expect(healthy).toHaveBeenCalledTimes(1);
    expect(breaker.state()).toBe("closed");
  });

  it("counts a thrown fetch as a failure, so a host that stops answering trips it", async () => {
    quiet();
    const breaker = makeBreaker({ threshold: 2, cooldownMs: 60_000 });
    const fetchMock = vi.fn().mockRejectedValue(new Error("TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    const opts = { breaker, retries: 0, sleep: noSleep };

    await expect(fetchJson(URL_, opts)).rejects.toThrow();
    await expect(fetchJson(URL_, opts)).rejects.toThrow();
    expect(breaker.state()).toBe("open");

    // Open means no network call at all — the property this whole file is about.
    await expect(fetchJson(URL_, opts)).rejects.toThrow(CircuitOpenError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("UpstreamError", () => {
  it("carries the status, so a settled 404 is not mistaken for a throttle", async () => {
    quiet();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(404)));
    const err = await fetchJson(URL_, { retries: 0, sleep: noSleep }).catch((e) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect(upstreamStatus(err)).toBe(404);
  });

  it("reports null for a failure that was not an upstream answer", () => {
    expect(upstreamStatus(new Error("boom"))).toBeNull();
    expect(upstreamStatus(new CircuitOpenError("host"))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The gate's second rate. The Met's edge is a bucket, not a metronome: spacing
// alone let one reader spend ~30 requests in two seconds and be refused for the
// next thirty. See the comment on `metGate`.
// ---------------------------------------------------------------------------

describe("makeGate with a rolling budget", () => {
  /** Drive the gate on a fake clock: `sleep` advances time instead of waiting. */
  async function run(gate: ReturnType<typeof makeGate>, n: number) {
    const realNow = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    const starts: number[] = [];
    try {
      for (let i = 0; i < n; i++) {
        await gate.next(async (ms) => {
          t += ms;
        });
        starts.push(t);
        // The request itself takes no time; the gate is what we are measuring.
      }
    } finally {
      Date.now = realNow;
    }
    return starts.map((at) => at - starts[0]);
  }

  it("lets a burst through at the spacing rate", async () => {
    const at = await run(makeGate(50, { burst: 60, windowMs: 30_000 }), 15);
    // 15 requests is one Gallery session start: it must still feel instant.
    expect(at[14]).toBe(700);
  });

  it("holds the window once the budget is spent, instead of being refused", async () => {
    const at = await run(makeGate(50, { burst: 10, windowMs: 5_000 }), 12);
    // The first ten go at 50ms spacing…
    expect(at[9]).toBe(450);
    // …and the eleventh waits for the oldest to age out of the window rather
    // than becoming a 403.
    expect(at[10]).toBe(5_000);
    expect(at[11]).toBe(5_050);
  });

  it("is unchanged for every other source when no budget is given", async () => {
    const at = await run(makeGate(300), 5);
    expect(at).toEqual([0, 300, 600, 900, 1200]);
  });

  it("refuses rather than holding a caller past `maxWaitMs`", async () => {
    // Waiting only beats a 403 while somebody is still listening. The feed
    // aborts a discover batch after 6s, so a 30s hold would spend the museum's
    // budget on a batch nobody receives.
    const gate = makeGate(50, { burst: 2, windowMs: 30_000, maxWaitMs: 5_000 });
    await expect(run(gate, 3)).rejects.toThrow(GateBudgetError);
  });

  it("charges nothing for a refusal, so the budget still frees up on time", async () => {
    const gate = makeGate(50, { burst: 2, windowMs: 1_000, maxWaitMs: 100 });
    const realNow = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    const tick = async (ms: number) => {
      t += ms;
    };
    try {
      await gate.next(tick);
      await gate.next(tick);
      // Budget spent: the third would wait ~950ms, past the 100ms ceiling.
      await expect(gate.next(tick)).rejects.toThrow(GateBudgetError);
      // The refusal must not have taken a slot; once the window rolls over,
      // the gate serves again immediately.
      t += 1_100;
      await expect(gate.next(tick)).resolves.toBeUndefined();
    } finally {
      Date.now = realNow;
    }
  });

  it("names a budget refusal as ours, not the upstream's", () => {
    expect(isBudgetExhausted(new GateBudgetError(9000))).toBe(true);
    expect(isBudgetExhausted(new CircuitOpenError("host"))).toBe(false);
  });
});
