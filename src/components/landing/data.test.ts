import { describe, it, expect } from "vitest";
import {
  DEMO_CARDS,
  DEMO_START_ID,
  EXAMPLE_TRAILS,
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

  it("offers several example trails to rotate through", () => {
    expect(EXAMPLE_TRAILS.length).toBeGreaterThanOrEqual(4);
  });

  it("every example trail is a non-trivial, well-formed wander", () => {
    for (const t of EXAMPLE_TRAILS) {
      expect(t.length).toBeGreaterThanOrEqual(4);
      // first stop is the seed; the rest show both edge styles (solid thread +
      // dotted drift) the reward section shows off
      expect(t[0].arrivedVia.type).toBe("seed");
      expect(t.some((s) => s.arrivedVia.type === "drift")).toBe(true);
      expect(t.some((s) => s.arrivedVia.type === "thread")).toBe(true);
      // every stop has a title + a bundled image
      for (const s of t) {
        expect(s.card.displayTitle.length).toBeGreaterThan(0);
        expect(s.card.imageUrl).toMatch(/^\/landing\/.+\.jpg$/);
      }
    }
  });

  it("uses no em/en dashes in any trail title", () => {
    for (const t of EXAMPLE_TRAILS) {
      for (const s of t) {
        expect(s.card.displayTitle).not.toMatch(/[—–]/);
      }
    }
  });
});
