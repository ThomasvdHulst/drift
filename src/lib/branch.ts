import type { TrailStep } from "./types";

// ---------------------------------------------------------------------------
// Branches (Phase 29) — a trail is a TREE, and this is the only module that
// knows it.
//
// Until now a trail was a chain: step `i` continued step `i-1`, and that was
// hard-coded in the map, the story, the export, the Atlas and the feed's own
// navigation. Opening a door you left behind broke that assumption, because the
// stop you rejoin is not the stop you were standing on. So `TrailStep.parent`
// records the fork, and everything else asks here instead of doing arithmetic.
//
// Two properties keep the model safe:
//
//   • `parent` is ALWAYS an earlier index, so the graph is a forest by
//     construction and no traversal here can loop. `parentOf` enforces it, and
//     it is the single sanitisation point: a saved trail arrives from IndexedDB,
//     from the cloud, or from someone else's share, and none of those are
//     trusted enough to be dereferenced raw.
//   • The array is APPEND-ONLY. Nothing removes or reorders a step (going back
//     and pulling a thread now forks rather than truncating), so an index that
//     was written once stays valid forever. Anything that starts deleting steps
//     has to renumber every `parent` in the same breath — which is the reason
//     not to.
// ---------------------------------------------------------------------------

/**
 * The step `i` continues from, or null if it is a root.
 *
 * An explicit `parent` counts only when it is a whole number pointing strictly
 * BACKWARDS and inside the array; anything else (a forward pointer, a negative,
 * a float, a NaN, a value left over from a truncated array) falls back to the
 * linear default. Failing this way round matters: the fallback is always a valid
 * tree, so a damaged trail still draws as the chain it probably was instead of
 * throwing on the exit screen.
 */
export function parentOf(steps: TrailStep[], i: number): number | null {
  if (i <= 0 || i >= steps.length) return null;
  const p = steps[i]?.parent;
  if (typeof p === "number" && Number.isInteger(p) && p >= 0 && p < i) return p;
  return i - 1;
}

/** Root → `i`, the way you actually travelled to it. The feed's back-nav and
 *  the top-bar rail follow this rather than the array order. */
export function pathTo(steps: TrailStep[], i: number): number[] {
  const out: number[] = [];
  let cur: number | null = i;
  while (cur !== null && cur >= 0 && cur < steps.length) {
    out.push(cur);
    cur = parentOf(steps, cur);
  }
  return out.reverse();
}

/** Children per step, ascending — so the FIRST child of a fork is always the
 *  one you reached first in time (branches are only ever appended later). */
export function childrenOf(steps: TrailStep[]): number[][] {
  const kids: number[][] = steps.map(() => []);
  for (let i = 1; i < steps.length; i++) {
    const p = parentOf(steps, i);
    if (p !== null) kids[p].push(i);
  }
  return kids;
}

/** Does this trail fork at all? Lets every surface keep its exact pre-Phase-29
 *  rendering when there is nothing to draw differently. */
export function hasBranches(steps: TrailStep[]): boolean {
  return childrenOf(steps).some((k) => k.length > 1);
}

/**
 * The original journey: the root, then the first child at every fork.
 *
 * "First" is chronological, not preferred — a branch is created after the trunk
 * it leaves, so the lowest-index child is always the way you went the first
 * time. That is what makes it honest to call this the main line rather than a
 * ranking of which path mattered more.
 */
export function mainLine(steps: TrailStep[]): number[] {
  if (steps.length === 0) return [];
  const kids = childrenOf(steps);
  const out: number[] = [];
  let cur: number | undefined = 0;
  while (cur !== undefined) {
    out.push(cur);
    cur = kids[cur][0];
  }
  return out;
}

/**
 * The far end of the line that continues from `i`: its first child, then that
 * child's first child, down to a leaf.
 *
 * This is what makes a `pos`/`tip` pair valid. The feed reads `pathTo(tip)` and
 * locates `pos` on it, so a tip that is not DOWNSTREAM of `pos` yields a path
 * `pos` is not on, and the rail then highlights the root while the card shows
 * something else entirely. Any landing that does not happen by walking —
 * switching branches, reopening a saved trail at a stop (Phase 30) — has to
 * compute its tip through here rather than reaching for `steps.length - 1`,
 * which after a fork belongs to whichever branch was made last.
 *
 * It cannot loop: a child's index is always greater than its parent's (see
 * `parentOf`), so each hop moves strictly forward through a finite array.
 */
export function tipOf(steps: TrailStep[], i: number): number {
  if (i < 0 || i >= steps.length) return i;
  const kids = childrenOf(steps);
  let cur = i;
  while (kids[cur].length > 0) cur = kids[cur][0];
  return cur;
}

/**
 * Every step nothing continues from: where the trail actually came to rest.
 *
 * In reading order, so a sentence listing them names them in the order the map
 * draws them. An unbranched trail has exactly one, which is why the surfaces
 * that say anything about this only speak when there are two or more.
 */
export function leavesOf(steps: TrailStep[]): number[] {
  const kids = childrenOf(steps);
  return readingOrder(steps)
    .map((p) => p.index)
    .filter((i) => kids[i].length === 0);
}

/** Where a step sits once the tree is flattened for reading or drawing. */
export interface BranchPlace {
  index: number;
  /** Column: 0 is the main line, each fork opens the next one. */
  lane: number;
  /** Row down the page. A branch starts one row below its fork, so it runs
   *  BESIDE the trunk and time still reads downward. */
  row: number;
  /** Is this the first step of a branch (the hop that left the trunk)? */
  isBranchRoot: boolean;
  /** The step it continues from, or null at the root. */
  parent: number | null;
}

/**
 * Every step in reading order: the main line first, then each branch in the
 * order its fork appears on the line above it, recursively.
 *
 * One ordering, shared by the map, the story, the text export and the public
 * share list, so those four cannot quietly disagree about what happened. Every
 * step is reachable by construction (`parentOf` guarantees a strictly earlier
 * parent), so this always returns one entry per step.
 *
 * Each branch gets a column of its own, even where two of them could share one
 * without overlapping. Packing would be narrower and much harder to read: an
 * edge arriving in a column directly under an unrelated branch's tail looks
 * like a continuation of it.
 */
export function readingOrder(steps: TrailStep[]): BranchPlace[] {
  if (steps.length === 0) return [];
  const kids = childrenOf(steps);
  const out: BranchPlace[] = [];
  let nextLane = 0;

  // Walk one chain (first child at each step), collecting the forks it passes
  // so they are laid out after it — depth-first, but with the main line always
  // taken first.
  function walkChain(start: number, lane: number, startRow: number) {
    const forks: { index: number; row: number }[] = [];
    let cur: number | undefined = start;
    let row = startRow;
    while (cur !== undefined) {
      const here: number = cur;
      out.push({
        index: here,
        lane,
        row,
        isBranchRoot: row === startRow && lane > 0,
        parent: parentOf(steps, here),
      });
      // The first child carries this chain on; every other one is a fork, laid
      // out after the whole chain so the main line is always read first.
      for (const r of kids[here].slice(1)) forks.push({ index: r, row: row + 1 });
      cur = kids[here][0];
      row += 1;
    }
    for (const f of forks) walkChain(f.index, ++nextLane, f.row);
  }

  walkChain(0, 0, 0);
  return out;
}
