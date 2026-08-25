// ---------------------------------------------------------------------------
// The right to change your mind, as rules (Phase 32).
//
// Drift does not exclude the 14 day right of withdrawal, which sellers of
// digital goods are allowed to do and most of them do. That decision is what
// makes this file small: there is no waiver to record, no "did they consent to
// immediate supply" to reason about, and no 12 month fallback period to worry
// about having triggered by getting the consent subtly wrong.
//
// WHY IT IS AUTOMATIC. The obligation since 19 June 2026 is a withdrawal
// FUNCTION: continuously available, and not a request the trader may sit on. A
// form that emails the owner to go and press Refund in a dashboard technically
// satisfies it and practically does not, because the reader's money and access
// then depend on somebody reading their inbox. Pressing the button issues the
// refund. The owner is not in the loop, which is the point.
//
// Pure and unit tested. The route does the I/O; every rule about WHO may
// withdraw and UNTIL WHEN lives here.
// ---------------------------------------------------------------------------

/** The statutory period, in days, for a distance contract with a consumer. */
export const WITHDRAWAL_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The entitlement row this reasons over. Only the fields that matter. */
export interface EntitlementRow {
  source: string;
  granted_at: string;
  revoked_at: string | null;
  stripe_payment_intent: string | null;
}

export type Withdrawability =
  /** Refundable right now, through Stripe, with no human in the loop. */
  | { kind: "eligible"; paymentIntent: string; deadline: Date; daysLeft: number }
  /** Nothing has been bought. */
  | { kind: "none" }
  /** Already given back. */
  | { kind: "already-revoked" }
  /** Held, but never paid for: a grandfathered or hand-granted unlock. */
  | { kind: "not-purchased" }
  /** Paid for, but the money cannot be traced to a payment to refund. */
  | { kind: "unrefundable" }
  /** Past the statutory window. Not the end of the road, but not automatic. */
  | { kind: "expired"; deadline: Date };

/** The last moment a withdrawal is a right rather than a favour. */
export function withdrawalDeadline(grantedAt: Date): Date {
  return new Date(grantedAt.getTime() + WITHDRAWAL_DAYS * DAY_MS);
}

/**
 * Whole days still available, rounded UP.
 *
 * Up, not down, because this number is shown to a reader as "you have N days
 * left" and rounding down would tell somebody with eleven hours remaining that
 * they have none. Erring towards the consumer is also the direction the law
 * errs in when a period is ambiguous.
 */
export function daysLeft(grantedAt: Date, now: Date): number {
  const ms = withdrawalDeadline(grantedAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / DAY_MS));
}

export function assessWithdrawal(
  row: EntitlementRow | null | undefined,
  now: Date = new Date(),
): Withdrawability {
  if (!row) return { kind: "none" };
  if (row.revoked_at) return { kind: "already-revoked" };

  // A grandfathered or hand-granted unlock cost nothing, so there is nothing to
  // give back. Saying so plainly beats offering a refund button that would fail.
  if (row.source !== "purchase") return { kind: "not-purchased" };

  const grantedAt = new Date(row.granted_at);
  if (Number.isNaN(grantedAt.getTime())) return { kind: "unrefundable" };

  const deadline = withdrawalDeadline(grantedAt);
  if (now.getTime() > deadline.getTime()) return { kind: "expired", deadline };

  // Inside the window but with no payment reference: the money exists somewhere
  // and this code cannot find it. Deliberately NOT treated as "no right" — the
  // reader is sent to a human, who can refund it in the dashboard.
  if (!row.stripe_payment_intent) return { kind: "unrefundable" };

  return {
    kind: "eligible",
    paymentIntent: row.stripe_payment_intent,
    deadline,
    daysLeft: daysLeft(grantedAt, now),
  };
}
