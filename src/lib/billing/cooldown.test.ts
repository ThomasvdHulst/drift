import { describe, it, expect } from "vitest";
import {
  assessCooldown,
  cooldownEnd,
  countdownTickMs,
  formatRemaining,
  REFUND_COOLDOWN_DAYS,
  REFUND_COOLDOWN_LABEL,
  type CooldownRow,
} from "./cooldown";

const NOW = new Date("2026-08-26T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * HOUR).toISOString();

const row = (over: Partial<CooldownRow> = {}): CooldownRow => ({
  refunded_at: hoursAgo(1),
  refund_count: 1,
  ...over,
});

describe("the period", () => {
  it("runs seven days from the refund", () => {
    expect(REFUND_COOLDOWN_DAYS).toBe(7);
    expect(cooldownEnd(new Date("2026-08-01T09:00:00Z")).toISOString()).toBe(
      "2026-08-08T09:00:00.000Z",
    );
  });

  it("says the same thing in words as in digits", () => {
    // The written label is what the copy and the emails use. If the number is
    // ever retuned and this is not, the app starts promising a period it does
    // not enforce, which is precisely the kind of quiet dishonesty §2 forbids.
    const words = ["zero", "one", "two", "three", "four", "five", "six", "seven",
      "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"];
    expect(REFUND_COOLDOWN_LABEL).toBe(
      `${words[REFUND_COOLDOWN_DAYS]} ${REFUND_COOLDOWN_DAYS === 1 ? "day" : "days"}`,
    );
  });

  it("rounds the days left UP, so eleven hours is not reported as zero", () => {
    // The mirror of withdrawal.ts: there rounding down would deny somebody a
    // right they still hold, here it would promise a purchase that is still
    // refused. Both directions of the same "the sentence must be true" rule.
    const refunded = "2026-08-20T01:00:00Z";
    const eleven = assessCooldown(row({ refunded_at: refunded }), new Date("2026-08-26T14:00:00Z"));
    expect(eleven.kind === "blocked" && eleven.daysLeft).toBe(1);
    // And the moment it runs out it is over, rather than a "0 days" wait.
    expect(assessCooldown(row({ refunded_at: refunded }), new Date("2026-08-27T01:00:00Z")).kind)
      .toBe("clear");
  });
});

describe("assessCooldown", () => {
  it("is clear when there is no row at all", () => {
    expect(assessCooldown(null, NOW).kind).toBe("clear");
    expect(assessCooldown(undefined, NOW).kind).toBe("clear");
  });

  it("is clear when nothing has ever been refunded", () => {
    // The ordinary case: a first purchase, or an unlock that was never given
    // back. `refunded_at` is the only trigger, so a row without one buys freely.
    expect(assessCooldown(row({ refunded_at: null }), NOW).kind).toBe("clear");
    expect(assessCooldown({}, NOW).kind).toBe("clear");
  });

  it("blocks for the rest of the period after a fresh refund", () => {
    const v = assessCooldown(row({ refunded_at: hoursAgo(1) }), NOW);
    expect(v.kind).toBe("blocked");
    if (v.kind !== "blocked") return;
    expect(v.msLeft).toBe(REFUND_COOLDOWN_DAYS * DAY - HOUR);
    expect(v.daysLeft).toBe(7);
    expect(v.until.toISOString()).toBe("2026-09-02T11:00:00.000Z");
    expect(v.refunds).toBe(1);
  });

  it("clears the moment the period is up, and stays clear", () => {
    const exactly = new Date(NOW.getTime() - REFUND_COOLDOWN_DAYS * DAY).toISOString();
    expect(assessCooldown(row({ refunded_at: exactly }), NOW).kind).toBe("clear");
    expect(assessCooldown(row({ refunded_at: hoursAgo(24 * 30) }), NOW).kind).toBe("clear");
  });

  it("still blocks one second before the end", () => {
    const almost = new Date(NOW.getTime() - REFUND_COOLDOWN_DAYS * DAY + 1000).toISOString();
    const v = assessCooldown(row({ refunded_at: almost }), NOW);
    expect(v.kind).toBe("blocked");
    if (v.kind !== "blocked") return;
    expect(v.msLeft).toBe(1000);
    expect(v.daysLeft).toBe(1);
  });

  it("reports the refund count, defaulting to zero when it is missing", () => {
    const many = assessCooldown(row({ refund_count: 4 }), NOW);
    expect(many.kind === "blocked" && many.refunds).toBe(4);
    const none = assessCooldown(row({ refund_count: null }), NOW);
    expect(none.kind === "blocked" && none.refunds).toBe(0);
  });

  it("does not let the count change the rule", () => {
    // Deliberate: `refund_count` is for the owner's eyes, not for the gate.
    // A fifth refund waits exactly as long as a first one does.
    const one = assessCooldown(row({ refund_count: 1 }), NOW);
    const five = assessCooldown(row({ refund_count: 5 }), NOW);
    expect(one.kind === "blocked" && one.msLeft).toBe(five.kind === "blocked" && five.msLeft);
  });

  it("FAILS OPEN on an unreadable timestamp", () => {
    // A row we cannot parse is a database problem, not a reason to refuse
    // somebody's money forever. Same contract as the meter (CLAUDE.md §4).
    expect(assessCooldown(row({ refunded_at: "not a date" }), NOW).kind).toBe("clear");
    expect(assessCooldown(row({ refunded_at: "" }), NOW).kind).toBe("clear");
  });

  it("clamps a refund dated in the future to the period's own length", () => {
    // Only clock skew produces one. Trusting it would block for longer than
    // seven days, which is a promise the page would then be making falsely.
    const future = new Date(NOW.getTime() + 5 * DAY).toISOString();
    const v = assessCooldown(row({ refunded_at: future }), NOW);
    expect(v.kind).toBe("blocked");
    if (v.kind !== "blocked") return;
    expect(v.msLeft).toBe(REFUND_COOLDOWN_DAYS * DAY);
    // The three fields describe one moment or none of them can be trusted.
    expect(v.until.getTime()).toBe(NOW.getTime() + REFUND_COOLDOWN_DAYS * DAY);
    expect(v.daysLeft).toBe(REFUND_COOLDOWN_DAYS);
  });

  it("keeps until, msLeft and daysLeft describing the same moment", () => {
    const v = assessCooldown(row({ refunded_at: hoursAgo(30) }), NOW);
    expect(v.kind).toBe("blocked");
    if (v.kind !== "blocked") return;
    expect(v.until.getTime() - NOW.getTime()).toBe(v.msLeft);
    expect(v.daysLeft).toBe(Math.ceil(v.msLeft / DAY));
  });
});

describe("formatRemaining", () => {
  it("shows days and hours above a day", () => {
    expect(formatRemaining(6 * DAY + 3 * HOUR)).toBe("6 days and 3 hours");
    expect(formatRemaining(1 * DAY + 1 * HOUR)).toBe("1 day and 1 hour");
  });

  it("drops the smaller unit when it is zero", () => {
    expect(formatRemaining(2 * DAY)).toBe("2 days");
    expect(formatRemaining(3 * HOUR)).toBe("3 hours");
    expect(formatRemaining(5 * 60 * 1000)).toBe("5 minutes");
  });

  it("shows hours and minutes under a day", () => {
    expect(formatRemaining(23 * HOUR + 11 * 60 * 1000)).toBe("23 hours and 11 minutes");
  });

  it("shows minutes and seconds under an hour", () => {
    expect(formatRemaining(9 * 60 * 1000 + 4000)).toBe("9 minutes and 4 seconds");
  });

  it("shows seconds alone in the last minute, rounded up", () => {
    expect(formatRemaining(45_400)).toBe("46 seconds");
    expect(formatRemaining(1000)).toBe("1 second");
  });

  it("never renders a negative or empty wait", () => {
    expect(formatRemaining(0)).toBe("a moment");
    expect(formatRemaining(-5000)).toBe("a moment");
  });

  it("uses no dash anywhere", () => {
    // House rule for user-facing copy, and this string is copy.
    for (const ms of [6 * DAY + 3 * HOUR, 2 * HOUR, 90_000, 900]) {
      expect(formatRemaining(ms)).not.toMatch(/[–—-]/);
    }
  });
});

describe("countdownTickMs", () => {
  it("ticks once a second only while seconds are on screen", () => {
    expect(countdownTickMs(59 * 60 * 1000)).toBe(1000);
    expect(countdownTickMs(500)).toBe(1000);
  });

  it("ticks once a minute above an hour, because nothing faster can change", () => {
    expect(countdownTickMs(HOUR)).toBe(60_000);
    expect(countdownTickMs(6 * DAY)).toBe(60_000);
  });
});
