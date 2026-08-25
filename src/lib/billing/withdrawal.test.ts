import { describe, it, expect } from "vitest";
import {
  assessWithdrawal,
  withdrawalDeadline,
  daysLeft,
  WITHDRAWAL_DAYS,
  type EntitlementRow,
} from "./withdrawal";

const NOW = new Date("2026-08-25T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const row = (over: Partial<EntitlementRow> = {}): EntitlementRow => ({
  source: "purchase",
  granted_at: daysAgo(1),
  revoked_at: null,
  stripe_payment_intent: "pi_1",
  ...over,
});

describe("the window", () => {
  it("runs 14 days from the purchase", () => {
    expect(withdrawalDeadline(new Date("2026-08-01T00:00:00Z")).toISOString()).toBe(
      "2026-08-15T00:00:00.000Z",
    );
    expect(WITHDRAWAL_DAYS).toBe(14);
  });

  it("rounds the days left UP, so eleven hours is not reported as zero", () => {
    // Rounding down would tell somebody who still has, legally, most of a day
    // that their right has gone. Erring towards the consumer is the right
    // direction here and the direction the law errs in.
    const granted = new Date("2026-08-25T01:00:00Z");
    const almostUp = new Date("2026-09-08T01:00:00Z"); // exactly 14 days later
    expect(daysLeft(granted, new Date("2026-09-07T14:00:00Z"))).toBe(1);
    expect(daysLeft(granted, almostUp)).toBe(0);
  });

  it("never goes negative", () => {
    expect(daysLeft(new Date("2026-01-01T00:00:00Z"), NOW)).toBe(0);
  });
});

describe("who may withdraw automatically", () => {
  it("a recent purchase can", () => {
    const a = assessWithdrawal(row(), NOW);
    expect(a).toMatchObject({ kind: "eligible", paymentIntent: "pi_1", daysLeft: 13 });
  });

  it("on the last day, still can", () => {
    expect(assessWithdrawal(row({ granted_at: daysAgo(13.9) }), NOW).kind).toBe(
      "eligible",
    );
  });

  it("a day after the window closes, cannot", () => {
    const a = assessWithdrawal(row({ granted_at: daysAgo(15) }), NOW);
    expect(a.kind).toBe("expired");
  });

  it("someone who never bought anything has nothing to withdraw", () => {
    expect(assessWithdrawal(null, NOW).kind).toBe("none");
    expect(assessWithdrawal(undefined, NOW).kind).toBe("none");
  });

  it("an already refunded purchase cannot be refunded twice", () => {
    expect(assessWithdrawal(row({ revoked_at: daysAgo(0.5) }), NOW).kind).toBe(
      "already-revoked",
    );
  });

  it("a grandfathered or hand-granted unlock is not refundable, because it cost nothing", () => {
    // Offering these readers a refund button would be offering to give back
    // money they never paid, and the button would fail when pressed.
    expect(assessWithdrawal(row({ source: "beta" }), NOW).kind).toBe("not-purchased");
    expect(assessWithdrawal(row({ source: "manual" }), NOW).kind).toBe(
      "not-purchased",
    );
  });

  it("a purchase with no payment reference goes to a human, not to a refusal", () => {
    // The money exists; this code just cannot find it. Telling the reader "you
    // have no right" would be false, so the route sends them to the contact form
    // and the owner refunds it by hand.
    expect(assessWithdrawal(row({ stripe_payment_intent: null }), NOW).kind).toBe(
      "unrefundable",
    );
  });

  it("survives an unparseable date without granting or crashing", () => {
    expect(assessWithdrawal(row({ granted_at: "not a date" }), NOW).kind).toBe(
      "unrefundable",
    );
  });

  it("checks revocation BEFORE the window, so an old refund is not reported as expired", () => {
    // Both are true for a refund made months ago. "Already refunded" is the
    // answer that tells the reader what actually happened to their money.
    const a = assessWithdrawal(
      row({ granted_at: daysAgo(60), revoked_at: daysAgo(59) }),
      NOW,
    );
    expect(a.kind).toBe("already-revoked");
  });
});
