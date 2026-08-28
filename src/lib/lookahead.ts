import type { Card } from "./types";
import { cardId } from "./card";
import { realmOfSource } from "./crossrealm";
import type { RealmId } from "./realms/types";

// ---------------------------------------------------------------------------
// Lookahead into the drift buffer (continuous feed, Phase 0).
//
// The buffer has always been read DESTRUCTIVELY: `takeBufferedRandom` shifted
// entries off the front until it found one worth serving and dropped the rest.
// That is still exactly right for serving a card. What Phase 0 adds is a
// second, NON-destructive question — "which card would the next drift serve?" —
// so the feed can warm that card's picture and threads while the reader is
// still on this one.
//
// Both questions must be answered by the SAME predicate. A peek that disagreed
// with the take would warm one card and then show a different one: the reader
// would see no improvement, and the only visible symptom would be an
// unexplained rise in the upstream request counts. So the predicate lives here,
// once, and both callers go through it — the same reasoning that put Met
// parameter ordering inside `searchIds` rather than in each caller.
//
// Pure: no React, no DOM, no network (CLAUDE.md §8.4).
// ---------------------------------------------------------------------------

/** Anything the drift buffer holds: a card, plus whatever the caller tags it
 *  with (the topic it came from, why that topic was chosen). */
export interface BufferEntry {
  card?: Card;
}

/**
 * May this entry be served right now?
 *
 * The realm condition is the non-obvious one. The buffer can hold leftovers
 * from the other side of a realm crossing — `crossRealm` deliberately seeds it
 * with the destination realm's batch so the first drifts after a cross are
 * instant — and serving one of those later would put a Gallery card in the
 * middle of an Encyclopedia drift.
 */
export function isServable(
  entry: BufferEntry | undefined,
  seen: Set<string>,
  realm: RealmId,
): boolean {
  const card = entry?.card;
  if (!card?.pageTitle) return false;
  if (seen.has(cardId(card))) return false;
  return realmOfSource(card.source) === realm;
}

/** Where the first servable entry sits, or -1 when there is none. */
export function firstServableIndex<T extends BufferEntry>(
  items: readonly T[],
  seen: Set<string>,
  realm: RealmId,
): number {
  for (let i = 0; i < items.length; i++) {
    if (isServable(items[i], seen, realm)) return i;
  }
  return -1;
}

/** The entry the next drift would serve, WITHOUT consuming it. */
export function peekServable<T extends BufferEntry>(
  items: readonly T[],
  seen: Set<string>,
  realm: RealmId,
): T | null {
  const i = firstServableIndex(items, seen, realm);
  return i < 0 ? null : items[i];
}

/**
 * Take the next servable entry, mutating `items` in place.
 *
 * Everything passed over on the way is DISCARDED, and so is the whole buffer
 * when nothing in it is servable. That is precisely the behaviour of the
 * shift-loop this replaces, and it is deliberate rather than incidental: an
 * entry that is already seen, or belongs to the other realm, can never become
 * servable again, so keeping it would only make every future lookahead walk
 * past it.
 */
export function takeServable<T extends BufferEntry>(
  items: T[],
  seen: Set<string>,
  realm: RealmId,
): T | null {
  const i = firstServableIndex(items, seen, realm);
  if (i < 0) {
    items.length = 0;
    return null;
  }
  const entry = items[i];
  items.splice(0, i + 1);
  return entry;
}

/**
 * How many entries could still be served.
 *
 * The low-water mark for a background refill counts THESE, not `length`: a
 * buffer holding twelve cards you have already read is an empty buffer, and
 * measuring it by length would let the feed run itself dry while believing it
 * was full.
 */
export function servableCount<T extends BufferEntry>(
  items: readonly T[],
  seen: Set<string>,
  realm: RealmId,
): number {
  let n = 0;
  for (const item of items) if (isServable(item, seen, realm)) n++;
  return n;
}
