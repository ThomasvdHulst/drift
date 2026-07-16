import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// The single browser Supabase client (Phase 9). Everything cloud-facing goes
// through getSupabase(); it returns null whenever Supabase isn't configured
// (env missing) or we're server-side. That null is the spine of the app's
// graceful degradation (CLAUDE.md §4): no config ⇒ the app is exactly the old
// 100%-local app, and any caller can early-return on null.
//
// Why direct-from-browser (a sanctioned exception to §4's "proxy everything"):
// Supabase is DESIGNED for direct browser access secured by the publishable key
// + Row-Level Security — that is its security model. The secret key is never
// shipped here; only NEXT_PUBLIC_* values are, and RLS enforces per-user access.
// ---------------------------------------------------------------------------

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** True when the two public env vars are present (cloud features can run). */
export function isCloudConfigured(): boolean {
  return Boolean(URL && PUBLISHABLE_KEY);
}

let _client: SupabaseClient | null = null;

/**
 * The lazy singleton. Returns null (⇒ stay local-only) when unconfigured or
 * when called during SSR (auth session persistence needs the browser). Never
 * throws — construction failures degrade to null.
 */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!isCloudConfigured()) return null;
  if (_client) return _client;
  try {
    _client = createClient(URL!, PUBLISHABLE_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "drift-auth",
      },
    });
  } catch {
    _client = null;
  }
  return _client;
}
