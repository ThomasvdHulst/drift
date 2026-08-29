// Pure decision helpers for the drift feed's gestures. The feed's touch handler
// (src/app/(app)/drift/ContinuousFeed.tsx) reads the raw deltas and delegates the
// decision here, so the fiddly edge logic stays React/DOM-free and unit-testable
// (CLAUDE.md §8.4).
//
// ⚠️ THIS FILE USED TO BE FOUR HELPERS AND IS NOW ONE, and the three that went
// are worth knowing about rather than rediscovering. `edgesOf`, `resolveSwipe`
// and `isWheelReadingScroll` decided "is this swipe the reader scrolling the
// article, or overscrolling past its edge to advance?" — a question only a
// card-at-a-time feed has to answer in JavaScript. The continuous feed is a
// native scroll-snap scroller, so the browser answers it: the reading region
// carries `overscroll-behavior` and the outer scroller takes over at its edge.
// They were deleted with DiscreteFeed in Phase 7 rather than left exported and
// uncalled, which is the shape the pre-Phase-7 audit found three times over.

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
