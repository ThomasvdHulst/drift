import { describe, it, expect } from "vitest";
import { computeTrailStats, formatDuration } from "./stats";
import type { ArrivedVia, TrailStep } from "./types";

function step(
  via: ArrivedVia,
  opts: { timestamp?: number; dwellMs?: number; expanded?: boolean } = {},
): TrailStep {
  return {
    card: {
      pageTitle: "T",
      displayTitle: "T",
      extract: "x",
      sourceUrl: "https://en.wikipedia.org/wiki/T",
    },
    arrivedVia: via,
    timestamp: opts.timestamp ?? 0,
    dwellMs: opts.dwellMs,
    expanded: opts.expanded ?? false,
  };
}

describe("computeTrailStats", () => {
  it("counts stops, threads, drifts and read-mores", () => {
    const stats = computeTrailStats([
      step({ type: "seed", seedName: "Space" }, { expanded: true }),
      step({ type: "thread", label: "Gears", fromTitle: "A" }),
      step({ type: "drift" }),
      step({ type: "thread", label: "Ships", fromTitle: "B" }, { expanded: true }),
    ]);
    expect(stats.stops).toBe(4);
    expect(stats.threadsPulled).toBe(2);
    expect(stats.drifts).toBe(1);
    expect(stats.readMores).toBe(2);
  });

  it("sums per-step dwell when present", () => {
    const stats = computeTrailStats([
      step({ type: "seed", seedName: "S" }, { dwellMs: 5000 }),
      step({ type: "drift" }, { dwellMs: 7000 }),
    ]);
    expect(stats.durationMs).toBe(12000);
  });

  it("falls back to the timestamp span when dwell is absent", () => {
    const stats = computeTrailStats([
      step({ type: "seed", seedName: "S" }, { timestamp: 1000 }),
      step({ type: "drift" }, { timestamp: 61000 }),
    ]);
    expect(stats.durationMs).toBe(60000);
  });

  it("handles the empty trail", () => {
    const stats = computeTrailStats([]);
    expect(stats).toEqual({
      stops: 0,
      threadsPulled: 0,
      drifts: 0,
      readMores: 0,
      durationMs: 0,
    });
  });
});

describe("formatDuration", () => {
  it("formats seconds under a minute", () => {
    expect(formatDuration(45000)).toBe("45 sec");
  });
  it("formats whole minutes", () => {
    expect(formatDuration(21 * 60000)).toBe("21 min");
    expect(formatDuration(60000)).toBe("1 min");
  });
  it("formats hours and minutes", () => {
    expect(formatDuration(63 * 60000)).toBe("1 hr 3 min");
    expect(formatDuration(60 * 60000)).toBe("1 hr");
  });
  it("never goes negative", () => {
    expect(formatDuration(-5000)).toBe("0 sec");
  });
});
