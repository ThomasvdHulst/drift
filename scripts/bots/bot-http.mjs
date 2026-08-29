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
// The sequence below mirrors src/app/(app)/drift/useDriftSession.ts and the
// scroller in drift/ContinuousFeed.tsx. Where it makes a choice the app makes,
// the reason is named, because the value of this driver is entirely in being
// faithful:
//
//   seed ("Surprise me")   REFILL_TOPICS discover calls in parallel; first card
//                          opens, the rest fill the buffer
//   the QUEUE              QUEUE_AHEAD cards are materialised below the reader,
//                          taken from the buffer (a refill costs REFILL_TOPICS
//                          discover calls). Materialising costs a discover slot
//                          and NOTHING else.
//   threads + doorway      for the card being READ and the head of the queue —
//                          one ahead, never for the whole queue. Cached per card
//                          id, so arriving on a prepared card is free.
//   thread pull / cross    the queue is VOID: its cards go back to the buffer,
//                          but the lookahead already fetched for the card at its
//                          head is spent.
//   "Read more"            one extended summary
//
// ⚠️ THE QUEUE IS WHY THIS FILE WAS REWRITTEN IN PHASE 7, and the numbers say why
// it mattered. Measured against the real feed over 11 stops: 1.36 `/related` and
// 1.36 `/doorway` per card, not 1.00 — the excess is lookahead the reader never
// reached, and it amortises with session length (1.15 over 26 cards). Discover
// went the other way, 0.27 against the old feed's ~0.5, because a thread pull now
// hands three cards BACK to the buffer instead of leaving them unfetched. A model
// still fetching exactly one of each per card would have reported a feed nobody
// is running, and the report would have looked healthy while doing it.
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
  QUEUE_AHEAD,
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
    // The HTTP driver never needs to re-press: it calls the API directly, so it
    // is never waiting on a queue that has not refilled yet. Kept at 0 so the
    // column lines up against the browser driver's, where the number is real.
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
    // rely on discover (the seed branch of useDriftSession's session-load effect).
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

  // ----- the queue -----
  //
  // Materialised cards below the reader, exactly as the scroller holds them.
  // They are NOT in the trail and cost nothing but the discover slot that
  // produced them, which is what makes voiding the queue on a thread pull cheap.
  const queue = [];
  // The threads and doorway already fetched for a card, by id. The app's
  // `threadCache` plus `threadsFor`'s one-request-in-flight map: arriving on a
  // card whose chips were prepared costs nothing at all, which is the entire
  // reason the lookahead is free rather than double.
  const chips = new Map();

  const isSpokenFor = (c) =>
    seen.has(cardId(c)) || queue.some((q) => cardId(q) === cardId(c));

  /** Take one servable card out of the buffer, refilling it if it runs dry. */
  async function takeFromBuffer() {
    let next = buffer.shift();
    while (next && isSpokenFor(next)) next = buffer.shift();
    if (next) return next;
    stats.refills++;
    buffer.push(...(await discoverBatch()));
    next = buffer.shift();
    while (next && isSpokenFor(next)) next = buffer.shift();
    return next ?? null;
  }

  /**
   * Top the queue up to QUEUE_AHEAD.
   *
   * ⚠️ MATERIALISING COSTS A DISCOVER SLOT AND NOTHING ELSE. No threads, no
   * doorway — those are fetched for the card being read and one ahead only. All
   * N would take a Gallery screenful from ~9 Met requests to ~45 against a bucket
   * of ~80 per 30 seconds, and modelling it wrongly here would report that as
   * fine (docs/continuous-feed.md §7.2).
   */
  async function fillQueue() {
    while (queue.length < QUEUE_AHEAD) {
      const next = await takeFromBuffer();
      if (!next) return; // the source has nothing: the feed ends on a terminus
      queue.push(next);
    }
  }

  /**
   * The chips for one card: related + doorway, fired together, once per card id.
   *
   * `await`ed for the card being READ and fired without waiting for the head of
   * the queue, because that is what the app does — the reader must not wait on a
   * card they have not reached.
   */
  async function ensureChips(c) {
    const id = cardId(c);
    const have = chips.get(id);
    if (have) return have;
    // Claim the id before the awaits, so the reader arriving on a card the
    // lookahead is still fetching adopts that request instead of starting a
    // second identical one. Without this the preparation is pure waste: measured
    // on the real feed, 14 `/related` and 15 `/doorway` over 13 cards where 12
    // and 12 were needed.
    const pending = (async () => {
      const [rel, door] = await Promise.all([
        get(relatedUrl(realm, c.pageTitle), 12000),
        get(doorwayUrl(realm, c.pageTitle), 12000),
      ]);
      const out = (Array.isArray(rel.body) ? rel.body : [])
        .filter((x) => x?.pageTitle)
        .slice(0, 3);
      // At most three in-realm threads (lib/threads.ts caps there) plus a
      // doorway when there is one.
      const dc = door.body?.candidate;
      if (dc?.pageTitle) out.push(dc);
      return out;
    })();
    chips.set(id, pending);
    return pending;
  }

  /** The chips a reader can actually pull: never one already on their trail. */
  const pullable = (list) => list.filter((c) => !seen.has(cardId(c)));

  /**
   * A thread pull or a realm cross voids the queue.
   *
   * The cards go BACK to the buffer rather than being thrown away — they cost
   * real upstream requests, and returning them is the difference between a
   * thread pull being free and it costing three cards of the Met's daily budget
   * (lib/feedqueue.invalidateQueue). What is genuinely spent is the lookahead
   * already fetched for the card at the head, which is cached against its id and
   * is only wasted if that card is never served again.
   */
  function voidQueue() {
    buffer.unshift(...queue.splice(0));
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

      // The queue hangs under the reader and is topped up as they move.
      await fillQueue();

      // This card's chips, and the next card's — one ahead, fired but not waited
      // on, so the reader's dwell is never spent on a card they have not reached.
      const mine = pullable(await ensureChips(card));
      if (queue[0]) void ensureChips(queue[0]);

      if (shouldReadMore(rng)) {
        stats.readMores++;
        await get(summaryUrl(realm, card.pageTitle, { extended: true }), 15000);
      }

      stats.cardLatencies.push(Date.now() - cardStarted);
      await sleep(dwellMs(rng, speed), signal);
      if (signal.aborted || Date.now() >= deadline) break;

      const move = mine.length ? chooseMove(rng) : "drift";
      if (move === "back") {
        stats.backs++;
        // Scrolling back up costs nothing: the card is already rendered and its
        // chips are already cached. It also stops the queue being refilled at
        // all, since only the TIP may fill it — modelled as a pause, which is
        // what it is.
        await sleep(Math.round(dwellMs(rng, speed) * 0.4), signal);
        continue;
      }
      if (move === "thread" && mine.length) {
        stats.threads++;
        voidQueue();
        card = pick(rng, mine);
        continue;
      }

      // A drift is scrolling onto the card already waiting below. It costs
      // nothing at the moment it happens; the cost was the discover slot that
      // materialised it, and the next `fillQueue` is what pays for the one after.
      stats.drifts++;
      const next = queue.shift();
      if (next) {
        card = next;
        continue;
      }
      // The queue is empty, so discover and the buffer are both dry. The feed
      // falls back to an untapped thread of the card on screen rather than
      // hammering /api/wiki/random, which is the endpoint Wikimedia burst-limits
      // first; with nothing there either it places an ending and stops.
      if (!mine.length) {
        stats.endedBecause = "ran dry";
        break;
      }
      card = pick(rng, mine);
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
