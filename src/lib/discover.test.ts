import { describe, it, expect } from "vitest";
import {
  randomOffset,
  uniformTopic,
  weightedTopic,
  interleave,
} from "./discover";
import { TOPICS } from "./topics";

describe("randomOffset", () => {
  it("stays within [0, max]", () => {
    expect(randomOffset(() => 0, 400)).toBe(0);
    expect(randomOffset(() => 0.999999, 400)).toBeLessThanOrEqual(400);
    expect(randomOffset(() => 0.5, 400)).toBe(200);
  });

  // Aligning the offset to the window the caller is about to request is what
  // lets the shared edge cache work: unaligned, a 4-card window can start at any
  // of 401 offsets, so two readers almost never ask for the same URL.
  it("lands on whole windows when given the window size", () => {
    for (const r of [0, 0.13, 0.5, 0.77, 0.999999]) {
      const off = randomOffset(() => r, 400, 4);
      expect(off % 4, `offset ${off} is a whole page`).toBe(0);
      expect(off).toBeGreaterThanOrEqual(0);
      expect(off).toBeLessThanOrEqual(400);
    }
    expect(randomOffset(() => 0.999999, 400, 12)).toBeLessThanOrEqual(400);
  });

  it("still reaches both ends of the range", () => {
    expect(randomOffset(() => 0, 400, 4)).toBe(0);
    expect(randomOffset(() => 0.999999, 400, 4)).toBe(400);
    expect(randomOffset(() => 0.999999, 1000, 4)).toBe(1000);
  });

  // The whole point is fewer distinct URLs for the same coverage.
  it("cuts the number of distinct offsets several-fold", () => {
    const distinct = (step: number) => {
      const seen = new Set<number>();
      for (let i = 0; i <= 1000; i++) seen.add(randomOffset(() => i / 1001, 400, step));
      return seen.size;
    };
    expect(distinct(1)).toBe(401);
    expect(distinct(4)).toBe(101); // a refill window
    expect(distinct(12)).toBe(34); // a seed window
  });
});

describe("uniformTopic", () => {
  it("picks the first topic at rng=0 and the last at rng≈1", () => {
    expect(uniformTopic(() => 0)).toBe(TOPICS[0]);
    expect(uniformTopic(() => 0.999999)).toBe(TOPICS[TOPICS.length - 1]);
  });
});

describe("weightedTopic", () => {
  it("falls back to uniform when all weights are zero/empty", () => {
    expect(weightedTopic({}, () => 0)).toBe(TOPICS[0]);
  });

  it("respects the weight distribution", () => {
    // Only two topics have weight; a small rng lands in the first bucket, a
    // large one in the second.
    const weights = { [TOPICS[0].id]: 1, [TOPICS[5].id]: 3 };
    expect(weightedTopic(weights, () => 0.0)).toBe(TOPICS[0]);
    expect(weightedTopic(weights, () => 0.99)).toBe(TOPICS[5]);
  });

  it("ignores negative weights", () => {
    const weights = { [TOPICS[0].id]: -5, [TOPICS[2].id]: 2 };
    expect(weightedTopic(weights, () => 0.5)).toBe(TOPICS[2]);
  });
});

describe("interleave", () => {
  it("round-robins across arrays of unequal length", () => {
    expect(interleave([[1, 3, 5], [2, 4]])).toEqual([1, 2, 3, 4, 5]);
  });
  it("handles empties", () => {
    expect(interleave([[], [1, 2]])).toEqual([1, 2]);
    expect(interleave([])).toEqual([]);
  });
});
