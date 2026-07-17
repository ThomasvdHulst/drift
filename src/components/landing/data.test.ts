import { describe, it, expect } from "vitest";
import {
  DEMO_CARDS,
  DEMO_START_ID,
  EXAMPLE_TRAIL,
  demoCardById,
  nextCard,
} from "./data";

describe("landing demo graph", () => {
  it("has a resolvable start card", () => {
    expect(demoCardById(DEMO_START_ID)).toBeDefined();
  });

  it("has unique card ids", () => {
    const ids = DEMO_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every thread points at a card that exists (no dead-end chips)", () => {
    for (const card of DEMO_CARDS) {
      for (const thread of card.threads) {
        expect(
          nextCard(thread.to),
          `${card.id} → ${thread.to} is a dead end`,
        ).toBeDefined();
      }
    }
  });

  it("every card is reachable from the start (connected graph)", () => {
    const seen = new Set<string>([DEMO_START_ID]);
    const queue = [DEMO_START_ID];
    while (queue.length) {
      const cur = demoCardById(queue.shift()!)!;
      for (const t of cur.threads) {
        if (!seen.has(t.to)) {
          seen.add(t.to);
          queue.push(t.to);
        }
      }
    }
    expect(seen.size).toBe(DEMO_CARDS.length);
  });

  it("every card offers at least two threads to pull", () => {
    for (const card of DEMO_CARDS) {
      expect(card.threads.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("nextCard returns undefined for an unknown id", () => {
    expect(nextCard("not-a-real-card")).toBeUndefined();
  });

  it("example trail is a non-trivial multi-stop wander", () => {
    expect(EXAMPLE_TRAIL.length).toBeGreaterThanOrEqual(4);
    // first stop is the seed, and at least one drift edge exists (for the
    // dotted-vs-solid edge styling the reward section shows off)
    expect(EXAMPLE_TRAIL[0].arrivedVia.type).toBe("seed");
    expect(EXAMPLE_TRAIL.some((s) => s.arrivedVia.type === "drift")).toBe(true);
    expect(EXAMPLE_TRAIL.some((s) => s.arrivedVia.type === "thread")).toBe(true);
  });
});
