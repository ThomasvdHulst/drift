import type { Card } from "./types";
import { cardId } from "./card";
import { realmOfSource } from "./crossrealm";
import type { RealmId } from "./realms/types";

// ---------------------------------------------------------------------------
// Reading the drift buffer (continuous feed, Phase 0).
//
// The buffer is read DESTRUCTIVELY: `takeBufferedRandom` shifts entries off the
// front until it finds one worth serving and drops the rest. One predicate
// decides "worth serving", it lives here, and every caller goes through it —
// the same reasoning that put the Met's parameter ordering inside `searchIds`
// rather than in each caller.
//
// ⚠️ THERE WAS A NON-DESTRUCTIVE `peekServable` HERE AND IT WENT WITH THE THING
// THAT ASKED THE QUESTION. Phase 0 added it so the engine could warm the picture
// and chips of "the card the next drift would serve" while the reader was still
// on this one, and this comment used to explain at length why the peek and the
// take had to share a predicate. The scroller made the question meaningless:
// `fill` takes cards OUT of this buffer to materialise them, so the buffer's
// head is not the next card any more, it is the one after the whole queue —
// four below the reader. That lookahead is deleted (docs/continuous-feed.md
// §4.10 finding 22), and the peek went with it rather than being left exported,
// unit-tested and called by nobody, which is the shape the pre-Phase-7 audit
// found three times over in `feedqueue` (§8.7).
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
