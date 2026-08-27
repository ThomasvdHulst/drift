// ---------------------------------------------------------------------------
// Browser-side calls for the supporter unlock (Phase 32).
//
// Two things: reading the reader's OWN entitlement row, and asking to withdraw.
//
// The row is read straight from Supabase rather than through a route of our
// own, because the `see own entitlement` policy already says exactly who may
// read it and there is nothing a server hop would add. (Writes are the opposite
// and go nowhere near the browser: the tables have no write policy at all.)
//
// Reading it client-side is what lets the account page say "you have 11 days
// left" without a round trip of our own, and it means the SAME `assessWithdrawal`
// decides what the page offers and what the route allows. One set of rules, so
// the button cannot promise something the server then refuses.
// ---------------------------------------------------------------------------

import { getSupabase } from "../supabase/client";
import type { CooldownRow } from "./cooldown";
import type { EntitlementRow } from "./withdrawal";

/** The reader's own row: what they may withdraw, and what they must wait for. */
export type MyEntitlement = EntitlementRow & CooldownRow;

/**
 * The signed-in reader's entitlement, or null (none, or we could not look).
 *
 * No `.eq("user_id", …)`: the `see own entitlement` policy is the filter, and
 * adding one here would only make it look like the filter lives in the browser.
 * The refund columns come back under that same policy, which is what lets the
 * buy button count down to its own return without a route of our own.
 */
export async function fetchMyEntitlement(): Promise<MyEntitlement | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("entitlements")
      .select(
        "source, granted_at, revoked_at, stripe_payment_intent, refunded_at, refund_count",
      )
      .limit(1);
    if (error) return null;
    return (data?.[0] as MyEntitlement) ?? null;
  } catch {
    return null;
  }
}

/**
 * Everything the two supporter tables hold about this reader, for the data
 * export (GDPR Articles 15 and 20).
 *
 * ⚠️ WHY A SECOND READER RATHER THAN REUSING `fetchMyEntitlement`. That one
 * returns null for BOTH "you never bought anything" and "we could not look",
 * which is exactly the ambiguity the export must not inherit: an export that
 * silently omits a purchase record is a worse answer than one that says it could
 * not read it. So this reports `looked` separately, the way
 * `listMyPublicShares` does, and the export writes the section only when the
 * query actually ran.
 *
 * The reading counter is included because `docs/processing-record.md` row 11
 * lists it as personal data Drift holds (a user id, a date and an integer). It
 * is a rolling 30 day window that `record_stop()` prunes, so this is a short
 * list by construction, and a reader asking what Drift knows about them is
 * entitled to see it rather than be told it is too transient to mention.
 */
export type MySupporterData = {
  looked: boolean;
  /** The entitlement row, or null when the reader has never bought the unlock. */
  entitlement: MyEntitlement | null;
  /** One row per day read in the last 30, newest first. */
  readingDays: { day: string; stops: number }[];
};

export async function fetchMySupporterData(): Promise<MySupporterData> {
  const sb = getSupabase();
  const none: MySupporterData = { looked: false, entitlement: null, readingDays: [] };
  if (!sb) return none;
  try {
    // Both reads are scoped by their own `for select ... using (user_id =
    // auth.uid())` policies (migration 0005), so neither needs a filter here.
    const [ent, usage] = await Promise.all([
      // One string literal, not a concatenation: the client infers the row type
      // from the select text, and a built-up string collapses it to an error type.
      sb
        .from("entitlements")
        .select(
          "kind, source, granted_at, revoked_at, refunded_at, refund_count, stripe_customer_id, stripe_session_id, stripe_payment_intent",
        )
        .limit(1),
      sb.from("usage_daily").select("day, stops").order("day", { ascending: false }),
    ]);
    if (ent.error || usage.error) return none;
    return {
      looked: true,
      entitlement: (ent.data?.[0] as MyEntitlement) ?? null,
      readingDays: (usage.data ?? []) as { day: string; stops: number }[],
    };
  } catch {
    return none;
  }
}

export type WithdrawResult =
  | { ok: true; amountCents: number }
  | { ok: false; reason: string; error?: string };

/**
 * Ask for the refund. The server re-checks eligibility from the same rules, so
 * a stale page cannot talk it into refunding something it should not.
 */
export async function requestWithdrawal(): Promise<WithdrawResult> {
  const sb = getSupabase();
  try {
    const { data } = (await sb?.auth.getSession()) ?? { data: null };
    const token = data?.session?.access_token;
    if (!token) return { ok: false, reason: "not-signed-in" };
    const res = await fetch("/api/billing/withdraw", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      refunded?: boolean;
      amountCents?: number;
      reason?: string;
      error?: string;
      unconfigured?: boolean;
    };
    if (body.ok && body.refunded) {
      return { ok: true, amountCents: body.amountCents ?? 0 };
    }
    if (body.unconfigured) return { ok: false, reason: "unconfigured" };
    return { ok: false, reason: body.reason ?? "unknown", error: body.error };
  } catch {
    return { ok: false, reason: "network" };
  }
}
