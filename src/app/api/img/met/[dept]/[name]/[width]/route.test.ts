import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// The Met image proxy's failure handling (pre-flyer review, finding 03).
//
// THREE THINGS ARE PINNED HERE, and all of them are about what happens when the
// picture does not come back, which is the path nobody exercises by hand.
//
// 1. A 404 MUST NOT COUNT AGAINST THE BREAKER, because the artwork name is a
//    free path segment with no auth in front of it and four made-up ones would
//    otherwise take every Met image down for thirty seconds. This guarantee was
//    already true; it was simply never tested, and a guarantee that lives only
//    in a comment is one refactor from being false.
//
// 2. A GENUINE FAILURE MUST COUNT EXACTLY ONCE. The response used to be handled
//    inside the same `try` as the fetch, so its throw was caught one line later
//    and `record(true)` ran a second time for one response. Harmless on a 404
//    (the `record(false)` resets the counter first), but a 503 was counted
//    twice, so `threshold: 4` behaved like 2. Measured both ways: three failing
//    requests made 2 upstream calls under the old shape and 4 under the new one.
//
// 3. A SETTLED MISS AND AN OUTAGE CACHE DIFFERENTLY. Both used to be a 502 with
//    `no-store`, which is why a shell loop over invented names was free to send
//    and expensive to serve: two upstream fetches every time, for ever.
//
// The route is driven for real (its own gate, its own breaker, its own module
// state) with only `fetch` replaced, because the bug lived in the interaction
// between those pieces and a mock of them would have reproduced the belief
// rather than the behaviour.
// ---------------------------------------------------------------------------

const realFetch = globalThis.fetch;

/** The route module, freshly loaded so its gate and breaker start clean. */
async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function ctx(dept: string, name: string, width: string) {
  return { params: Promise.resolve({ dept, name, width }) };
}

/** A request with a distinct caller address, so the per-IP bucket is not the
 *  thing under test here. */
function req(ip = "203.0.113.7") {
  return new Request("https://drift.test/api/img/met/gr/X/843", {
    headers: { "x-vercel-forwarded-for": ip },
  });
}

let calls: string[] = [];

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.resetModules();
});

/** Answer every upstream image request with one status. */
function stubFetch(status: number) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(typeof input === "string" ? input : String(input));
    return new Response(status === 200 ? new Uint8Array([1, 2, 3]) : "nope", {
      status,
    });
  }) as unknown as typeof fetch;
}

describe("a missing artwork name", () => {
  it("never opens the breaker, however many are asked for", async () => {
    const { GET } = await loadRoute();
    stubFetch(404);

    // The breaker's threshold is 4. Under the old shape the circuit opened
    // during the second request and every one after it answered 502 without
    // making a request at all.
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await GET(req(), ctx("gr", `Junk${i}`, "843"));
      statuses.push(res.status);
    }

    expect(statuses).toEqual([404, 404, 404, 404, 404, 404]);
    // Two upstream attempts each (original, then the web-large fallback) and
    // none skipped: a skipped one would mean the circuit had opened.
    expect(calls.length).toBe(12);
  }, 20_000);

  it("is a settled answer, and says so in the cache header", async () => {
    const { GET } = await loadRoute();
    stubFetch(404);
    const res = await GET(req(), ctx("gr", "Nope", "843"));
    expect(res.status).toBe(404);
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toContain("s-maxage=3600");
    // Never immutable and never a month: an artwork can join the open-access
    // set at any time.
    expect(cc).not.toContain("immutable");
  }, 20_000);
});

describe("the museum having a bad minute", () => {
  // ⚠️ THIS IS THE CASE THAT TELLS THE TWO SHAPES APART. The breaker's threshold
  // is 4 and each request makes two attempts (original, then web-large), so the
  // circuit should open part-way through the SECOND request: four upstream calls
  // in total, then nothing. Under the old single-`try` shape each response was
  // recorded twice, so it opened part-way through the FIRST request and only two
  // calls were ever made. Counting the calls is what distinguishes them.
  it("opens the circuit after the configured number of failures, not half of it", async () => {
    const { GET } = await loadRoute();
    stubFetch(503);
    for (let i = 0; i < 3; i++) await GET(req(), ctx("gr", `Real${i}`, "843"));
    expect(calls.length).toBe(4);
  }, 20_000);

  it("is NOT cached as an answer, and stays a 502", async () => {
    const { GET } = await loadRoute();
    stubFetch(503);
    const res = await GET(req(), ctx("gr", "Real", "843"));
    expect(res.status).toBe(502);
    const cc = res.headers.get("cache-control") ?? "";
    // Short enough that a real outage heals almost immediately, long enough
    // that a hammer stops reaching the museum.
    expect(cc).toContain("s-maxage=60");
    expect(cc).not.toContain("3600");
  }, 20_000);
});

describe("the request gate", () => {
  it("still refuses a width that is not on the allowlist, before any fetch", async () => {
    const { GET } = await loadRoute();
    stubFetch(200);
    for (const w of ["700", "0843", "843.0", "+843", "8.43e2"]) {
      const res = await GET(req(), ctx("gr", "DP20355", w));
      expect(res.status, `width ${w}`).toBe(400);
    }
    expect(calls.length).toBe(0);
  });

  it("still refuses a path component that could leave the host", async () => {
    const { GET } = await loadRoute();
    stubFetch(200);
    for (const [dept, name] of [
      ["../etc", "DP1"],
      ["gr", "../../evil"],
      ["gr", "a/b"],
      ["GR", "DP1"],
      ["toolongdept", "DP1"],
    ]) {
      const res = await GET(req(), ctx(dept, name, "843"));
      expect(res.status, `${dept}/${name}`).toBe(400);
    }
    expect(calls.length).toBe(0);
  });

  it("refuses a caller who has spent the bucket, without touching the museum", async () => {
    const { GET } = await loadRoute();
    stubFetch(404);
    // The bucket is 180. Spend it with cheap 400s (which are refused before the
    // limiter is consulted? no: the limiter runs first, so these all count).
    const ip = "198.51.100.4";
    let refused = 0;
    for (let i = 0; i < 200; i++) {
      // A bad width returns 400 without any upstream call, so this spends
      // tokens quickly without 400 slow fetches.
      const res = await GET(req(ip), ctx("gr", "DP20355", "701"));
      if (res.status === 429) refused++;
    }
    expect(refused).toBeGreaterThan(0);
    expect(calls.length).toBe(0);

    // A different caller is untouched.
    const other = await GET(req("198.51.100.5"), ctx("gr", "DP20355", "701"));
    expect(other.status).toBe(400);
  });
});
