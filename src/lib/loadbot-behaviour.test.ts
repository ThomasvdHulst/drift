// ---------------------------------------------------------------------------
// The load-test swarm's behaviour model (scripts/bots/behaviour.mjs).
//
// This is the part of the harness that decides what the numbers in the report
// mean: how long a bot looks at a card, how often it drifts rather than pulls a
// thread, and how many bots are pointed at the museum. Get the distributions
// wrong and the run still completes, still prints a confident report, and
// describes a population that does not exist — which is worse than not running
// it at all.
//
// So the properties are pinned here: the shape of the spread (not just its
// mean), the hard clamps, and above all the Gallery cap, which is the one number
// in this harness that protects something outside the test.
//
// In src/ so the existing `npm run test` glob picks it up. See loadbot.test.ts.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  makeRng,
  drawSpeed,
  dwellMs,
  chooseMove,
  shouldReadMore,
  sessionLength,
  startDelayMs,
  assignRealms,
  pick,
} from "../../scripts/bots/behaviour.mjs";

/** Draw n samples of f with one seeded stream, so every test is reproducible. */
function sample<T>(n: number, f: (rng: () => number) => T, seed = 1): T[] {
  const rng = makeRng(seed);
  return Array.from({ length: n }, () => f(rng));
}

describe("makeRng", () => {
  it("is deterministic for a seed", () => {
    const a = Array.from({ length: 5 }, makeRng(42));
    expect(Array.from({ length: 5 }, makeRng(42))).toEqual(a);
  });

  it("differs between seeds and stays in [0, 1)", () => {
    const a = sample(200, (r) => r(), 1);
    const b = sample(200, (r) => r(), 2);
    expect(a).not.toEqual(b);
    for (const n of [...a, ...b]) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe("drawSpeed", () => {
  const speeds = sample(2000, drawSpeed);

  it("never leaves the clamp", () => {
    for (const s of speeds) {
      expect(s).toBeGreaterThanOrEqual(0.4);
      expect(s).toBeLessThanOrEqual(3.5);
    }
  });

  it("centres on 1, so the median bot reads at an ordinary pace", () => {
    const sorted = [...speeds].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeGreaterThan(0.85);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(1.15);
  });

  it("actually produces a mixed population, not fifty average readers", () => {
    // The whole reason for a distribution. If this collapses, the swarm is one
    // reader amplified N times and the aggregate request pattern is an artefact.
    expect(speeds.some((s) => s < 0.7)).toBe(true);
    expect(speeds.some((s) => s > 1.6)).toBe(true);
  });
});

describe("dwellMs", () => {
  it("stays inside [3s, 120s] for every speed, including the extremes", () => {
    for (const speed of [0.4, 1, 3.5]) {
      for (const ms of sample(1000, (r) => dwellMs(r, speed))) {
        expect(ms).toBeGreaterThanOrEqual(3000);
        expect(ms).toBeLessThanOrEqual(120000);
      }
    }
  });

  it("is slower for a slower reader", () => {
    const median = (xs: number[]) =>
      [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const fast = median(sample(1000, (r) => dwellMs(r, 0.5), 7));
    const slow = median(sample(1000, (r) => dwellMs(r, 2.5), 7));
    expect(slow).toBeGreaterThan(fast);
  });

  it("has a heavy tail: some cards are read properly", () => {
    const ms = sample(2000, (r) => dwellMs(r, 1));
    expect(ms.some((m) => m > 30000)).toBe(true);
    expect(ms.some((m) => m < 8000)).toBe(true);
  });
});

describe("chooseMove", () => {
  const moves = sample(4000, chooseMove);
  const share = (m: string) => moves.filter((x) => x === m).length / moves.length;

  it("only ever returns a move the drivers implement", () => {
    for (const m of moves) expect(["thread", "drift", "back"]).toContain(m);
  });

  it("favours pulling a thread — the move the app is for", () => {
    expect(share("thread")).toBeGreaterThan(share("drift"));
    expect(share("thread")).toBeCloseTo(0.6, 1);
    expect(share("drift")).toBeCloseTo(0.35, 1);
    expect(share("back")).toBeLessThan(0.1);
  });
});

describe("shouldReadMore / sessionLength", () => {
  it("expands roughly one card in four", () => {
    const hits = sample(4000, shouldReadMore).filter(Boolean).length;
    expect(hits / 4000).toBeCloseTo(0.25, 1);
  });

  it("gives every session a whole number of cards in [8, 40]", () => {
    for (const n of sample(2000, sessionLength)) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(8);
      expect(n).toBeLessThanOrEqual(40);
    }
  });
});

describe("startDelayMs", () => {
  it("never schedules outside the ramp", () => {
    const rng = makeRng(3);
    for (let i = 0; i < 50; i++) {
      const d = startDelayMs(rng, i, 50, 60000);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(60000);
    }
  });

  it("spreads the swarm rather than starting it all at once", () => {
    const rng = makeRng(3);
    const delays = Array.from({ length: 50 }, (_, i) =>
      startDelayMs(rng, i, 50, 60000),
    );
    // A thundering herd is the specific failure this prevents: if most bots
    // landed in the first second the Gallery budget would be gone before the
    // measurement began.
    expect(delays.filter((d) => d < 1000).length).toBeLessThan(5);
    expect(Math.max(...delays)).toBeGreaterThan(40000);
  });

  it("is 0 for a single bot", () => {
    expect(startDelayMs(makeRng(1), 0, 1, 60000)).toBe(0);
  });
});

describe("assignRealms", () => {
  it("honours the share when the cap is not in the way", () => {
    const { realms, gallery, capped } = assignRealms(20, 0.25, 10);
    expect(realms).toHaveLength(20);
    expect(gallery).toBe(5);
    expect(capped).toBe(false);
  });

  it("lets the cap win, and says so", () => {
    // THE safety property of this harness. The Met throttles at ~80 requests per
    // 30s and repeated tripping shrinks that budget for a day (CLAUDE.md §4), so
    // a run that quietly exceeded the cap could degrade the museum's view of us
    // well beyond the test. `capped` is how the report tells the truth about it.
    const { gallery, capped } = assignRealms(50, 0.5, 10);
    expect(gallery).toBe(10);
    expect(capped).toBe(true);
  });

  it("never invents a bot, and never exceeds the count", () => {
    for (const [count, share, cap] of [
      [1, 1, 10],
      [3, 0.25, 10],
      [50, 0.25, 10],
      [7, 0.9, 4],
    ] as const) {
      const { realms, gallery } = assignRealms(count, share, cap);
      expect(realms).toHaveLength(count);
      expect(realms.filter((r) => r === "gallery")).toHaveLength(gallery);
      expect(gallery).toBeLessThanOrEqual(count);
    }
  });

  it("produces no Gallery bots at all when the share is zero", () => {
    const { realms, gallery } = assignRealms(20, 0, 10);
    expect(gallery).toBe(0);
    expect(realms.every((r) => r === "encyclopedia")).toBe(true);
  });

  it("interleaves, so a run that stops early still holds the mix", () => {
    const { realms } = assignRealms(20, 0.25, 10);
    // Not all the Gallery bots bunched at one end.
    const idx = realms.flatMap((r, i) => (r === "gallery" ? [i] : []));
    expect(Math.max(...idx) - Math.min(...idx)).toBeGreaterThan(8);
  });
});

describe("pick", () => {
  it("only ever returns a member, and reaches every member", () => {
    const arr = ["a", "b", "c", "d"];
    const seen = new Set(sample(500, (r) => pick(r, arr)));
    expect([...seen].every((x) => arr.includes(x as string))).toBe(true);
    expect(seen.size).toBe(arr.length);
  });
});
