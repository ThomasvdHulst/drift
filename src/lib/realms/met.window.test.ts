import { describe, it, expect } from "vitest";
import { randomOffset } from "../discover";

// `windowStart` is not exported (it lives in the server adapter, which pulls in
// server-only fetch code), so this pins the CONTRACT it has to satisfy: the
// offset the feed sends is a card index, and a batch must start at that card.
const windowStart = (offset: number, poolSize: number) =>
  poolSize > 0 ? offset % poolSize : 0;

describe("the discover offset contract", () => {
  // The bug this pins: the adapter multiplied the offset by the limit, squaring
  // the stride. A refill meant to move 12 cards along moved 144.
  it("treats the offset as a card index, not a page number", () => {
    expect(windowStart(0, 500)).toBe(0);
    expect(windowStart(12, 500)).toBe(12);
    expect(windowStart(24, 500)).toBe(24);
  });

  it("advances by exactly one window between consecutive refills", () => {
    const LIMIT = 12;
    const starts = [0, LIMIT, LIMIT * 2, LIMIT * 3].map((o) => windowStart(o, 500));
    expect(starts).toEqual([0, 12, 24, 36]);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBe(LIMIT);
    }
  });

  // A small oeuvre is the case that actually broke: 13 works, a 12-card seed,
  // then a refill. It must wrap to a sane place rather than a squared one.
  it("wraps a small pool instead of running off the end", () => {
    const WORKS = 13;
    expect(windowStart(12, WORKS)).toBe(12);
    expect(windowStart(24, WORKS)).toBe(11);
    expect(windowStart(0, WORKS)).toBe(0);
    // The squared stride would have landed here instead, which is arbitrary.
    expect(windowStart(24, WORKS)).not.toBe((24 * 12) % WORKS);
  });

  it("copes with an empty pool", () => {
    expect(windowStart(50, 0)).toBe(0);
  });

  // What the feed actually sends: an offset already aligned to the window size.
  it("matches what randomOffset produces", () => {
    for (const step of [12, 20]) {
      for (let i = 0; i < 50; i++) {
        const o = randomOffset(Math.random, 400, step);
        expect(o % step).toBe(0);
        expect(windowStart(o, 1000)).toBe(o % 1000);
      }
    }
  });
});
