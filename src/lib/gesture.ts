// Pure decision helpers for the drift feed's gestures. The feed's touch and
// wheel handlers (src/app/(app)/drift/ContinuousFeed.tsx) read the raw deltas
// and delegate the decision here, so the fiddly edge logic stays React/DOM-free
// and unit-testable (CLAUDE.md §8.4).
//
// ⚠️ THIS FILE ONCE SAID "the browser answers that question", AND THAT SENTENCE
// WAS THE BUG. It was written when Phase 7 deleted `resolveSwipe`, `edgesOf` and
// `isWheelReadingScroll` — the helpers that used to decide "is this swipe the
// reader scrolling the article, or overscrolling past its end to advance?" — on
// the reasoning that a native scroll-snap scroller plus `overscroll-behavior` on
// the reading region made the question the browser's. (Deleting them rather than
// leaving them exported and uncalled was right, and is not what went wrong; the
// pre-Phase-7 audit found that shape three times over.)
//
// Chrome and Firefox do answer it. **WebKit does not.** From WebKit's own
// scrolling documentation (https://trac.webkit.org/wiki/Scrolling):
//
//   "Latching describes the fact that during a single scroll interaction, only
//    one scrollable area moves. If, in one gesture, you hit the scrollable
//    extent, we don't start scrolling the containing scroller in that gesture.
//    Instead, we'll rubber-band, and the user has to start a new gesture to get
//    the enclosing scroller to scroll."
//
// So on an iPhone, reaching the end of a card's text and pulling further does
// nothing at all, and it took two to four separate gestures to move on. Measured
// on a phone-sized production build: EVERY collapsed Encyclopedia card overflows
// its reading region (18 of 18, by 175 to 685px depending on the device), so
// this is not a rare corner — it is every card.
//
// `edgePull` below is the answer, as a POLYFILL rather than as a replacement:
// it stands down the moment it sees the outer scroller move on its own, so on
// the engines that chain natively nothing here fires and nothing changes. See
// docs/continuous-feed.md §8.11.

/** A scroll region's edge state, derived from its scroll measurements. A region
 *  that can't scroll (content fits) is treated as being at BOTH edges, so a card
 *  with little text still swipes freely in either direction. */
export type Edges = { scrollable: boolean; atTop: boolean; atBottom: boolean };

/** Tolerance (px) so sub-pixel rounding / browser zoom doesn't hide an edge. */
const EDGE_EPSILON = 2;

export function edgesOf(m: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}): Edges {
  const scrollable = m.scrollHeight > m.clientHeight + EDGE_EPSILON;
  if (!scrollable) return { scrollable: false, atTop: true, atBottom: true };
  const atTop = m.scrollTop <= EDGE_EPSILON;
  const atBottom = m.scrollTop + m.clientHeight >= m.scrollHeight - EDGE_EPSILON;
  return { scrollable, atTop, atBottom };
}

/**
 * How far past the reading region's edge the gesture must carry before the feed
 * takes it over.
 *
 * The card-at-a-time feed used 50px, but it measured from a STANDING START: the
 * region had to be at its edge when the finger went down, and then any 50px
 * swipe advanced. This budget accrues only AFTER the edge is reached, so the
 * finger has usually already spent travel getting there and the same number
 * would be much twitchier. 96px is a continued, deliberate pull.
 *
 * ⚠️ THIS IS THE ONE NUMBER TO TUNE ON A REAL DEVICE, and the trade it makes is
 * worth knowing before changing it. A hard flick that bottoms out with 96px to
 * spare now carries the reader past the thread chips at the end of the card.
 * That is exactly what Chrome has always done here, and scrolling back up
 * returns to that card with its chips on screen. If it turns out to grate, the
 * dial is either a bigger number or restoring the old `atBottomStart` rule
 * (accrue only when the region was ALREADY pinned as the finger went down),
 * which makes reading flicks never advance at the cost of always needing a
 * second gesture.
 */
export const PULL_THRESHOLD = 96;

/**
 * How far the OUTER scroller may move before we conclude the browser is doing
 * the chaining itself and get out of the way.
 *
 * ⚠️ THIS GUARD IS THE WHOLE REASON THIS IS SAFE TO SHIP. Chrome and Android
 * start chaining within about 20px of the region pinning, so the budget above
 * can never fill before this trips and the polyfill is inert on those engines.
 * WebKit latches, so its outer scroller cannot move during the gesture at all
 * and the budget does fill. Remove this and every chaining browser gets two
 * mechanisms driving one scroller.
 */
export const CHAIN_SLACK = 8;

/**
 * A wheel burst that has gone quiet for this long is a new gesture.
 *
 * Trackpad momentum keeps firing `wheel` events after the fingers lift, which is
 * the false-advance that the old feed's "measure the edge at the START of the
 * gesture" rule existed to prevent. Touch does not need this (momentum produces
 * no `touchmove`), so it is a wheel-only concern.
 */
export const WHEEL_QUIET_MS = 200;

/** The wheel's own budget. Deltas are far coarser than finger pixels — one mouse
 *  notch is ~100 — so the touch threshold would trip on a single flick. */
export const WHEEL_THRESHOLD = 240;

/** What one gesture has accrued against the reading region's edge. Opaque to the
 *  caller, which only stores it and hands it back. */
export type PullState = { pull: number; outerAt: number | null; fired: boolean };

/** A gesture that has not yet touched an edge. */
export const NO_PULL: PullState = { pull: 0, outerAt: null, fired: false };

export type PullAction = "forward" | "back" | "none";

/**
 * One step of the scroll-chaining polyfill, called per `touchmove` or `wheel`.
 *
 * `dy` is the movement since the last event, positive meaning "onward" (finger
 * travelling UP the screen, or a wheel scrolling DOWN the page). `outerTop` is
 * the feed scroller's current `scrollTop`, which is how we tell a latching
 * browser from a chaining one. `totalX`/`totalY` are the whole gesture's travel
 * and lock the axis so this never competes with the realm cross; omit them where
 * there is no axis to lock (the wheel).
 */
export function edgePull(
  state: PullState,
  input: {
    dy: number;
    atTop: boolean;
    atBottom: boolean;
    outerTop: number;
    totalX?: number;
    totalY?: number;
    threshold?: number;
    slack?: number;
  },
): { next: PullState; action: PullAction } {
  const threshold = input.threshold ?? PULL_THRESHOLD;
  const slack = input.slack ?? CHAIN_SLACK;

  // Pinned against the edge we are travelling towards? A region that can still
  // move in this direction is the reader READING, and reading never accrues.
  const pinned =
    (input.dy > 0 && input.atBottom) || (input.dy < 0 && input.atTop);
  if (!pinned) {
    // Reversing, or scrolling back into the middle of the article, discards the
    // budget outright — a wobbling thumb must never add up to a card.
    return { next: { ...state, pull: 0, outerAt: null }, action: "none" };
  }

  const next: PullState = {
    pull: state.pull + input.dy,
    // Where the feed stood when the region first pinned. Everything after this
    // is measured against it.
    outerAt: state.outerAt ?? input.outerTop,
    fired: state.fired,
  };

  if (state.fired) return { next, action: "none" };
  if (Math.abs(next.pull) < threshold) return { next, action: "none" };
  // The browser is chaining on its own. Stand down, and stay down: `outerAt` is
  // fixed at the pinning point and the region stays pinned for the whole of a
  // chaining gesture (it is at its extent, which is why the browser chained), so
  // this cannot flicker back off if the chain runs into its own snap boundary.
  if (next.outerAt !== null && Math.abs(input.outerTop - next.outerAt) > slack) {
    return { next, action: "none" };
  }
  // Sideways gestures belong to `resolveHorizontalSwipe`, which settles them at
  // touchend. This is the same axis lock seen from the other side.
  if (
    input.totalX !== undefined &&
    input.totalY !== undefined &&
    Math.abs(input.totalX) > Math.abs(input.totalY)
  ) {
    return { next, action: "none" };
  }

  return {
    next: { ...next, fired: true },
    action: next.pull > 0 ? "forward" : "back",
  };
}

/** Decide whether a finished swipe was a HORIZONTAL realm-cross (Phase 15) rather
 *  than a vertical scroll. Axis-locked: it only counts as a cross when the
 *  horizontal movement clearly dominates the vertical one AND clears the
 *  threshold, so it never competes with the scroller's own vertical panning
 *  (which is why the scroller carries `touch-action: pan-y`). `deltaX` = endX −
 *  startX (sign is irrelevant — either direction crosses). */
export function resolveHorizontalSwipe(opts: {
  deltaX: number;
  deltaY: number;
  threshold?: number;
  dominance?: number;
}): "cross" | "none" {
  const threshold = opts.threshold ?? 60;
  const dominance = opts.dominance ?? 1.5;
  const ax = Math.abs(opts.deltaX);
  const ay = Math.abs(opts.deltaY);
  if (ax < threshold) return "none";
  if (ax < ay * dominance) return "none"; // too vertical — leave it to the scroller
  return "cross";
}
