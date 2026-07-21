// ---------------------------------------------------------------------------
// Social client (Phase 10). Thin, FULLY-GUARDED calls to Supabase for the social
// layer — profiles + friend graph (M27). Unlike the Phase 9 replicator, social
// data is live-fetched (interacting with others is inherently online), but it
// must never break the app: every function guards getSupabase() null and is
// try/caught, returning empty/no-op so the core loop and local mode are safe
// even with the backend down (CLAUDE.md §4).
// ---------------------------------------------------------------------------

import { getSupabase } from "@/lib/supabase/client";
import { normalizeHandle, handleError } from "./handles";
import type { FriendRequest } from "./friends";

export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
}

async function meId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** The signed-in user's profile, or null (unset / unconfigured / offline). */
export async function getMyProfile(): Promise<Profile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const id = await meId();
    if (!id) return null;
    const { data, error } = await sb
      .from("profiles")
      .select("id,handle,display_name")
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return (data as Profile) ?? null;
  } catch {
    return null;
  }
}

export type UpsertResult = { error: string | null };

/** Create/update the signed-in user's handle + display name. */
export async function upsertProfile(
  rawHandle: string,
  displayName: string,
): Promise<UpsertResult> {
  const sb = getSupabase();
  if (!sb) return { error: "Cloud isn't set up on this device." };
  const handle = normalizeHandle(rawHandle);
  const invalid = handleError(handle);
  if (invalid) return { error: invalid };
  try {
    const id = await meId();
    if (!id) return { error: "You're not signed in." };
    const { error } = await sb.from("profiles").upsert(
      { id, handle, display_name: displayName.trim() || null },
      { onConflict: "id" },
    );
    if (error) {
      // 23505 = unique_violation → handle taken.
      if (error.code === "23505" || /duplicate|unique/i.test(error.message))
        return { error: "That handle is already taken." };
      return { error: "Couldn't save your handle. Try again." };
    }
    return { error: null };
  } catch {
    return { error: "Couldn't reach the cloud." };
  }
}

/** Find people by handle prefix (handle-only discovery). Excludes yourself. */
export async function searchByHandle(prefix: string): Promise<Profile[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const h = normalizeHandle(prefix);
  if (h.length < 2) return [];
  try {
    const id = await meId();
    const { data, error } = await sb
      .from("profiles")
      .select("id,handle,display_name")
      .like("handle", `${h}%`)
      .order("handle", { ascending: true })
      .limit(10);
    if (error) return [];
    return ((data as Profile[]) ?? []).filter((p) => p.id !== id);
  } catch {
    return [];
  }
}

export interface FriendData {
  requests: FriendRequest[];
  /** id → Profile for every "other party" I'm connected to / requested. */
  profiles: Record<string, Profile>;
  meId: string | null;
}

/** All friend_requests I'm party to (RLS-scoped) + the other parties' profiles. */
export async function listFriendData(): Promise<FriendData> {
  const sb = getSupabase();
  const empty: FriendData = { requests: [], profiles: {}, meId: null };
  if (!sb) return empty;
  try {
    const id = await meId();
    if (!id) return empty;
    const { data, error } = await sb
      .from("friend_requests")
      .select("id,requester_id,addressee_id,status");
    if (error) return { ...empty, meId: id };
    const requests = (data as FriendRequest[]) ?? [];
    const otherIds = Array.from(
      new Set(
        requests.map((r) => (r.requester_id === id ? r.addressee_id : r.requester_id)),
      ),
    );
    const profiles: Record<string, Profile> = {};
    if (otherIds.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id,handle,display_name")
        .in("id", otherIds);
      for (const p of (profs as Profile[]) ?? []) profiles[p.id] = p;
    }
    return { requests, profiles, meId: id };
  } catch {
    return empty;
  }
}

/** Send (or re-send after a decline) a friend request. */
export async function sendFriendRequest(addresseeId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const id = await meId();
    if (!id || id === addresseeId) return false;
    const { error } = await sb.from("friend_requests").upsert(
      { requester_id: id, addressee_id: addresseeId, status: "pending" },
      { onConflict: "requester_id,addressee_id" },
    );
    return !error;
  } catch {
    return false;
  }
}

/** Accept or decline an incoming request (addressee only, enforced by RLS). */
export async function respondToRequest(
  requestId: string,
  accept: boolean,
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb
      .from("friend_requests")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", requestId);
    return !error;
  } catch {
    return false;
  }
}

/** Remove a request row (cancel a pending one, or unfriend). */
export async function removeFriendship(requestId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.from("friend_requests").delete().eq("id", requestId);
    return !error;
  } catch {
    return false;
  }
}

// ----- Sharing & inbox (M28) -----

export type ShareKind = "trail" | "card";

export interface InboxShare {
  id: string;
  sender_id: string;
  kind: ShareKind;
  payload: unknown;
  note: string | null;
  created_at: string;
  read: boolean;
  sender?: Profile;
}

export type SendResult = { error: string | null };

/** Send a snapshot to a friend. RLS enforces friends-only + sender = self. */
export async function sendShare(
  recipientId: string,
  kind: ShareKind,
  payload: unknown,
  note: string,
): Promise<SendResult> {
  const sb = getSupabase();
  if (!sb) return { error: "Cloud isn't set up on this device." };
  try {
    const id = await meId();
    if (!id) return { error: "You're not signed in." };
    const { error } = await sb.from("shares").insert({
      sender_id: id,
      recipient_id: recipientId,
      kind,
      payload,
      note: note.trim() || null,
    });
    if (error) {
      // RLS violation ⇒ not friends (or no longer friends).
      if (/row-level security|policy/i.test(error.message))
        return { error: "You can only send to a friend." };
      return { error: "Couldn't send. Try again." };
    }
    return { error: null };
  } catch {
    return { error: "Couldn't reach the cloud." };
  }
}

/** The signed-in user's received shares, newest first, with sender profiles. */
export async function listInbox(): Promise<InboxShare[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const id = await meId();
    if (!id) return [];
    const { data, error } = await sb
      .from("shares")
      .select("id,sender_id,kind,payload,note,created_at,read")
      .eq("recipient_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return [];
    const shares = (data as InboxShare[]) ?? [];
    const senderIds = Array.from(new Set(shares.map((s) => s.sender_id)));
    if (senderIds.length) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id,handle,display_name")
        .in("id", senderIds);
      const byId: Record<string, Profile> = {};
      for (const p of (profs as Profile[]) ?? []) byId[p.id] = p;
      for (const s of shares) s.sender = byId[s.sender_id];
    }
    return shares;
  } catch {
    return [];
  }
}

export async function markShareRead(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("shares").update({ read: true }).eq("id", id);
  } catch {
    /* non-fatal */
  }
}

export async function deleteShare(id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("shares").delete().eq("id", id);
  } catch {
    /* non-fatal */
  }
}

/** Quiet indicator counts: unread received shares + incoming friend requests. */
export async function socialBadge(): Promise<{
  unreadShares: number;
  incomingRequests: number;
}> {
  const sb = getSupabase();
  const zero = { unreadShares: 0, incomingRequests: 0 };
  if (!sb) return zero;
  try {
    const id = await meId();
    if (!id) return zero;
    const [shares, reqs] = await Promise.all([
      sb
        .from("shares")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", id)
        .eq("read", false),
      sb
        .from("friend_requests")
        .select("id", { count: "exact", head: true })
        .eq("addressee_id", id)
        .eq("status", "pending"),
    ]);
    return {
      unreadShares: shares.count ?? 0,
      incomingRequests: reqs.count ?? 0,
    };
  } catch {
    return zero;
  }
}
