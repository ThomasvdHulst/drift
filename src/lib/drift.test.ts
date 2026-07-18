import { describe, it, expect } from "vitest";
import { pickDriftNext, pickRandomThread } from "./drift";
import type { Thread } from "./types";

function thread(title: string): Thread {
  return {
    candidate: { pageTitle: title, displayTitle: title, extract: "x" },
    label: title,
  };
}

// Deterministic RNG that yields a fixed queue of values.
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("pickDriftNext", () => {
  const threads = [thread("A"), thread("B"), thread("C")];

  it("drifts fully random by default (not liked) even with threads available", () => {
    const choice = pickDriftNext(threads, { rng: seededRng([0.0]) });
    expect(choice.type).toBe("random");
  });

  it("follows a related thread when the current card is liked", () => {
    // rng 0.0 → index 0 (A)
    const choice = pickDriftNext(threads, {
      likedCurrent: true,
      rng: seededRng([0.0]),
    });
    expect(choice.type).toBe("thread");
    if (choice.type === "thread") {
      expect(choice.thread.candidate.pageTitle).toBe("A");
    }
  });

  it("picks a random related thread when liked (0.9 * 3 = 2.7 → index 2 = C)", () => {
    const choice = pickDriftNext(threads, {
      likedCurrent: true,
      rng: seededRng([0.9]),
    });
    expect(choice.type).toBe("thread");
    if (choice.type === "thread") {
      expect(choice.thread.candidate.pageTitle).toBe("C");
    }
  });

  it("goes random when liked but there are no untapped threads", () => {
    const choice = pickDriftNext([], { likedCurrent: true, rng: seededRng([0.0]) });
    expect(choice.type).toBe("random");
  });

  it("defaults to Math.random when no rng is supplied (smoke)", () => {
    // No throw, returns a valid shape.
    const choice = pickDriftNext(threads, { likedCurrent: true });
    expect(["thread", "random"]).toContain(choice.type);
  });
});

describe("pickRandomThread", () => {
  const threads = [thread("A"), thread("B"), thread("C")];

  it("returns null for an empty list", () => {
    expect(pickRandomThread([])).toBeNull();
  });

  it("selects by the rng (0.9 * 3 = 2.7 → index 2)", () => {
    expect(pickRandomThread(threads, () => 0.9)?.candidate.pageTitle).toBe("C");
  });

  it("clamps rng === 1 to the last index (no out-of-bounds)", () => {
    expect(pickRandomThread(threads, () => 1)?.candidate.pageTitle).toBe("C");
  });

  it("picks the first when rng is 0", () => {
    expect(pickRandomThread(threads, () => 0)?.candidate.pageTitle).toBe("A");
  });
});
