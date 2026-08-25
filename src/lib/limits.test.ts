import { describe, it, expect } from "vitest";
import {
  parseDailyLimit,
  unmetered,
  stopsRemaining,
  limitReached,
  shouldWarn,
  amsterdamDay,
  WARN_AT,
  type MeterState,
} from "./limits";

const free = (stops: number): MeterState => ({ stops, supporter: false });
const paid = (stops: number): MeterState => ({ stops, supporter: true });

describe("parseDailyLimit", () => {
  it("is unlimited by default — the measure-first state", () => {
    expect(parseDailyLimit({})).toBeNull();
    expect(parseDailyLimit({ NEXT_PUBLIC_FREE_DAILY_STOPS: "" })).toBeNull();
  });

  it("reads a positive integer", () => {
    expect(parseDailyLimit({ NEXT_PUBLIC_FREE_DAILY_STOPS: "50" })).toBe(50);
    expect(parseDailyLimit({ NEXT_PUBLIC_FREE_DAILY_STOPS: "1" })).toBe(1);
  });

  it("treats zero, negatives and nonsense as unlimited, never as a hard stop", () => {
    // A typo must not lock every reader out of the feed, so every unusable
    // value degrades to "no limit" rather than to "limit of nothing".
    expect(parseDailyLimit({ NEXT_PUBLIC_FREE_DAILY_STOPS: "0" })).toBeNull();
    expect(parseDailyLimit({ NEXT_PUBLIC_FREE_DAILY_STOPS: "-5" })).toBeNull();
    expect(parseDailyLimit({ NEXT_PUBLIC_FREE_DAILY_STOPS: "many" })).toBeNull();
  });

  it("floors a fractional value", () => {
    expect(parseDailyLimit({ NEXT_PUBLIC_FREE_DAILY_STOPS: "50.9" })).toBe(50);
  });
});

describe("amsterdamDay", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(amsterdamDay(new Date("2026-08-25T12:00:00Z"))).toBe("2026-08-25");
  });

  it("uses Amsterdam midnight, not UTC midnight", () => {
    // 23:30 UTC in summer is 01:30 the NEXT day in Amsterdam (CEST, UTC+2).
    // Getting this wrong would roll the allowance over in the middle of an
    // evening's reading, which is the whole reason the day is not UTC.
    expect(amsterdamDay(new Date("2026-08-25T23:30:00Z"))).toBe("2026-08-26");
    // And 22:30 UTC is still the same Amsterdam day.
    expect(amsterdamDay(new Date("2026-08-25T21:30:00Z"))).toBe("2026-08-25");
  });

  it("follows the winter offset too (CET, UTC+1)", () => {
    expect(amsterdamDay(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
    expect(amsterdamDay(new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-15");
  });
});

describe("unmetered", () => {
  it("is true with no limit configured", () => {
    expect(unmetered(free(999), null)).toBe(true);
  });

  it("is true for a supporter even when a limit is configured", () => {
    expect(unmetered(paid(999), 50)).toBe(true);
  });

  it("is false for a free reader under a configured limit", () => {
    expect(unmetered(free(0), 50)).toBe(false);
  });
});

describe("stopsRemaining", () => {
  it("counts down", () => {
    expect(stopsRemaining(free(0), 50)).toBe(50);
    expect(stopsRemaining(free(49), 50)).toBe(1);
    expect(stopsRemaining(free(50), 50)).toBe(0);
  });

  it("never goes negative", () => {
    // Reachable for real: an offline stretch reconciling, or a second tab.
    expect(stopsRemaining(free(53), 50)).toBe(0);
  });

  it("is null when the meter does not apply", () => {
    expect(stopsRemaining(free(10), null)).toBeNull();
    expect(stopsRemaining(paid(10), 50)).toBeNull();
  });
});

describe("limitReached", () => {
  it("closes the day exactly at the limit, not one card early or late", () => {
    expect(limitReached(free(49), 50)).toBe(false);
    expect(limitReached(free(50), 50)).toBe(true);
    expect(limitReached(free(51), 50)).toBe(true);
  });

  it("never fires for a supporter or with no limit set", () => {
    expect(limitReached(paid(5000), 50)).toBe(false);
    expect(limitReached(free(5000), null)).toBe(false);
  });
});

describe("shouldWarn", () => {
  it("stays quiet until the last stretch", () => {
    expect(shouldWarn(free(0), 50)).toBe(false);
    expect(shouldWarn(free(50 - WARN_AT - 1), 50)).toBe(false);
    expect(shouldWarn(free(50 - WARN_AT), 50)).toBe(true);
    expect(shouldWarn(free(49), 50)).toBe(true);
  });

  it("says nothing once the day has closed — the trail map is saying it", () => {
    expect(shouldWarn(free(50), 50)).toBe(false);
    expect(shouldWarn(free(60), 50)).toBe(false);
  });

  it("never warns an unmetered reader", () => {
    expect(shouldWarn(paid(49), 50)).toBe(false);
    expect(shouldWarn(free(49), null)).toBe(false);
  });

  it("handles a limit smaller than the warning window without warning early", () => {
    // With a limit of 3 (the value the browser test uses) every stop is inside
    // the window, so the line would show from the very first card. Confirm that
    // is what happens rather than something undefined: a tiny limit is a test
    // configuration, not a shipping one.
    expect(shouldWarn(free(0), 3)).toBe(true);
    expect(shouldWarn(free(3), 3)).toBe(false);
  });
});
