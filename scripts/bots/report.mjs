// ---------------------------------------------------------------------------
// Drift · load-test harness — turning a run into something you can act on.
//
// Pure aggregation plus a Markdown renderer; no I/O beyond being handed the
// arrays. The numbers are computed here so they can be unit-tested
// (src/lib/loadbot-report.test.ts) — a percentile that is quietly wrong would
// not fail anything, it would just tell you the app is fine.
//
// The report has to be honest about what a LOCAL run cannot see, which is why
// `caveats()` is part of the renderer rather than something to remember to write
// underneath. A number without its caveat is how a rehearsal turns into false
// confidence (CLAUDE.md §8.1).
// ---------------------------------------------------------------------------

/** Nearest-rank percentile. Returns 0 for an empty sample. */
export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/** Group the edge's request log by route, with latency and cache behaviour. */
export function byRoute(requests) {
  const groups = new Map();
  for (const r of requests) {
    const key = routeKey(r.path);
    let g = groups.get(key);
    if (!g) {
      g = { route: key, count: 0, ms: [], hit: 0, miss: 0, stale: 0, bypass: 0, statuses: {} };
      groups.set(key, g);
    }
    g.count++;
    g.ms.push(r.ms);
    if (r.cache === "HIT") g.hit++;
    else if (r.cache === "STALE") g.stale++;
    else if (r.cache === "BYPASS") g.bypass++;
    else g.miss++;
    g.statuses[r.status] = (g.statuses[r.status] ?? 0) + 1;
  }
  return [...groups.values()]
    .map((g) => ({
      route: g.route,
      count: g.count,
      p50: percentile(g.ms, 50),
      p95: percentile(g.ms, 95),
      p99: percentile(g.ms, 99),
      max: g.ms.length ? Math.max(...g.ms) : 0,
      hitRatio: g.hit + g.miss + g.stale > 0 ? (g.hit + g.stale) / (g.hit + g.miss + g.stale) : null,
      statuses: g.statuses,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Collapse the dynamic segments of the artwork proxy so its thousands of
 * distinct URLs report as one route. Everything else in the app is already a
 * fixed path with the variance in the query string.
 */
export function routeKey(path) {
  if (path.startsWith("/api/img/met/")) return "/api/img/met/…";
  if (path.startsWith("/_next/")) return "/_next/…";
  return path;
}

/** Requests per wall-clock minute, from the run's start. */
export function timeline(requests, startedAt) {
  const buckets = [];
  for (const r of requests) {
    const m = Math.floor((r.at - startedAt) / 60000);
    if (m < 0) continue;
    buckets[m] = (buckets[m] ?? 0) + 1;
  }
  return Array.from(buckets, (n) => n ?? 0);
}

/** The whole-run picture. */
export function summarise({ requests, bots, throttles, edge, config, startedAt, endedAt }) {
  const api = requests.filter((r) => r.path.startsWith("/api/"));
  const cacheable = requests.filter((r) => r.cache !== "BYPASS" && r.cache !== "ERROR");
  const hits = cacheable.filter((r) => r.cache === "HIT" || r.cache === "STALE").length;
  const failed = requests.filter((r) => r.status === 0 || r.status >= 500);
  const cards = bots.reduce((n, b) => n + b.cards, 0);
  const minutes = Math.max(1 / 60, (endedAt - startedAt) / 60000);

  const perDriver = {};
  for (const driver of ["http", "browser"]) {
    const set = bots.filter((b) => b.driver === driver);
    if (!set.length) continue;
    const c = set.reduce((n, b) => n + b.cards, 0);
    perDriver[driver] = {
      bots: set.length,
      cards: c,
      requests: set.reduce((n, b) => n + b.requests, 0),
      perCard: c ? set.reduce((n, b) => n + b.requests, 0) / c : 0,
    };
  }

  return {
    config,
    startedAt,
    endedAt,
    durationMin: Number(minutes.toFixed(1)),
    bots: {
      total: bots.length,
      finished: bots.filter((b) => b.endedBecause === "finished").length,
      cards,
      drifts: bots.reduce((n, b) => n + b.drifts, 0),
      threads: bots.reduce((n, b) => n + b.threads, 0),
      backs: bots.reduce((n, b) => n + b.backs, 0),
      readMores: bots.reduce((n, b) => n + b.readMores, 0),
      refills: bots.reduce((n, b) => n + b.refills, 0),
      retries: bots.reduce((n, b) => n + (b.retries ?? 0), 0),
      errors: bots.reduce((n, b) => n + b.errors.length, 0),
      consoleErrors: bots.reduce((n, b) => n + (b.consoleErrors?.length ?? 0), 0),
    },
    perDriver,
    traffic: {
      requests: requests.length,
      apiRequests: api.length,
      perMinute: Number((requests.length / minutes).toFixed(1)),
      apiPerCard: cards ? Number((api.length / cards).toFixed(2)) : 0,
      cacheHitRatio: cacheable.length ? Number((hits / cacheable.length).toFixed(3)) : null,
      failed: failed.length,
      failureRate: requests.length ? Number((failed.length / requests.length).toFixed(4)) : 0,
    },
    latency: {
      timeToFirstCard: {
        p50: percentile(bots.map((b) => b.timeToFirstCardMs).filter(Boolean), 50),
        p95: percentile(bots.map((b) => b.timeToFirstCardMs).filter(Boolean), 95),
      },
      nextCard: {
        p50: percentile(bots.flatMap((b) => b.cardLatencies), 50),
        p95: percentile(bots.flatMap((b) => b.cardLatencies), 95),
        p99: percentile(bots.flatMap((b) => b.cardLatencies), 99),
      },
    },
    routes: byRoute(requests),
    timeline: timeline(requests, startedAt),
    throttles,
    edge,
  };
}

/** The Markdown report. */
export function renderMarkdown(s, bots) {
  // A press that needed repeating is a moment a reader felt the app not answer:
  // `advance` and `onThread` drop a key while a buffer refill holds `busyRef`.
  const dimNote = "(a refill was in flight; the reader sees the loading state) ";
  const dimNote2 = "(we stopped asking that host for 35s rather than retrying into it) ";
  const pct = (n) => (n === null ? "n/a" : `${(n * 100).toFixed(1)}%`);
  const L = [];

  L.push(`# Drift load rehearsal — ${new Date(s.startedAt).toISOString()}`);
  L.push("");
  L.push(
    `**${s.config.bots} bots** (${s.perDriver.browser?.bots ?? 0} browser, ${s.perDriver.http?.bots ?? 0} HTTP) ` +
      `for **${s.durationMin} min** against **${s.config.base}** ` +
      `(${s.config.instances} app instance(s) behind the edge emulator).`,
  );
  L.push("");
  L.push(`Realm mix: ${s.config.gallery} Gallery, ${s.config.bots - s.config.gallery} Encyclopedia.` +
    (s.config.capped ? "  ⚠️ Gallery share was reduced by the safety cap." : ""));
  L.push("");

  L.push("## Verdict");
  L.push("");
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| Cards read | **${s.bots.cards}** across ${s.bots.total} bots |`);
  L.push(`| Time to next card | p50 **${s.latency.nextCard.p50} ms**, p95 **${s.latency.nextCard.p95} ms**, p99 ${s.latency.nextCard.p99} ms |`);
  L.push(`| Time to first card | p50 **${s.latency.timeToFirstCard.p50} ms**, p95 ${s.latency.timeToFirstCard.p95} ms |`);
  L.push(`| Edge cache hit ratio | **${pct(s.traffic.cacheHitRatio)}** |`);
  L.push(`| API requests per card | **${s.traffic.apiPerCard}** |`);
  L.push(`| Request rate | ${s.traffic.perMinute}/min (${s.traffic.requests} total, ${s.traffic.apiRequests} to /api) |`);
  L.push(`| Failed requests | ${s.traffic.failed} (${pct(s.traffic.failureRate)}) |`);
  L.push(`| Upstream throttles | **${s.throttles.total}**${s.throttles.gaveUp ? `, ${s.throttles.gaveUp} given up on` : ""} |`);
  if (s.throttles.breakerOpened) {
    L.push(`| Circuit breaker opened | **${s.throttles.breakerOpened}×** ${dimNote2}|`);
  }
  L.push(`| Presses needing a repeat | ${s.bots.retries} ${s.bots.retries ? dimNote : ""}|`);
  L.push(`| Bot errors | ${s.bots.errors}${s.bots.consoleErrors ? `, ${s.bots.consoleErrors} browser console errors` : ""} |`);
  L.push("");

  if (s.throttles.total) {
    L.push("### Upstream throttling");
    L.push("");
    L.push("Counted from the app instances' own `[upstream]` log lines, not inferred.");
    L.push("");
    L.push("| Host | Hits | Statuses |");
    L.push("|---|--:|---|");
    for (const [host, v] of Object.entries(s.throttles.byHost)) {
      // Per host. The museum throttles with 403 and Wikimedia with 429, so
      // printing the run-wide histogram on every row (as this once did) made it
      // look as though Wikipedia had 403ed us over a thousand times.
      const total = typeof v === "number" ? v : v.total;
      const statuses =
        typeof v === "number"
          ? "—"
          : Object.entries(v.statuses)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => `${k}×${n}`)
              .join(", ");
      L.push(`| \`${host}\` | ${total} | ${statuses} |`);
    }
    L.push("");
  }

  L.push("## Routes");
  L.push("");
  L.push("| Route | Calls | p50 | p95 | p99 | max | Cache hit |");
  L.push("|---|--:|--:|--:|--:|--:|--:|");
  for (const r of s.routes.slice(0, 18)) {
    L.push(
      `| \`${r.route}\` | ${r.count} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.max} | ${pct(r.hitRatio)} |`,
    );
  }
  L.push("");
  L.push("Latencies are milliseconds as seen by the bot, through the edge emulator.");
  L.push("");

  if (Object.keys(s.perDriver).length > 1) {
    L.push("## Driver calibration");
    L.push("");
    L.push(
      "The HTTP bots are a model of what the app does. This is the check that the model is right:",
    );
    L.push("");
    L.push("| Driver | Bots | Cards | Requests | Per card |");
    L.push("|---|--:|--:|--:|--:|");
    for (const [name, d] of Object.entries(s.perDriver)) {
      L.push(`| ${name} | ${d.bots} | ${d.cards} | ${d.requests} | ${d.perCard.toFixed(2)} |`);
    }
    const h = s.perDriver.http?.perCard ?? 0;
    const b = s.perDriver.browser?.perCard ?? 0;
    if (h && b) {
      const drift = Math.abs(h - b) / b;
      L.push("");
      L.push(
        drift <= 0.35
          ? `✅ Within ${(drift * 100).toFixed(0)}% of each other — the HTTP bots are load-equivalent to real browsers.`
          : `⚠️ **${(drift * 100).toFixed(0)}% apart.** The HTTP model has drifted from what the app actually does; the volume numbers above understate or overstate real load until this is reconciled.`,
      );
    }
    L.push("");
  }

  L.push("## Traffic over time");
  L.push("");
  L.push("Requests per minute from the start of the run:");
  L.push("");
  L.push("```");
  const peak = Math.max(1, ...s.timeline);
  s.timeline.forEach((n, i) => {
    const bar = "█".repeat(Math.round((n / peak) * 40));
    L.push(`${String(i).padStart(3)}m ${String(n).padStart(5)} ${bar}`);
  });
  L.push("```");
  L.push("");

  L.push("## Every bot");
  L.push("");
  L.push("| Bot | Driver | Realm | Speed | Cards | Threads | Drifts | Backs | Read more | Refills | Re-press | Reqs | Ended | Errors |");
  L.push("|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|--:|");
  for (const b of bots) {
    L.push(
      `| ${b.id} | ${b.driver} | ${b.realm} | ${b.speed}× | ${b.cards} | ${b.threads} | ${b.drifts} | ${b.backs} | ${b.readMores} | ${b.refills} | ${b.retries ?? 0} | ${b.requests} | ${b.endedBecause} | ${b.errors.length} |`,
    );
  }
  L.push("");

  const withErrors = bots.filter((b) => b.errors.length || b.consoleErrors?.length);
  if (withErrors.length) {
    L.push("### Errors seen");
    L.push("");
    for (const b of withErrors) {
      for (const e of [...b.errors, ...(b.consoleErrors ?? [])].slice(0, 5)) {
        L.push(`- \`${b.id}\`: ${e}`);
      }
    }
    L.push("");
  }

  L.push(...caveats(s));
  return L.join("\n");
}

/**
 * What this run did NOT measure.
 *
 * Not a disclaimer: a list of the specific things that differ between this rig
 * and the deployment, so a good number here is not read as a promise about
 * production. Stated every time, because the run that gets misread is the one
 * where somebody forgot to add them.
 */
export function caveats(s) {
  return [
    "## What this run could not measure",
    "",
    "The rig reproduces the two things that matter most about the deployment: a shared",
    "edge cache in front, and several app instances behind it (each with its own",
    "request-spacing gate, as Vercel's functions have). These remain different:",
    "",
    "- **Network latency.** Everything here is loopback. Add roughly 50-150 ms per",
    "  request for a real reader talking to fra1.",
    "- **Function limits.** Vercel caps a function's memory and CPU. The artwork proxy",
    "  (`/api/img/met/…`) downloads an ~8 MB original and resizes it with sharp; on this",
    "  machine that had 36 GB and 14 cores to play with.",
    "- **Cold starts.** Every instance here was warm for the whole run.",
    "- **The upstream budget.** Wikimedia and the museum rate-limit by source IP. This",
    "  run spent a home connection's own budget; the deployment shares Vercel's egress",
    "  pool with everyone else on it, so production has *less* headroom than this shows.",
    "",
    `Cache entries held at the end: ${s.edge.entries} (${(s.edge.bytes / 1048576).toFixed(1)} MB).`,
    "",
  ];
}
