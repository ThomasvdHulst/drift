import type { ArrivedVia, Card } from "./types";
import type { Focus } from "./focus";
import type { RealmId } from "./realms/types";
import { cardId } from "./card";
import { isServable } from "./lookahead";

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
// Pure: no React, no DOM, no network (CLAUDE.md §8.4). Nothing here is wired up
// yet; the scroller that consumes it arrives in Phase 3.
// ---------------------------------------------------------------------------

/** Why the feed has stopped producing cards. Each becomes a real, full-screen
 *  card at the end of the scroll rather than a toast that appears wherever the
 *  reader happens to be — see docs/continuous-feed.md §6.5. */
export type TerminusReason =
  /** A field, an orbit or an artist's work read dry, widening included. */
  | "pool-dry"
  /** An "in the news" section whose stories AND their neighbourhood are read. */
  | "caught-up"
  /** The day's allowance is spent. This one ends in the trail map. */
  | "day-done";

/** One thing occupying one full screen of the scroller. */
export type FeedItem =
  /** A committed stop: it is in the trail, at `history[index]`. */
  | { kind: "step"; index: number }
  /** Materialised but NOT committed. Discardable without trace. */
  | { kind: "queued"; id: string; card: Card; via: ArrivedVia }
  /** The calm ad interstitial (Phase 21), off by default. */
  | { kind: "ad" }
  /** The end of the road, and why. */
  | { kind: "terminus"; reason: TerminusReason };

export type QueuedItem = Extract<FeedItem, { kind: "queued" }>;

export function isStep(i: FeedItem): i is Extract<FeedItem, { kind: "step" }> {
  return i.kind === "step";
}
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

/**
 * May this card be materialised into the queue right now?
 *
 * Extends `isServable` (unseen, well-formed, in the realm being read) with the
 * one dimension the queue adds: not already spoken for. Built on that function
 * rather than repeating it, so the discrete feed's buffer and the continuous
 * feed's queue can never disagree about what a servable card is.
 */
export function isCandidate(
  card: Card | undefined,
  seen: Set<string>,
  pending: Set<string>,
  realm: RealmId,
): boolean {
  if (!isServable({ card }, seen, realm)) return false;
  return !pending.has(cardId(card!));
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
 * The day always wins: an allowance that ran out inside a news section is the
 * day ending, not the section, and saying "you are caught up" there would be
 * telling the reader the wrong thing about why the feed stopped.
 */
export function terminusReason(opts: {
  focusKind?: Focus["kind"] | null;
  dayDone: boolean;
}): TerminusReason {
  if (opts.dayDone) return "day-done";
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

/** Is the feed already showing an ending? */
export function hasTerminus(queue: readonly FeedItem[]): boolean {
  return queue.some(isTerminus);
}

/** How many real cards are waiting. Drives the low-water refill, and counts
 *  only `queued` — an ad or a terminus is not a card the reader can go on to. */
export function queuedCount(queue: readonly FeedItem[]): number {
  return queue.reduce((n, i) => (isQueued(i) ? n + 1 : n), 0);
}
