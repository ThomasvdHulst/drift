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
