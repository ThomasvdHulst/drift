import { describe, it, expect } from "vitest";
import { pickDriftNext, pickRandomThread, MAX_THEME_RUN } from "./drift";
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

  it("follows a thread when the first roll is < 0.5 (thread bias)", () => {
    // first roll 0.3 (< 0.5 → thread branch), second roll 0.0 → index 0
    const choice = pickDriftNext(threads, { rng: seededRng([0.3, 0.0]) });
    expect(choice.type).toBe("thread");
    if (choice.type === "thread") {
      expect(choice.thread.candidate.pageTitle).toBe("A");
    }
  });

  it("selects thread by the second roll", () => {
    // 0.1 → thread branch; 0.9 * 3 = 2.7 → floor 2 → index 2 (C)
    const choice = pickDriftNext(threads, { rng: seededRng([0.1, 0.9]) });
    expect(choice.type).toBe("thread");
    if (choice.type === "thread") {
      expect(choice.thread.candidate.pageTitle).toBe("C");
    }
  });

  it("goes fully random when the first roll is >= 0.5", () => {
    const choice = pickDriftNext(threads, { rng: seededRng([0.6]) });
    expect(choice.type).toBe("random");
  });

  it("always goes random when there are no untapped threads", () => {
    const choice = pickDriftNext([], { rng: seededRng([0.0, 0.0]) });
    expect(choice.type).toBe("random");
  });

  it("forces random once the theme run hits the cap, even on a low roll", () => {
    // A roll of 0.0 would normally pick a thread, but the run cap overrides it.
    const choice = pickDriftNext(threads, {
      rng: seededRng([0.0, 0.0]),
      consecutiveThemeDrifts: MAX_THEME_RUN,
    });
    expect(choice.type).toBe("random");
  });

  it("still allows a thread just below the cap", () => {
    const choice = pickDriftNext(threads, {
      rng: seededRng([0.0, 0.0]),
      consecutiveThemeDrifts: MAX_THEME_RUN - 1,
    });
    expect(choice.type).toBe("thread");
  });

  it("defaults to Math.random when no rng is supplied (smoke)", () => {
    // No throw, returns a valid shape.
    const choice = pickDriftNext(threads);
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
