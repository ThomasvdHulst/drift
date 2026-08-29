import type { ArrivedVia, Card } from "./types";
import type { Focus } from "./focus";
import { cardId } from "./card";

// ---------------------------------------------------------------------------
// The continuous feed's queue (Phase 2 of docs/continuous-feed.md).
//
// THE ONE IDEA. A card-at-a-time feed can fuse "this card exists" with "the
// reader arrived on it", because only one card is ever on screen. A continuous
// feed cannot: it must put a card in the DOM BEFORE anyone has seen it. So the
// moment splits in two, and this module owns the boundary between them.
//
//   MATERIALISE                          COMMIT
//   a card is chosen and rendered         the reader actually arrives
//   below the tip. Costs an upstream      (>=75% visible, briefly held). Costs a
//   fetch and a DOM node, and NOTHING     trail step, a `seen` entry, a metered
//   else.                                 stop, a door on the card being left.
//
// **AN UNCOMMITTED CARD HAS NOT HAPPENED.** It is not in the trail, not in
// `seen`, not counted by the meter. That is what makes every hard case easy:
// pulling a thread, crossing realms and changing focus all just throw the queue
// away, and there is nothing to undo because nothing was ever written down.
//
// Pure: no React, no DOM, no network (CLAUDE.md §8.4). The scroller that
// consumes it is drift/ContinuousFeed.tsx.
// ---------------------------------------------------------------------------

/** Why the feed has stopped producing cards. Each becomes a real, full-screen
 *  card at the end of the scroll rather than a toast that appears wherever the
 *  reader happens to be — see docs/continuous-feed.md §6.5. */
export type TerminusReason =
  /** A field, an orbit or an artist's work read dry, widening included. */
  | "pool-dry"
  /** An "in the news" section whose stories AND their neighbourhood are read. */
  | "caught-up"
  /**
   * We could not REACH the source. Not the same thing as reading it dry, and
   * conflating the two is a lie the reader can catch.
   *
   * ⚠️ THIS EXISTS BECAUSE THE FEED USED TO SAY "you have read this area dry"
   * AT A 503. Measured: with the upstream answering 503, the scroller became
   * `step:0 | terminus:pool-dry` within six seconds, on a free drift over the
   * whole of Wikipedia — and stayed there after the source recovered, because
   * nothing retried. A dry pool is final; an unreachable source is a pause, so
   * this one is the only ending that RETRIES and clears itself.
   */
  | "source-quiet"
  /** The day's allowance is spent. This one ends in the trail map. */
  | "day-done";

/** One thing occupying one full screen of the scroller. */
export type FeedItem =
  /** A committed stop: it is in the trail, at `history[index]`. */
  | { kind: "step"; index: number }
  /** Materialised but NOT committed. Discardable without trace. */
  | { kind: "queued"; id: string; card: Card; via: ArrivedVia }
  /**
   * The calm ad interstitial (Phase 21), off by default.
   *
   * ⚠️ IT CARRIES AN ID FOR THE SAME REASON A CARD DOES. The slot key used to be
   * the ad's INDEX in the queue, which changes every time something above it
   * commits — so the ad unmounted and remounted under the reader. Harmless for
   * the house placeholder; in `adsense` mode a remount asks Google for another
   * impression of an ad nobody scrolled to.
   */
  | { kind: "ad"; id: string }
  /** The end of the road, and why. */
  | { kind: "terminus"; reason: TerminusReason };

export type QueuedItem = Extract<FeedItem, { kind: "queued" }>;

// ⚠️ THERE WAS AN `isStep` HERE AND IT WAS CALLED FROM NOWHERE AT ALL. Exported,
// type-safe, obvious — and consulted by neither this module, the scroller nor a
// test, which is the exact shape the pre-Phase-7 audit deleted three times over
// (§8.7: "a defence the documentation calls load-bearing and the code never
// consults is worse than no defence, because it stops anyone looking"). The
// scroller asks `item.kind === "step"` where it needs to. `isQueued` and
// `isTerminus` below are both genuinely used; this one was not.
export function isQueued(i: FeedItem): i is QueuedItem {
  return i.kind === "queued";
}
export function isTerminus(
  i: FeedItem,
): i is Extract<FeedItem, { kind: "terminus" }> {
  return i.kind === "terminus";
}

/** Build a queued item. The id is the card id, so the queue and the thread
 *  cache and the `seen` set all speak about a card the same way. */
export function queuedItem(card: Card, via: ArrivedVia): QueuedItem {
  return { kind: "queued", id: cardId(card), card, via };
}

// ---------------------------------------------------------------------------
// Committing
// ---------------------------------------------------------------------------

/** How much of an item must be on screen before the reader has "arrived". */
export const COMMIT_RATIO = 0.75;

/**
 * How long it must STAY there.
 *
 * ⚠️ WITHOUT THIS, ONE FLING RECORDS SIX STOPS. `scroll-snap-stop: always` makes
 * the browser stop at every snap point even during a fast swipe, which is a
 * feature — no card can be skipped — but it means visibility alone would report
 * every card the fling passed through as a stop the reader made. A card
 * genuinely glimpsed for 200 ms was not a stop, and counting it would put
 * phantom cards in the trail and phantom draws against the day's allowance.
 *
 * Exported so Phase 3 can tune it against a measurement rather than a feeling.
 */
export const COMMIT_SETTLE_MS = 300;

/**
 * Has this item been arrived at? The single question the whole two-phase model
 * turns on, so it is one function with one answer.
 *
 * Written so that a NaN ratio (an observer entry for a detached node) is false
 * rather than accidentally true.
 */
export function commitDecision(opts: {
  /** Fraction of the item inside the scroller, 0 to 1. */
  ratio: number;
  /** How long it has been continuously at or above COMMIT_RATIO. */
  visibleMs: number;
  /** Already committed once. A card is committed exactly once, ever. */
  committed: boolean;
}): boolean {
  if (opts.committed) return false;
  if (!(opts.ratio >= COMMIT_RATIO)) return false;
  return opts.visibleMs >= COMMIT_SETTLE_MS;
}

// ---------------------------------------------------------------------------
// How much may be queued
// ---------------------------------------------------------------------------

/**
 * How many cards may sit below the one being read.
 *
 * Three, and the number is an argument rather than a taste: it is one screen of
 * lookahead plus two, it keeps a Gallery rebuild (queue discarded, refetched)
 * inside the Met's measured burst allowance of ~30 requests per 15 seconds, and
 * it is small enough that the floor of the feed stays visible — which is the
 * §2 argument, not a performance one. See docs/continuous-feed.md §7.4.
 */
export const QUEUE_AHEAD = 3;

/**
 * The capacity, clamped by what the day has left.
 *
 * ⚠️ THE CLAMP IS NOT AN OPTIMISATION. Without it the feed materialises cards
 * the reader is not allowed to reach: it spends Wikimedia and Met budget on
 * nothing, and it dangles content behind a limit, which is the exact dynamic
 * principle §2 exists to prevent. With it, the queue shrinks to zero as the day
 * closes and the last card is followed by the trail map, so the reader scrolls
 * into the end of the day instead of being yanked out of the feed.
 *
 * FAILS OPEN, like everything that touches the meter (CLAUDE.md §4): a `null`
 * remaining count means "we could not look", and an unmetered reader gets the
 * full depth. `lib/limits.ts` returns exactly that null.
 */
export function queueCapacity(opts: {
  ahead?: number;
  stopsRemaining: number | null;
}): number {
  const ahead = Math.max(0, Math.floor(opts.ahead ?? QUEUE_AHEAD));
  if (opts.stopsRemaining === null) return ahead;
  if (!Number.isFinite(opts.stopsRemaining)) return ahead;
  return Math.max(0, Math.min(ahead, Math.floor(opts.stopsRemaining)));
}

// ---------------------------------------------------------------------------
// What may be queued
// ---------------------------------------------------------------------------

/**
 * The ids the queue has already spoken for.
 *
 * ⚠️ DERIVED, NEVER TRACKED, AND THAT IS THE WHOLE POINT.
 * docs/continuous-feed.md §8.7 calls a separate pending set the likeliest bug in
 * this project: an id added on materialise and forgotten on discard either
 * leaks (the card can never be served again) or duplicates (the card is queued
 * twice). Reading the ids out of the queue itself makes both impossible —
 * dropping an item IS releasing its id, in the same statement, with no second
 * bookkeeping step that can be missed.
 *
 * It is deliberately NOT the same thing as `seen`. `seen` means "the reader has
 * read this"; pending means "this is spoken for right now". A discarded card
 * must become available again, which is exactly what happens here for free.
 */
export function pendingIds(queue: readonly FeedItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of queue) if (isQueued(item)) ids.add(item.id);
  return ids;
}

// ---------------------------------------------------------------------------
// Changing the queue
// ---------------------------------------------------------------------------

/**
 * Throw the queue away, handing back what was in it.
 *
 * Called when the reader steers: a thread pulled, a realm crossed, a focus
 * entered, released or widened. Every one of those changes the promise the
 * queued cards were chosen under, and a card chosen under one promise must
 * never be shown under another (§2.1) — so there is no partial case here, and
 * no `reason` argument, because the answer is the same for all of them.
 *
 * `dropped` is not a courtesy. Those cards cost real upstream requests, and the
 * caller should return them to the discover buffer rather than lose them: a
 * thread pull would otherwise throw away three cards' worth of the Met's daily
 * budget every time. They are safe to reuse precisely because they were never
 * committed — nothing recorded that the reader saw them.
 */
export function invalidateQueue(queue: readonly FeedItem[]): {
  queue: FeedItem[];
  dropped: QueuedItem[];
} {
  return { queue: [], dropped: queue.filter(isQueued) };
}

/**
 * Commit the queued card the reader has settled on, IN ORDER.
 *
 * The ordinary answer is the boring one: the item is the first in the queue, it
 * commits, and `skipped` is empty.
 *
 * ⚠️ THE INTERESTING CASE IS A PLATFORM LETTING A FLICK SKIP CARDS, WHICH IS
 * REAL. `scroll-snap-stop: always` is supposed to halt a fast swipe at every
 * snap point, and on Blink it does; WebKit has historically sent a hard flick
 * straight to the END of a snap container instead
 * (github.com/bvaughn/react-window/issues/290). The bounded queue keeps the
 * blast radius at three cards rather than three hundred, but the model still has
 * to be correct when it happens, because a trail that silently gained two stops
 * the reader never saw is exactly the dishonesty §2 is about.
 *
 * So the cards passed over are NOT committed and NOT lost: they come back as
 * `skipped`, for the caller to return to the discover buffer. They cost real
 * upstream requests and they were never read, so putting them back in the pile
 * is both cheap and true.
 *
 * Removing them from the queue is scroll-safe for the one reason everything
 * else in this design is: every item is exactly one viewport tall, so the caller
 * can compensate with `scrollTop -= removed * itemHeight` exactly.
 *
 * ⚠️ COMPENSATE WITH `removed`, NEVER WITH `skipped.length` — they are different
 * numbers and the difference is a real displacement. `skipped` is what goes back
 * to the discover buffer, so it holds only CARDS; an ad interstitial passed over
 * on the way is removed from the queue too but is not something to re-serve, so
 * it is absent from `skipped`. The caller used to compensate with
 * `skipped.length` and therefore under-corrected by exactly one item-height per
 * ad. Worked through, with an ad above the committed card:
 * `[step0, step1, ad, qA, qB, qC]`, a flick from step1 to qB, is 3 slots removed
 * above the reader and 1 reported — they land on qC, an uncommitted card they
 * never scrolled to, which then commits 300 ms later. That is a phantom stop in
 * the trail, which is precisely what the two-phase model exists to prevent.
 * (An ending can never be above the committed card: `clearTerminus` runs before
 * anything is pushed, so an ad is the only case — but `removed` is right for
 * both and does not have to know which.)
 *
 * Returns `committed: null` when the id is not a queued item at all (a step, an
 * ad, an ending, or already gone), and changes nothing.
 */
export function commitAt(
  queue: readonly FeedItem[],
  id: string,
): {
  queue: FeedItem[];
  committed: QueuedItem | null;
  skipped: QueuedItem[];
  /** How many SLOTS vanished from above the committed one. The committed item
   *  itself is not counted: it leaves the queue but stays on screen as a trail
   *  step, in the same place. This is the number to move `scrollTop` by. */
  removed: number;
} {
  const at = queue.findIndex((i) => isQueued(i) && i.id === id);
  if (at < 0) return { queue: [...queue], committed: null, skipped: [], removed: 0 };
  const committed = queue[at] as QueuedItem;
  const before = queue.slice(0, at);
  return {
    // Everything up to and including the committed item leaves the queue: the
    // committed one becomes a trail step, the skipped ones go back to the pile.
    queue: queue.slice(at + 1),
    committed,
    // Only real cards can be handed back. An ad or an ending scrolled past is
    // not something to re-serve.
    skipped: before.filter(isQueued),
    removed: before.length,
  };
}

/**
 * Shrink the queue to `capacity`, dropping from the END.
 *
 * From the end because the front is what the reader is about to reach. This is
 * how the day closing makes the feed run out under the reader's thumb rather
 * than in front of it.
 */
export function trimToCapacity(
  queue: readonly FeedItem[],
  capacity: number,
): { queue: FeedItem[]; dropped: QueuedItem[] } {
  const cap = Math.max(0, Math.floor(capacity));
  const kept: FeedItem[] = [];
  const dropped: QueuedItem[] = [];
  let queuedSoFar = 0;
  for (const item of queue) {
    if (!isQueued(item)) {
      kept.push(item);
      continue;
    }
    if (queuedSoFar < cap) {
      kept.push(item);
      queuedSoFar++;
    } else {
      dropped.push(item);
    }
  }
  return { queue: kept, dropped };
}

/**
 * Put a card the reader's ♥ asked for next, WITHOUT replacing anything.
 *
 * Liking a card means "keep me in this stream", and in the card-at-a-time feed
 * the next drift simply followed one of that card's threads (lib/drift.ts). With
 * a queue the next card already exists, so the like inserts instead.
 *
 * ⚠️ IT INSERTS, IT NEVER OVERWRITES. `firstMutableIndex` is the first slot the
 * reader has not begun to reveal, and nothing at or before it is touched.
 * Swapping a card out from under someone's eye while they are looking at it is
 * exactly the dishonesty §2.1 forbids — and it is free to shift instead, because
 * queued cards cost nothing to move.
 *
 * A card already queued is left where it is rather than duplicated.
 */
export function insertAfterLike(
  queue: readonly FeedItem[],
  item: QueuedItem,
  opts: { firstMutableIndex?: number } = {},
): FeedItem[] {
  if (pendingIds(queue).has(item.id)) return [...queue];
  const at = Math.min(
    Math.max(0, Math.floor(opts.firstMutableIndex ?? 0)),
    queue.length,
  );
  return [...queue.slice(0, at), item, ...queue.slice(at)];
}

// ---------------------------------------------------------------------------
// Ending
// ---------------------------------------------------------------------------

/**
 * Which ending this is.
 *
 * The order is the whole content of this function, so it is worth stating:
 *
 *   day-done      the allowance ran out. It outranks everything, because an
 *                 allowance spent inside a news section is the DAY ending, not
 *                 the section, and "you are caught up" would be the wrong
 *                 answer to "why did it stop?".
 *   source-quiet  we could not reach the source. It outranks the two "you have
 *                 read it all" endings for the same reason in reverse: we do
 *                 not KNOW that anything is exhausted, only that nobody
 *                 answered. Claiming otherwise is a lie the reader can catch by
 *                 reloading.
 *   caught-up     an "in the news" section, read along with its neighbourhood.
 *   pool-dry      everything else the reader has genuinely read to the end of.
 */
export function terminusReason(opts: {
  focusKind?: Focus["kind"] | null;
  dayDone: boolean;
  /** True when the last refill FAILED rather than came back empty-handed. */
  sourceQuiet?: boolean;
}): TerminusReason {
  if (opts.dayDone) return "day-done";
  if (opts.sourceQuiet) return "source-quiet";
  return opts.focusKind === "current" ? "caught-up" : "pool-dry";
}

/**
 * Append the ending card, once.
 *
 * Idempotent because a refill can come back empty several times in a row, and a
 * scroller with three "you are caught up" cards stacked at the bottom would be
 * both silly and untrue. An ending of a DIFFERENT kind replaces the one there
 * (the day closing over an exhausted pool is still the day closing).
 */
export function appendTerminus(
  queue: readonly FeedItem[],
  reason: TerminusReason,
): FeedItem[] {
  const withoutEnd = queue.filter((i) => !isTerminus(i));
  return [...withoutEnd, { kind: "terminus", reason }];
}

/**
 * Take the ending away again.
 *
 * ⚠️ A REAL CARD ARRIVING MUST REMOVE THE ENDING, NOT QUEUE UP BEHIND IT. The
 * refill used to push onto the end of the queue whatever was already there, so
 * a card that arrived after an ending was placed landed BELOW it — measured:
 * `step:0 | queued:met:254779 | terminus:pool-dry | queued:… | queued:…`, a
 * reader scrolling past "you have read this area dry" into two more cards. The
 * ending is a statement about right now, and the moment it stops being true it
 * has to go.
 */
export function clearTerminus(queue: readonly FeedItem[]): FeedItem[] {
  return queue.filter((i) => !isTerminus(i));
}

/** Is the feed already showing an ending? */
export function hasTerminus(queue: readonly FeedItem[]): boolean {
  return queue.some(isTerminus);
}

/** How many real cards are waiting. Drives the low-water refill, and counts
 *  only `queued` — an ad or a terminus is not a card the reader can go on to. */
export function queuedCount(queue: readonly FeedItem[]): number {
  return queue.reduce((n, i) => (isQueued(i) ? n + 1 : n), 0);
}
