// ---------------------------------------------------------------------------
// Drift · load-test harness — the HTTP driver.
//
// A reader without a browser. It replays the exact request sequence the feed
// makes, so that N of these put the same load on the server as N people would,
// at a fraction of the cost of N Chromium instances (which, on a laptop that is
// also hosting the app, would mean measuring the laptop).
//
// ⚠️ THE ONE RULE: NO `Authorization` HEADER ON `/api/*`.
// The real browser does not send one — supabase-js keeps the session in
// localStorage under `drift-auth`, not in a cookie (src/lib/supabase/client.ts).
// If a bot sent its JWT to a content route, `cacheHeaders()` would refuse to
// cache the response (the M-10 shared-cache guard), the edge emulator would
// bypass it too, and the run's headline number — the cache hit ratio — would be
// measuring a configuration nobody deploys. The JWT goes ONLY to Supabase, for
// `record_stop` and the sync writes, exactly as the app does.
//
// The sequence below mirrors src/app/(app)/drift/page.tsx. Where it makes a
// choice the page makes, the page's line is named, because the value of this
// driver is entirely in being faithful:
//
//   seed ("Surprise me")   REFILL_TOPICS discover calls in parallel; first card
//                          opens, the rest fill the buffer            (page:868)
//   every card displayed   related + doorway, fired together        (page:941-947)
//   drift onward           free from the buffer; a refill costs
//                          REFILL_TOPICS discover calls again       (page:1443-1450)
//   thread pull            NO fetch — the candidate is already in hand
//   "Read more"            one extended summary                      (CardView:773)
//
// The buffer is why a drift is usually free, and it is the single biggest
// influence on requests-per-card. Getting it wrong would not fail; it would just
// quietly produce a different number.
// ---------------------------------------------------------------------------

import {
  discoverUrl,
  relatedUrl,
  doorwayUrl,
  summaryUrl,
  RANDOM_URL,
  bucketsFor,
  randomOffset,
  REFILL_TOPICS,
  DISCOVER_LIMIT,
  SEED_LIMIT,
} from "./urls.mjs";
import {
  dwellMs,
  chooseMove,
  shouldReadMore,
  sessionLength,
  pick,
} from "./behaviour.mjs";

const cardId = (c) => `${c?.source ?? "wikipedia"}:${c?.pageTitle}`;

/**
 * One simulated reader.
 *
 * `session` carries the bot's Supabase JWT (or null when it could not sign in —
 * the run continues, because the reading loop must not depend on the cloud;
 * that is the app's own contract, CLAUDE.md §4).
 */
export async function runHttpBot({
  id,
  realm,
  base,
  rng,
  speed,
  session,
  supabase,
  deadline,
  signal,
}) {
  const stats = {
    id,
    driver: "http",
    realm,
    speed: Number(speed.toFixed(2)),
    cards: 0,
    drifts: 0,
    threads: 0,
    backs: 0,
    readMores: 0,
    refills: 0,
    // The HTTP driver never needs to re-press: it calls the API directly and
    // has no `busyRef` to be blocked by. Kept at 0 so the column lines up.
    retries: 0,
    requests: 0,
    errors: [],
    startedAt: Date.now(),
    timeToFirstCardMs: null,
    cardLatencies: [],
    endedAt: null,
    endedBecause: "finished",
  };

  const seen = new Set();
  const buffer = [];
  const buckets = bucketsFor(realm);

  /** One request to the app. Never authenticated — see the header. */
  async function get(path, timeoutMs = 15000) {
    stats.requests++;
    try {
      const res = await fetch(`${base}${path}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
        headers: { accept: "application/json" },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, status: res.status, body: null };
      return { ok: true, status: res.status, body };
    } catch (err) {
      if (signal.aborted) throw err;
      stats.errors.push(`${path.split("?")[0]}: ${String(err?.message ?? err).slice(0, 80)}`);
      return { ok: false, status: 0, body: null };
    }
  }

  /**
   * The feed's `fetchDiscoverBatch` — REFILL_TOPICS buckets in parallel, offsets
   * aligned to the window so two readers on the same stretch share one upstream
   * call. Interleaved on the way out, as the page does.
   */
  async function discoverBatch(limit = DISCOVER_LIMIT) {
    const picks = Array.from({ length: REFILL_TOPICS }, () => pick(rng, buckets));
    const offsets = picks.map(() => randomOffset(rng, 400, limit));
    const batches = await Promise.all(
      picks.map(async (bucket, i) => {
        const r = await get(discoverUrl(realm, { bucket, offset: offsets[i], limit }), 8000);
        const cards = Array.isArray(r.body) ? r.body : [];
        return cards.filter((c) => c?.pageTitle && !seen.has(cardId(c)));
      }),
    );
    const out = [];
    for (let i = 0; ; i++) {
      let any = false;
      for (const b of batches) {
        if (b[i]) {
          out.push(b[i]);
          any = true;
        }
      }
      if (!any) break;
    }
    return out;
  }

  /** Open the first card, exactly as "Surprise me" does. */
  async function seedFirstCard() {
    const batch = await discoverBatch(Math.ceil(SEED_LIMIT / REFILL_TOPICS));
    if (batch.length) {
      buffer.push(...batch.slice(1));
      return batch[0];
    }
    // Encyclopedia alone falls back to the random endpoint; the other realms
    // rely on discover (page:865-878).
    if (realm !== "encyclopedia") return null;
    const r = await get(RANDOM_URL, 10000);
    const cards = Array.isArray(r.body) ? r.body : [];
    if (!cards.length) return null;
    buffer.push(...cards.slice(1));
    return cards[0];
  }

  /**
   * Record one stop. Fire and forget with the bot's own JWT, straight to
   * Supabase — never through the app (lib/billing/meter.ts does the same, and
   * the app has no route for it).
   */
  function recordStop() {
    if (!session?.access_token || !supabase) return;
    void fetch(`${supabase.url}/rest/v1/rpc/record_stop`, {
      method: "POST",
      headers: {
        apikey: supabase.key,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch(() => {
      /* the meter fails open: a lost count never stops a reader */
    });
  }

  const target = sessionLength(rng);
  let card = null;

  try {
    card = await seedFirstCard();
    if (!card) {
      stats.endedBecause = "no seed card";
      stats.endedAt = Date.now();
      return stats;
    }
    stats.timeToFirstCardMs = Date.now() - stats.startedAt;

    while (stats.cards < target && Date.now() < deadline && !signal.aborted) {
      const cardStarted = Date.now();
      seen.add(cardId(card));
      stats.cards++;
      recordStop();

      // Threads and the cross-realm doorway, fired together inside this card's
      // window (page:941-947). The doorway is best-effort: a miss just means no
      // doorway chip.
      const native = card.pageTitle;
      const [rel, door] = await Promise.all([
        get(relatedUrl(realm, native), 12000),
        get(doorwayUrl(realm, native), 12000),
      ]);
      const candidates = (Array.isArray(rel.body) ? rel.body : []).filter(
        (c) => c?.pageTitle && !seen.has(cardId(c)),
      );
      const doorCandidate = door.body?.candidate;

      if (shouldReadMore(rng)) {
        stats.readMores++;
        await get(summaryUrl(realm, native, { extended: true }), 15000);
      }

      stats.cardLatencies.push(Date.now() - cardStarted);
      await sleep(dwellMs(rng, speed), signal);
      if (signal.aborted || Date.now() >= deadline) break;

      // The chips a reader actually sees: at most three in-realm threads plus a
      // doorway when there is one (lib/threads.ts caps at 3).
      const chips = candidates.slice(0, 3);
      if (doorCandidate?.pageTitle && !seen.has(cardId(doorCandidate))) {
        chips.push(doorCandidate);
      }

      const move = chips.length ? chooseMove(rng) : "drift";
      if (move === "back") {
        stats.backs++;
        // Going back costs nothing: the page serves it from its own thread cache
        // (page:511-513). Modelled as a pause, then the loop moves on.
        await sleep(Math.round(dwellMs(rng, speed) * 0.4), signal);
        continue;
      }
      if (move === "thread" && chips.length) {
        stats.threads++;
        card = pick(rng, chips);
        continue;
      }

      stats.drifts++;
      let next = buffer.shift();
      while (next && seen.has(cardId(next))) next = buffer.shift();
      if (!next) {
        stats.refills++;
        const refill = await discoverBatch();
        buffer.push(...refill);
        next = buffer.shift();
      }
      if (!next) {
        // Both discover and the buffer are dry. The page falls back to an
        // untapped thread rather than hammering /api/wiki/random, which is the
        // endpoint Wikimedia burst-limits first (page:1758-1762).
        if (!chips.length) {
          stats.endedBecause = "ran dry";
          break;
        }
        next = pick(rng, chips);
      }
      card = next;
    }
  } catch (err) {
    if (!signal.aborted) {
      stats.endedBecause = `error: ${String(err?.message ?? err).slice(0, 120)}`;
    } else {
      stats.endedBecause = "run ended";
    }
  }

  if (stats.cards >= target) stats.endedBecause = "finished";
  else if (Date.now() >= deadline && stats.endedBecause === "finished") {
    stats.endedBecause = "time up";
  }
  stats.endedAt = Date.now();
  return stats;
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}
