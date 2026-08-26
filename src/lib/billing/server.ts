import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "../site";
import type { CooldownRow } from "./cooldown";
import type { EntitlementRow } from "./withdrawal";

// ---------------------------------------------------------------------------
// Server-only plumbing for the supporter unlock (Phase 32).
//
// NOTHING HERE MAY EVER BE IMPORTED FROM A CLIENT COMPONENT. It holds the two
// keys that bypass every access control in the system: Stripe's secret key, and
// Supabase's service-role key (which ignores Row-Level Security). Neither is
// prefixed NEXT_PUBLIC_, so a stray import would fail at build rather than leak,
// but the rule is worth stating where the keys are.
//
// Both getters return null when unconfigured rather than throwing, which is the
// same graceful-degradation contract the rest of the app runs on (CLAUDE.md §4):
// a clone with no Stripe account still builds, still runs, and still reads. The
// only thing that stops working is buying, which is correct.
// ---------------------------------------------------------------------------

/** The Stripe client, or null when `STRIPE_SECRET_KEY` is absent. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, {
    // Named so a reader can tell which integration a request came from in the
    // Stripe dashboard's logs, which matters the first time something is wrong.
    appInfo: { name: "Drift", url: siteUrl() },
  });
}

/** The service-role Supabase client, or null when unconfigured. */
export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The bearer token on a request, or "" when there isn't one. */
export function bearerToken(request: Request): string {
  const authz = request.headers.get("authorization") ?? "";
  return authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : "";
}

/**
 * Who is calling, verified against Supabase. Null for a missing, expired or
 * forged token.
 *
 * The same shape `/api/account/delete` uses, and for the same reason: a route
 * holding the service key must never take the caller's word for who they are.
 */
export async function callerFromToken(
  admin: SupabaseClient,
  token: string,
): Promise<{ id: string; email?: string } | null> {
  if (!token) return null;
  try {
    const { data, error } = await admin.auth.getUser(token);
    const user = data?.user;
    if (error || !user?.id) return null;
    return { id: user.id, email: user.email ?? undefined };
  } catch {
    return null;
  }
}

/**
 * Where Stripe should send the reader back to.
 *
 * Prefers the origin the request actually came from, but ONLY after checking it
 * against an allowlist, because these values are handed to Stripe as redirect
 * targets and an unchecked `Origin` header is an open redirect. Localhost is
 * allowed so a test-mode purchase in development returns to the dev server
 * instead of bouncing the developer onto the production site mid-flow.
 */
export function returnOrigin(request: Request): string {
  const site = siteUrl();
  const origin = request.headers.get("origin") ?? "";
  if (origin === site) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return site;
}

// ---------------------------------------------------------------------------
// The entitlement row, read and written by the routes that hold the secret key.
// ---------------------------------------------------------------------------

/** Everything a server path reasons over. One row per account, `user_id` keyed. */
export type StoredEntitlement = EntitlementRow & CooldownRow;

/**
 * The columns of it, in one place.
 *
 * Named rather than repeated because the routes that read this row must agree on
 * what they read: a select that quietly omits `refunded_at` does not fail, it
 * just makes `assessCooldown` see undefined and answer "clear", which is a gate
 * that silently stops gating. Adding a column here is how a new rule reaches
 * every caller at once.
 */
export const ENTITLEMENT_COLUMNS =
  "source, granted_at, revoked_at, stripe_payment_intent, refunded_at, refund_count";

/** The same list before migration 0006 added the refund columns. See below. */
const ENTITLEMENT_COLUMNS_PRE_0006 =
  "source, granted_at, revoked_at, stripe_payment_intent";

/**
 * ⚠️ THE DEPLOY WINDOW. Code reaches production on a push; migration 0006 is a
 * human pasting SQL into Supabase Studio, and the two will not be simultaneous.
 * In between, `entitlements` has no `refunded_at`, and PostgREST answers a select
 * naming it with 42703 rather than ignoring it. Left alone that is not a cooldown
 * that does not work yet, it is an entitlement read that returns NOTHING, which
 * would take the refund button off the account page: the statutory withdrawal
 * function, gone, because a column was missing.
 *
 * So a missing column is caught and the read is repeated without them. The
 * cooldown is simply inactive until the migration lands (it fails OPEN, like
 * everything optional here), and every other path carries on exactly as before.
 * Safe to delete once 0006 is applied everywhere; harmless to leave.
 */
function needsMigration(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" || /refunded_at|refund_count/.test(error.message ?? "")
  );
}

let warnedAboutMigration = false;
function warnAboutMigration(): void {
  if (warnedAboutMigration) return;
  warnedAboutMigration = true;
  console.warn(
    "[billing] `entitlements` has no refund columns, so the refund cooldown is " +
      "INACTIVE. Apply supabase/migrations/0006_refund_cooldown.sql in Supabase " +
      "Studio. Everything else works normally.",
  );
}

/**
 * This account's entitlement row.
 *
 * `failed` separates "there is no such row" from "we could not look", because
 * the two mean opposite things to a caller: the first is a reader who never
 * bought anything, the second is a reader whose purchase we must not deny.
 */
export async function readEntitlement(
  admin: SupabaseClient,
  userId: string,
): Promise<{ row: StoredEntitlement | null; failed: boolean }> {
  const read = (columns: string) =>
    admin.from("entitlements").select(columns).eq("user_id", userId).limit(1);

  let { data, error } = await read(ENTITLEMENT_COLUMNS);
  if (needsMigration(error)) {
    warnAboutMigration();
    ({ data, error } = await read(ENTITLEMENT_COLUMNS_PRE_0006));
  }
  if (error) {
    console.error("[billing] could not read entitlement", error);
    return { row: null, failed: true };
  }
  return {
    row: (data?.[0] as StoredEntitlement | undefined) ?? null,
    failed: false,
  };
}

/** True when this account holds a live (unrevoked) unlock. */
export function holdsUnlock(row: StoredEntitlement | null): boolean {
  return row !== null && !row.revoked_at;
}

/**
 * Money went back: revoke the unlock and start the waiting period (Phase 32B).
 *
 * BOTH refund paths end here, which is the point. A refund can begin in two
 * places, the reader pressing the button or the owner pressing Refund in the
 * Stripe dashboard and the `charge.refunded` webhook arriving, and if only one
 * of them recorded `refunded_at` the cooldown would depend on which way the
 * refund happened to travel. Hence one function, matched EITHER by account (the
 * withdraw route knows who is calling) or by payment (the webhook knows only the
 * payment the event refers to).
 *
 * IDEMPOTENT, and it has to be: Stripe delivers at least once, and the withdraw
 * route revokes before its own webhook arrives. Both the read and the write
 * filter on `revoked_at is null`, so the second caller matches no row, returns
 * `applied: false`, and the count is not bumped twice for one refund. Postgres
 * re-checks that filter after taking the row lock, so even two genuinely
 * concurrent deliveries produce exactly one increment.
 *
 * ⚠️ It deliberately does NOT clear `revoked_at` or touch anything else. The
 * next purchase clears the revoke, which is what makes buying again work at all;
 * `refunded_at` survives that, which is what makes the cooldown outlive the
 * thing that caused it.
 *
 * REVOKING COMES FIRST. If the refund columns are not there yet (the deploy
 * window above), it still revokes, without the cooldown. Losing the waiting
 * period is a nuisance; leaving a refunded reader holding the unlock is a bug
 * that costs money, so that is the half that is never allowed to fail.
 */
export async function markRefunded(
  admin: SupabaseClient,
  match: { userId: string } | { paymentIntent: string },
): Promise<{ applied: boolean; refunds: number }> {
  // One query shape, two column lists, so the pre-0006 retry cannot drift from
  // the real one. `columns` is a plain string, which is also why the row type is
  // asserted below rather than inferred.
  const lookup = (columns: string) => {
    const q = admin.from("entitlements").select(columns);
    const scoped =
      "userId" in match
        ? q.eq("user_id", match.userId)
        : q.eq("stripe_payment_intent", match.paymentIntent);
    return scoped.is("revoked_at", null).limit(1);
  };

  let counting = true;
  let result = await lookup("user_id, refund_count");
  if (needsMigration(result.error)) {
    warnAboutMigration();
    counting = false;
    result = await lookup("user_id");
  }
  if (result.error) throw result.error;

  const row = result.data?.[0] as unknown as
    | { user_id: string; refund_count?: number | null }
    | undefined;
  if (!row) return { applied: false, refunds: 0 };

  const refunds = (row.refund_count ?? 0) + 1;
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("entitlements")
    .update(
      counting
        ? { revoked_at: now, refunded_at: now, refund_count: refunds }
        : { revoked_at: now },
    )
    .eq("user_id", row.user_id)
    .is("revoked_at", null);
  if (updateError) throw updateError;

  return { applied: true, refunds: counting ? refunds : 0 };
}
