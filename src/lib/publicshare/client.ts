// ---------------------------------------------------------------------------
// Public share links (Phase 27): the browser half.
//
// Creating, listing and revoking a link, all as the signed-in owner. Reading one
// is NOT here: that happens on the server, anonymously, in ./server.ts, because
// the reader may have no account and WhatsApp's preview crawler runs no
// JavaScript.
//
// Same contract as lib/social/client.ts: every function guards getSupabase()
// null and is try/caught, so an unconfigured or unreachable backend degrades to
// "you cannot make a link right now" rather than breaking the page the button
// sits on (CLAUDE.md §4).
// ---------------------------------------------------------------------------

import { getSupabase } from "@/lib/supabase/client";
import { newShareToken, type PublicShareKind } from "./link";

/** A link the owner has handed out, as their own list and data export see it. */
export interface MyPublicShare {
  token: string;
  kind: PublicShareKind;
  title: string;
  createdAt: string;
  revokedAt: string | null;
}

export type CreateResult =
  | { token: string; error: null }
  | { token: null; error: string };

/**
 * Mint a link for a snapshot.
 *
 * The token is generated HERE rather than by the database, so the caller has it
 * before the round trip and the share sheet can open in the same user gesture.
 * That matters more than it looks: `navigator.share()` requires transient
 * activation, and a gesture does not survive an await on some browsers. It costs
 * nothing, because the token's secrecy comes from the CSPRNG, not from where it
 * was generated.
 */
export async function createPublicShare(
  kind: PublicShareKind,
  payload: unknown,
): Promise<CreateResult> {
  const sb = getSupabase();
  if (!sb) return { token: null, error: "Sharing needs a connection." };
  try {
    const { data: session } = await sb.auth.getSession();
    const owner = session.session?.user.id;
    if (!owner) return { token: null, error: "Sign in to share." };

    const token = newShareToken();
    const { error } = await sb
      .from("public_shares")
      .insert({ token, owner_id: owner, kind, payload });
    if (error) return { token: null, error: "Could not create the link." };
    return { token, error: null };
  } catch {
    return { token: null, error: "Could not create the link." };
  }
}

/**
 * Stop a link working.
 *
 * An update rather than a delete, so the owner can still see in their own list
 * (and their data export) that the link existed and was withdrawn. To a reader
 * the two are identical: `get_public_share()` filters on `revoked_at is null`,
 * so a revoked token and an invented one produce exactly the same nothing.
 */
export async function revokePublicShare(token: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb
      .from("public_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token", token);
    return !error;
  } catch {
    return false;
  }
}

/** Every link this user has made. RLS scopes it to them; the filter is not the
 *  security boundary, the policy is. */
export async function listMyPublicShares(): Promise<MyPublicShare[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("public_shares")
      .select("token,kind,payload,created_at,revoked_at")
      .order("created_at", { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map((r) => {
      const row = r as {
        token: string;
        kind: PublicShareKind;
        payload: { name?: string; displayTitle?: string };
        created_at: string;
        revoked_at: string | null;
      };
      return {
        token: row.token,
        kind: row.kind,
        // Denormalised for display only. The payload is the source of truth.
        title:
          (row.kind === "trail" ? row.payload?.name : row.payload?.displayTitle) ||
          "Untitled",
        createdAt: row.created_at,
        revokedAt: row.revoked_at,
      };
    });
  } catch {
    return [];
  }
}
