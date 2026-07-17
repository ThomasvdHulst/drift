// Pure decision helpers for the drift feed's "read, then overscroll to advance"
// gesture model. The feed's wheel/touch handlers (src/app/drift/page.tsx) read
// the card scroll region's DOM measurements and delegate the actual decision
// here, so the fiddly edge logic stays React/DOM-free and unit-testable
// (CLAUDE.md §5). See plan: zippy-pondering-cook.

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

export type SwipeAction = "advance" | "back" | "none";

/** Decide what a finished vertical swipe should do.
 *  `deltaY` = startY − endY  (positive = swiped UP = intent to advance).
 *  When the swipe happened inside the card's scroll region we only advance/back
 *  by "overscrolling" past an edge (measured at the START of the gesture, so iOS
 *  momentum after touchend can't cause a false advance) — otherwise the swipe was
 *  the user reading, so we return "none" and let the browser's native scroll
 *  stand. A swipe that began outside any scroll region (the threads bar, the
 *  desktop image panel, gaps) advances/back directly. */
export function resolveSwipe(opts: {
  deltaY: number;
  threshold?: number;
  insideRegion: boolean;
  atTopStart: boolean;
  atBottomStart: boolean;
}): SwipeAction {
  const threshold = opts.threshold ?? 50;
  const up = opts.deltaY > threshold;
  const down = opts.deltaY < -threshold;
  if (!up && !down) return "none";
  if (!opts.insideRegion) return up ? "advance" : "back";
  if (up && opts.atBottomStart) return "advance";
  if (down && opts.atTopStart) return "back";
  return "none";
}

/** True when a wheel tick inside the scroll region should scroll the text
 *  (reading) rather than count toward advancing — i.e. the region can still move
 *  in the wheel's direction. At the edge (or outside a scrollable region) this is
 *  false and the caller's delta-accumulator takes over to advance/back, giving a
 *  natural "keep scrolling past the end" feel. */
export function isWheelReadingScroll(opts: {
  deltaY: number;
  insideRegion: boolean;
  scrollable: boolean;
  atTop: boolean;
  atBottom: boolean;
}): boolean {
  if (!opts.insideRegion || !opts.scrollable) return false;
  if (opts.deltaY > 0) return !opts.atBottom; // scrolling down through the text
  if (opts.deltaY < 0) return !opts.atTop; // scrolling up through the text
  return false;
}
