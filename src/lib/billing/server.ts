import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "../site";

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

/** True when this account holds a live (unrevoked) unlock. */
export async function hasEntitlement(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("entitlements")
    .select("user_id")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}
