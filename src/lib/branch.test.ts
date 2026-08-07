import { describe, it, expect } from "vitest";
import {
  childrenOf,
  hasBranches,
  leavesOf,
  mainLine,
  parentOf,
  pathTo,
  readingOrder,
  tipOf,
} from "./branch";
import type { TrailStep } from "./types";

/** A step whose title is its index, so assertions read as the shape they test. */
function step(i: number, parent?: number): TrailStep {
  return {
    card: {
      pageTitle: `T${i}`,
      displayTitle: `T${i}`,
      extract: "x",
      sourceUrl: `https://en.wikipedia.org/wiki/T${i}`,
    },
    ...(parent === undefined ? {} : { parent }),
    arrivedVia: i === 0 ? { type: "seed", seedName: "s" } : { type: "drift" },
    timestamp: i,
    expanded: false,
  };
}

/** A plain chain of n steps — every trail saved before Phase 29. */
function chain(n: number): TrailStep[] {
  return Array.from({ length: n }, (_, i) => step(i));
}

describe("parentOf", () => {
  it("defaults to the previous step, which is what an old trail means", () => {
    const steps = chain(4);
    expect(parentOf(steps, 0)).toBeNull();
    expect(parentOf(steps, 1)).toBe(0);
    expect(parentOf(steps, 3)).toBe(2);
  });

  it("honours an explicit backward parent", () => {
    const steps = [...chain(4), step(4, 1)];
    expect(parentOf(steps, 4)).toBe(1);
  });

  it("clamps every unusable parent to the linear default", () => {
    // Forward pointer, self-reference, out of range, negative, float, NaN — all
    // of which would otherwise cycle or read past the end.
    for (const bad of [5, 4, 99, -1, 1.5, NaN]) {
      const steps = [...chain(4), step(4, bad as number)];
      expect(parentOf(steps, 4)).toBe(3);
    }
  });

  it("returns null outside the array", () => {
    const steps = chain(3);
    expect(parentOf(steps, -1)).toBeNull();
    expect(parentOf(steps, 3)).toBeNull();
    expect(parentOf([], 0)).toBeNull();
  });
});

describe("pathTo", () => {
  it("is the whole chain for a linear trail", () => {
    expect(pathTo(chain(4), 3)).toEqual([0, 1, 2, 3]);
  });

  it("follows the fork, not the array order", () => {
    // 0-1-2-3 with a branch 4-5 off step 1.
    const steps = [...chain(4), step(4, 1), step(5)];
    expect(pathTo(steps, 5)).toEqual([0, 1, 4, 5]);
    expect(pathTo(steps, 3)).toEqual([0, 1, 2, 3]);
  });

  it("is just the root at the root", () => {
    expect(pathTo(chain(3), 0)).toEqual([0]);
  });
});

describe("childrenOf / hasBranches / mainLine", () => {
  it("reports no branches for a chain", () => {
    const steps = chain(4);
    expect(childrenOf(steps)).toEqual([[1], [2], [3], []]);
    expect(hasBranches(steps)).toBe(false);
    expect(mainLine(steps)).toEqual([0, 1, 2, 3]);
  });

  it("reports the fork and keeps the main line on the earlier child", () => {
    const steps = [...chain(4), step(4, 1), step(5)];
    expect(childrenOf(steps)[1]).toEqual([2, 4]);
    expect(hasBranches(steps)).toBe(true);
    // The branch was appended later, so the trunk is still the main line.
    expect(mainLine(steps)).toEqual([0, 1, 2, 3]);
  });

  it("handles the empty trail", () => {
    expect(childrenOf([])).toEqual([]);
    expect(hasBranches([])).toBe(false);
    expect(mainLine([])).toEqual([]);
  });
});

describe("readingOrder", () => {
  it("lays a chain out as one lane, one row per step", () => {
    const places = readingOrder(chain(3));
    expect(places.map((p) => p.index)).toEqual([0, 1, 2]);
    expect(places.every((p) => p.lane === 0)).toBe(true);
    expect(places.map((p) => p.row)).toEqual([0, 1, 2]);
    expect(places.some((p) => p.isBranchRoot)).toBe(false);
  });

  it("puts a branch in its own lane, starting one row below its fork", () => {
    // 0-1-2-3 with a branch 4-5 off step 1 (row 1), so 4 sits at row 2.
    const steps = [...chain(4), step(4, 1), step(5)];
    const by = new Map(readingOrder(steps).map((p) => [p.index, p]));
    expect(by.get(3)).toMatchObject({ lane: 0, row: 3 });
    expect(by.get(4)).toMatchObject({ lane: 1, row: 2, isBranchRoot: true });
    expect(by.get(5)).toMatchObject({ lane: 1, row: 3, isBranchRoot: false });
  });

  it("reads the main line first, then each branch", () => {
    const steps = [...chain(4), step(4, 1), step(5)];
    expect(readingOrder(steps).map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("gives a branch off a branch its own lane too", () => {
    // trunk 0-1-2, branch 3-4 off 1, sub-branch 5 off 3.
    const steps = [...chain(3), step(3, 1), step(4), step(5, 3)];
    const by = new Map(readingOrder(steps).map((p) => [p.index, p]));
    expect(by.get(3)!.lane).toBe(1);
    expect(by.get(4)!.lane).toBe(1);
    expect(by.get(5)!.lane).toBe(2);
    expect(by.get(5)).toMatchObject({ row: 3, isBranchRoot: true });
    expect(new Set(readingOrder(steps).map((p) => p.index)).size).toBe(6);
  });

  it("covers every step exactly once, whatever the shape", () => {
    const steps = [...chain(5), step(5, 0), step(6, 2), step(7)];
    const order = readingOrder(steps);
    expect(order).toHaveLength(steps.length);
    expect(new Set(order.map((p) => p.index)).size).toBe(steps.length);
  });

  it("handles the empty trail", () => {
    expect(readingOrder([])).toEqual([]);
  });
});

describe("tipOf", () => {
  it("follows the first child to the end of the line", () => {
    expect(tipOf(chain(4), 0)).toBe(3);
    expect(tipOf(chain(4), 2)).toBe(3);
  });

  it("returns the step itself when nothing continues from it", () => {
    const steps = chain(4);
    expect(tipOf(steps, 3)).toBe(3);
  });

  it("takes the FIRST child at a fork, which is the line walked first", () => {
    // trunk 0-1-2-3, branch 4-5 off step 1.
    const steps = [...chain(4), step(4, 1), step(5)];
    expect(tipOf(steps, 1)).toBe(3);
    expect(tipOf(steps, 4)).toBe(5);
  });

  it("always returns a tip whose path contains the step asked about", () => {
    // The property the feed depends on: `pathTo(tip)` must contain `pos`, or the
    // rail highlights one stop while the card shows another. `steps.length - 1`
    // does NOT have this property once a trail forks, which is why this exists.
    const steps = [...chain(4), step(4, 1), step(5)];
    for (let i = 0; i < steps.length; i++) {
      expect(pathTo(steps, tipOf(steps, i))).toContain(i);
    }
    expect(pathTo(steps, steps.length - 1)).not.toContain(3);
  });

  it("is safe outside the array", () => {
    expect(tipOf(chain(3), 9)).toBe(9);
    expect(tipOf([], 0)).toBe(0);
  });
});

describe("leavesOf", () => {
  it("is the last step of an unbranched trail, and only that", () => {
    expect(leavesOf(chain(4))).toEqual([3]);
    expect(leavesOf(chain(1))).toEqual([0]);
  });

  it("names every end of a branched trail, in reading order", () => {
    // trunk 0-1-2-3, branch 4-5 off step 1: it ended at 3 and at 5.
    const steps = [...chain(4), step(4, 1), step(5)];
    expect(leavesOf(steps)).toEqual([3, 5]);
  });

  it("counts a branch off a branch as its own end", () => {
    const steps = [...chain(3), step(3, 1), step(4), step(5, 3)];
    expect(leavesOf(steps)).toEqual([2, 4, 5]);
  });

  it("handles the empty trail", () => {
    expect(leavesOf([])).toEqual([]);
  });
});
