import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { amsterdamDay } from "../limits";

// ---------------------------------------------------------------------------
// The meter's I/O half. What is actually being pinned here is the FAIL-OPEN
// contract (CLAUDE.md §4): every path where the backend misbehaves has to end in
// "carry on reading", never in "you are done for today". Those are the branches
// nobody exercises by hand, and getting one backwards would lock a reader out of
// their own feed because a request timed out.
//
// The module keeps state at module scope, so each test re-imports it fresh.
// ---------------------------------------------------------------------------

const UID = "user-1";
const OTHER_UID = "user-2";
const TODAY = amsterdamDay();

let store: Record<string, string>;
let rpc: ReturnType<typeof vi.fn>;
let client: unknown;

vi.mock("../supabase/client", () => ({
  getSupabase: () => client,
}));

/** Import the module with module state reset, after the fixtures are in place. */
async function freshMeter() {
  vi.resetModules();
  return import("./meter");
}

beforeEach(() => {
  store = {};
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
  });
  rpc = vi.fn();
  client = {
    auth: { getUser: async () => ({ data: { user: { id: UID } } }) },
    rpc,
  };
  delete process.env.NEXT_PUBLIC_FREE_DAILY_STOPS;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_FREE_DAILY_STOPS;
});

const mirror = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ uid: UID, day: TODAY, stops: 5, supporter: false, ...over });

describe("refreshStatus", () => {
  it("reads the day's count and entitlement from the database", async () => {
    rpc.mockResolvedValue({ data: [{ stops: 7, day: TODAY, supporter: false }] });
    const m = await freshMeter();
    expect(await m.refreshStatus()).toEqual({ stops: 7, supporter: false });
    expect(JSON.parse(store["drift-meter"]).stops).toBe(7);
  });

  it("is inert with no backend — local-only Drift is never metered", async () => {
    client = null;
    store["drift-meter"] = mirror();
    const m = await freshMeter();
    expect(await m.refreshStatus()).toBeNull();
    expect(store["drift-meter"]).toBeUndefined();
  });

  it("keeps today's mirror when the request fails, so a blip does not reset the day", async () => {
    store["drift-meter"] = mirror({ stops: 12 });
    rpc.mockResolvedValue({ data: null, error: new Error("network") });
    const m = await freshMeter();
    expect(await m.refreshStatus()).toEqual({ stops: 12, supporter: false });
  });

  it("falls back to UNKNOWN when the request fails and the mirror is yesterday's", async () => {
    // Fail open: an unknown state is treated as unmetered by the feed, which is
    // the right way round. Carrying a stale count forward would be the wrong one.
    store["drift-meter"] = mirror({ day: "2000-01-01", stops: 99 });
    rpc.mockResolvedValue({ data: null, error: new Error("network") });
    const m = await freshMeter();
    expect(await m.refreshStatus()).toBeNull();
  });

  it("ignores a mirror belonging to a different account on the same device", async () => {
    store["drift-meter"] = mirror({ uid: OTHER_UID, stops: 99 });
    rpc.mockResolvedValue({ data: null, error: new Error("network") });
    const m = await freshMeter();
    expect(await m.refreshStatus()).toBeNull();
  });
});

describe("primeMeter", () => {
  it("adopts this user's mirror synchronously, with no network call", async () => {
    store["drift-meter"] = mirror({ stops: 4 });
    const m = await freshMeter();
    expect(m.primeMeter(UID)).toEqual({ stops: 4, supporter: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses another account's mirror and yesterday's mirror", async () => {
    store["drift-meter"] = mirror({ uid: OTHER_UID });
    let m = await freshMeter();
    expect(m.primeMeter(UID)).toBeNull();

    store["drift-meter"] = mirror({ day: "2000-01-01" });
    m = await freshMeter();
    expect(m.primeMeter(UID)).toBeNull();
  });

  it("survives unreadable storage", async () => {
    store["drift-meter"] = "{not json";
    const m = await freshMeter();
    expect(m.primeMeter(UID)).toBeNull();
  });
});

describe("recordStop", () => {
  it("counts optimistically, then takes the server's count as authoritative", async () => {
    store["drift-meter"] = mirror({ stops: 5 });
    const m = await freshMeter();
    m.primeMeter(UID);

    // The server has seen another device: it says 9, not the optimistic 6.
    rpc.mockResolvedValue({ data: [{ stops: 9, day: TODAY }] });
    m.recordStop();
    expect(m.meterState()).toEqual({ stops: 6, supporter: false }); // optimistic
    await vi.waitFor(() =>
      expect(m.meterState()).toEqual({ stops: 9, supporter: false }),
    );
  });

  it("keeps the optimistic count when the write fails", async () => {
    store["drift-meter"] = mirror({ stops: 5 });
    const m = await freshMeter();
    m.primeMeter(UID);
    rpc.mockResolvedValue({ data: null, error: new Error("nope") });
    m.recordStop();
    await vi.waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(m.meterState()).toEqual({ stops: 6, supporter: false });
  });

  it("never throws when the call rejects outright", async () => {
    const m = await freshMeter();
    rpc.mockRejectedValue(new Error("offline"));
    expect(() => m.recordStop()).not.toThrow();
  });

  it("does nothing at all with no backend", async () => {
    client = null;
    const m = await freshMeter();
    m.recordStop();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("stops counting a supporter once a limit is configured", async () => {
    // Data minimisation: with a limit live, a supporter's daily count serves no
    // purpose, so it is not collected.
    process.env.NEXT_PUBLIC_FREE_DAILY_STOPS = "50";
    store["drift-meter"] = mirror({ supporter: true });
    const m = await freshMeter();
    m.primeMeter(UID);
    m.recordStop();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("still counts a supporter during the measure-first period", async () => {
    // No limit set: the whole point is to learn what a day looks like, and that
    // includes the people who already hold the unlock.
    store["drift-meter"] = mirror({ supporter: true });
    const m = await freshMeter();
    m.primeMeter(UID);
    rpc.mockResolvedValue({ data: [{ stops: 6, day: TODAY }] });
    m.recordStop();
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith("record_stop"));
  });

  it("keeps `supporter` across a reconcile — record_stop does not return it", async () => {
    store["drift-meter"] = mirror({ supporter: true, stops: 5 });
    const m = await freshMeter();
    m.primeMeter(UID);
    rpc.mockResolvedValue({ data: [{ stops: 6, day: TODAY }] });
    m.recordStop();
    await vi.waitFor(() => expect(m.meterState()?.supporter).toBe(true));
  });
});

describe("subscribeMeter", () => {
  it("notifies on change and stops after unsubscribe", async () => {
    store["drift-meter"] = mirror({ stops: 1 });
    const m = await freshMeter();
    const seen: (number | null)[] = [];
    const off = m.subscribeMeter((s) => seen.push(s?.stops ?? null));
    m.primeMeter(UID);
    expect(seen).toEqual([1]);
    off();
    m.resetMeter();
    expect(seen).toEqual([1]);
  });

  it("a throwing listener cannot break the meter", async () => {
    const m = await freshMeter();
    m.subscribeMeter(() => {
      throw new Error("bad listener");
    });
    expect(() => m.resetMeter()).not.toThrow();
  });
});

describe("the state we refuse to invent", () => {
  it("re-asks rather than guessing `supporter` when the mount fetch was lost", async () => {
    // The dangerous sequence: refreshStatus failed (so nothing is known), the
    // write then succeeds and reports a count already past the limit. Filling in
    // supporter:false there would close the day on a reader who has paid.
    const m = await freshMeter();
    expect(m.meterState()).toBeNull();
    rpc.mockImplementation(async (fn: string) =>
      fn === "record_stop"
        ? { data: [{ stops: 80, day: TODAY }] }
        : { data: [{ stops: 80, day: TODAY, supporter: true }] },
    );
    m.recordStop();
    await vi.waitFor(() =>
      expect(m.meterState()).toEqual({ stops: 80, supporter: true }),
    );
    expect(rpc).toHaveBeenCalledWith("supporter_status");
  });
});
