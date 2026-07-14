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
