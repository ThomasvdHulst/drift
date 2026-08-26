// ---------------------------------------------------------------------------
// The waiting period after a refund, as rules (Phase 32B).
//
// A refund returns the €7 and keeps the fee Stripe charged to take it. That is
// the cost of honouring the fourteen day right and it is worth paying. What is
// not worth paying is the same fee over and over: buy, refund, buy, refund is a
// loop in which the money always returns to the buyer and only the seller is
// ever out of pocket. So a refund starts a wait before that account can buy
// again.
//
// WHAT THIS IS NOT. It is not a punishment and it must never be written as one.
// The right of withdrawal is untouched: the refund itself is still immediate,
// still needs no reason, and nothing here delays it or asks anybody to justify
// it. The wait applies only to BUYING AGAIN, which is not a right anybody has,
// and it is always liftable by writing to a human. Copy that treats a reader as
// a suspect would be exactly the tone §2 exists to keep out of this app.
//
// Pure and unit tested, and used by BOTH sides on purpose: the buy button reads
// the reader's own entitlement row and hides itself with this, and the checkout
// route re-checks with the same function before creating a Stripe session. One
// set of rules, so a stale page cannot promise a purchase the server refuses.
// The server is the gate; the client copy is a courtesy.
// ---------------------------------------------------------------------------

/**
 * How long after a refund before the unlock can be bought again.
 *
 * Seven days is chosen to be longer than an impulse and shorter than a grudge:
 * long enough that cycling is pointless, short enough that a reader who genuinely
 * changed their mind twice is not left stranded for a month. If it ever needs to
 * grow with the number of refunds, `refund_count` on the row is the hook and this
 * becomes a function of it; nothing else has to move.
 */
export const REFUND_COOLDOWN_DAYS = 7;

/**
 * The same period written out, for copy that reads better in words than digits.
 *
 * It lives next to the number, with a test asserting the two agree, because a
 * period stated in two places is a period that eventually gets changed in one.
 */
export const REFUND_COOLDOWN_LABEL = "seven days";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** The entitlement columns this reasons over. Only these two matter. */
export interface CooldownRow {
  /** When money was last given back. Never cleared by a later purchase. */
  refunded_at?: string | null;
  /** How many times, ever. Informational: the rule does not read it. */
  refund_count?: number | null;
}

export type RefundCooldown =
  /** Nothing in the way: no refund on record, or the wait is over. */
  | { kind: "clear" }
  | {
      kind: "blocked";
      /** The moment buying becomes possible again. */
      until: Date;
      /** Milliseconds still to wait. Drives the live countdown. */
      msLeft: number;
      /** Whole days, rounded UP, for a coarse "N days" reading. */
      daysLeft: number;
      /** How many refunds are on record, for the log and the owner. */
      refunds: number;
    };

/** The arm of the union the UI actually renders. */
export type BlockedCooldown = Extract<RefundCooldown, { kind: "blocked" }>;

/** The moment the wait started by this refund runs out. */
export function cooldownEnd(refundedAt: Date): Date {
  return new Date(refundedAt.getTime() + REFUND_COOLDOWN_DAYS * DAY_MS);
}

export function assessCooldown(
  row: CooldownRow | null | undefined,
  now: Date = new Date(),
): RefundCooldown {
  const stamp = row?.refunded_at;
  if (!stamp) return { kind: "clear" };

  const refundedAt = new Date(stamp);
  // An unparseable timestamp is a database we cannot read, not a reason to
  // refuse a sale. Failing OPEN here matches the meter (CLAUDE.md §4): the
  // worst case is one purchase we should have made wait, and the alternative is
  // a reader who can never buy because of a bad row.
  if (Number.isNaN(refundedAt.getTime())) return { kind: "clear" };

  const end = cooldownEnd(refundedAt);
  const raw = end.getTime() - now.getTime();
  if (raw <= 0) return { kind: "clear" };

  // A refund dated in the FUTURE would otherwise block for longer than the
  // period itself. Only clock skew can produce one, so it is clamped rather
  // than trusted: the wait can never exceed its own length. `until` is clamped
  // with it, and `daysLeft` derived from the same number, so the three cannot
  // describe different moments to the page that renders all three.
  const limit = REFUND_COOLDOWN_DAYS * DAY_MS;
  const msLeft = Math.min(raw, limit);

  return {
    kind: "blocked",
    until: msLeft === raw ? end : new Date(now.getTime() + msLeft),
    msLeft,
    daysLeft: Math.ceil(msLeft / DAY_MS),
    refunds: typeof row?.refund_count === "number" ? row.refund_count : 0,
  };
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/**
 * The remaining wait as a sentence fragment: "6 days and 3 hours".
 *
 * Two units, never three, and the smaller one is dropped when it is zero. A
 * countdown to the second reads like a launch sequence and this is a quiet
 * reading room, so seconds only appear in the last minutes, where they are the
 * only thing that moves. No dashes: this is user-facing copy.
 */
export function formatRemaining(msLeft: number): string {
  const ms = Math.max(0, msLeft);
  if (ms >= DAY_MS) {
    const days = Math.floor(ms / DAY_MS);
    const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
    return hours ? `${plural(days, "day")} and ${plural(hours, "hour")}` : plural(days, "day");
  }
  if (ms >= HOUR_MS) {
    const hours = Math.floor(ms / HOUR_MS);
    const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
    return minutes
      ? `${plural(hours, "hour")} and ${plural(minutes, "minute")}`
      : plural(hours, "hour");
  }
  if (ms >= MINUTE_MS) {
    const minutes = Math.floor(ms / MINUTE_MS);
    const seconds = Math.floor((ms % MINUTE_MS) / SECOND_MS);
    return seconds
      ? `${plural(minutes, "minute")} and ${plural(seconds, "second")}`
      : plural(minutes, "minute");
  }
  const seconds = Math.ceil(ms / SECOND_MS);
  return seconds > 0 ? plural(seconds, "second") : "a moment";
}

/**
 * How often a countdown showing `formatRemaining(msLeft)` needs to be redrawn.
 *
 * Once a second only when seconds are on screen. Above an hour the smallest unit
 * shown is a minute, so a minute is as often as the text can possibly change,
 * and re-rendering a page every second for six days to change nothing is the
 * kind of thing that quietly costs a phone its battery.
 */
export function countdownTickMs(msLeft: number): number {
  return msLeft < HOUR_MS ? SECOND_MS : MINUTE_MS;
}
