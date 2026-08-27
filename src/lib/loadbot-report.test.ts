// ---------------------------------------------------------------------------
// The load-test report's arithmetic (scripts/bots/report.mjs).
//
// These are the numbers somebody decides "the beta is fine" on. A percentile
// that is off by one, or a cache ratio that counts bypasses as misses, does not
// fail anything — it just quietly reports a healthier app than the one that ran.
// So the maths is pinned here rather than trusted.
//
// In src/ so the existing `npm run test` glob picks it up. See loadbot.test.ts.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  percentile,
  byRoute,
  routeKey,
  timeline,
  summarise,
  renderMarkdown,
  caveats,
} from "../../scripts/bots/report.mjs";

const req = (o: Record<string, unknown> = {}) => ({
  url: "/api/realm/encyclopedia/related?id=Octopus",
  path: "/api/realm/encyclopedia/related",
  method: "GET",
  status: 200,
  cache: "MISS",
  ms: 100,
  bytes: 1000,
  at: 0,
  ...o,
});

const bot = (o: Record<string, unknown> = {}) => ({
  id: "bot-000",
  driver: "http",
  realm: "encyclopedia",
  speed: 1,
  cards: 10,
  drifts: 4,
  threads: 5,
  backs: 1,
  readMores: 2,
  refills: 1,
  requests: 24,
  errors: [] as string[],
  startedAt: 0,
  timeToFirstCardMs: 500,
  cardLatencies: [100, 200, 300],
  endedAt: 1000,
  endedBecause: "finished",
  ...o,
});

describe("percentile", () => {
  it("is 0 for an empty sample rather than NaN", () => {
    // NaN would render as "NaN ms" in the verdict table and look like a bug in
    // the app rather than an empty measurement.
    expect(percentile([], 50)).toBe(0);
    expect(percentile([], 95)).toBe(0);
  });

  it("uses nearest-rank, so every result is a real observation", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(xs, 50)).toBe(5);
    expect(percentile(xs, 95)).toBe(10);
    expect(percentile(xs, 100)).toBe(10);
    expect(percentile(xs, 10)).toBe(1);
  });

  it("does not care about input order", () => {
    expect(percentile([9, 1, 5, 3, 7], 50)).toBe(5);
  });

  it("handles a single sample", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 99)).toBe(42);
  });
});

describe("routeKey", () => {
  it("collapses the artwork proxy's thousands of URLs into one route", () => {
    // Without this the routes table would be one row per artwork and the
    // expensive route would be invisible.
    expect(routeKey("/api/img/met/DP123/some-name/843")).toBe("/api/img/met/…");
    expect(routeKey("/api/img/met/EP9/other/1686")).toBe("/api/img/met/…");
  });

  it("leaves the real API routes alone", () => {
    expect(routeKey("/api/realm/gallery/related")).toBe("/api/realm/gallery/related");
    expect(routeKey("/api/doorway")).toBe("/api/doorway");
  });
});

describe("byRoute", () => {
  it("groups, counts and ranks by traffic", () => {
    const rows = byRoute([
      req({ path: "/api/doorway", ms: 10 }),
      req({ path: "/api/doorway", ms: 20 }),
      req({ path: "/api/doorway", ms: 30 }),
      req({ path: "/api/realm/encyclopedia/related", ms: 50 }),
    ]);
    expect(rows[0].route).toBe("/api/doorway");
    expect(rows[0].count).toBe(3);
    expect(rows[0].max).toBe(30);
    expect(rows[1].count).toBe(1);
  });

  it("excludes bypasses from the hit ratio", () => {
    // A bypass is a request the edge was never allowed to cache (an
    // authenticated one). Counting it as a miss would make the app look worse
    // the more signed-in traffic it had, which is backwards.
    const rows = byRoute([
      req({ cache: "HIT" }),
      req({ cache: "MISS" }),
      req({ cache: "BYPASS" }),
      req({ cache: "BYPASS" }),
    ]);
    expect(rows[0].hitRatio).toBe(0.5);
  });

  it("counts a STALE serve as a hit, because upstream was not asked", () => {
    const rows = byRoute([req({ cache: "STALE" }), req({ cache: "MISS" })]);
    expect(rows[0].hitRatio).toBe(0.5);
  });

  it("reports null rather than 0 when nothing was cacheable", () => {
    expect(byRoute([req({ cache: "BYPASS" })])[0].hitRatio).toBeNull();
  });
});

describe("timeline", () => {
  it("buckets by minute from the start and fills gaps with zero", () => {
    const t = timeline(
      [req({ at: 0 }), req({ at: 30000 }), req({ at: 130000 })],
      0,
    );
    expect(t).toEqual([2, 0, 1]);
  });

  it("ignores anything before the start", () => {
    expect(timeline([req({ at: -5000 }), req({ at: 1000 })], 0)).toEqual([1]);
  });
});

describe("summarise", () => {
  const base = {
    requests: [
      req({ cache: "HIT", at: 0 }),
      req({ cache: "MISS", at: 0 }),
      req({ cache: "MISS", at: 0, status: 500 }),
      req({ cache: "BYPASS", at: 0, path: "/drift" }),
    ],
    bots: [bot(), bot({ id: "bot-001", driver: "browser", requests: 26 })],
    throttles: {
      byHost: { "en.wikipedia.org": { total: 2, statuses: { 429: 2 } } },
      byStatus: { 429: 2 },
      gaveUp: 0,
      total: 2,
    },
    edge: { entries: 3, bytes: 1048576 },
    config: { bots: 2, base: "http://127.0.0.1:3100", instances: 3, gallery: 0, capped: false },
    startedAt: 0,
    endedAt: 60000,
  };

  it("counts a 500 as a failure and a 200 as not", () => {
    expect(summarise(base).traffic.failed).toBe(1);
    expect(summarise(base).traffic.failureRate).toBe(0.25);
  });

  it("treats a request that never answered (status 0) as a failure", () => {
    const s = summarise({ ...base, requests: [...base.requests, req({ status: 0 })] });
    expect(s.traffic.failed).toBe(2);
  });

  it("computes the cache ratio over cacheable requests only", () => {
    // 1 HIT out of 3 cacheable; the BYPASS is not in the denominator.
    expect(summarise(base).traffic.cacheHitRatio).toBe(0.333);
  });

  it("reports requests per card from API traffic, not page loads", () => {
    // 3 /api requests over 20 cards. The /drift page load must not inflate it.
    expect(summarise(base).traffic.apiPerCard).toBe(0.15);
  });

  it("splits per-card cost by driver, which is the calibration gate", () => {
    const s = summarise(base);
    expect(s.perDriver.http.perCard).toBeCloseTo(2.4, 5);
    expect(s.perDriver.browser.perCard).toBeCloseTo(2.6, 5);
  });

  it("survives a run in which no bot read anything", () => {
    const s = summarise({
      ...base,
      requests: [],
      bots: [bot({ cards: 0, requests: 0, cardLatencies: [], timeToFirstCardMs: null })],
    });
    expect(s.traffic.apiPerCard).toBe(0);
    expect(s.traffic.cacheHitRatio).toBeNull();
    expect(s.latency.nextCard.p95).toBe(0);
  });
});

describe("renderMarkdown", () => {
  const s = summarise({
    requests: [req({ cache: "HIT" }), req({ cache: "MISS" })],
    bots: [bot()],
    throttles: {
      byHost: {
        "collectionapi.metmuseum.org": { total: 30, statuses: { 403: 30 } },
        "en.wikipedia.org": { total: 3, statuses: { 429: 3 } },
      },
      byStatus: { 403: 30, 429: 3 },
      gaveUp: 1,
      total: 33,
    },
    edge: { entries: 1, bytes: 2097152 },
    config: { bots: 1, base: "http://127.0.0.1:3100", instances: 3, gallery: 0, capped: true },
    startedAt: 0,
    endedAt: 60000,
  });

  it("produces a report with the sections a reader needs", () => {
    const md = renderMarkdown(s, [bot()]);
    for (const heading of ["## Verdict", "## Routes", "## Every bot", "## What this run could not measure"]) {
      expect(md).toContain(heading);
    }
  });

  it("surfaces upstream throttling rather than burying it", () => {
    const md = renderMarkdown(s, [bot()]);
    expect(md).toContain("### Upstream throttling");
    expect(md).toContain("collectionapi.metmuseum.org");
  });

  it("attributes each status to its OWN host", () => {
    // The museum throttles with 403 and Wikimedia with 429. An earlier version
    // printed the run-wide histogram on every row, so a report of 30 museum 403s
    // and 3 Wikipedia 429s read as though Wikipedia had 403ed us 30 times too.
    const md = renderMarkdown(s, [bot()]);
    const met = md.split("\n").find((l) => l.includes("collectionapi"))!;
    const wiki = md.split("\n").find((l) => l.includes("en.wikipedia.org"))!;
    expect(met).toContain("403×30");
    expect(met).not.toContain("429");
    expect(wiki).toContain("429×3");
    expect(wiki).not.toContain("403");
  });

  it("says out loud when the Gallery cap changed the run that was asked for", () => {
    expect(renderMarkdown(s, [bot()])).toContain("Gallery share was reduced");
  });

  it("always carries the caveats, so a good number is never read as a promise", () => {
    const md = renderMarkdown(s, [bot()]);
    for (const line of caveats(s)) {
      if (line.trim()) expect(md).toContain(line.trim().slice(0, 40));
    }
  });
});
