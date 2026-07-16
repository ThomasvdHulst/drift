// Pure friend-graph helpers (Phase 10). Given the raw friend_request rows the
// current user can see (RLS returns rows where they're requester or addressee),
// derive relationship state + partitions for the UI. No I/O — unit-tested.

export type FriendStatus = "pending" | "accepted" | "declined";

export interface FriendRequest {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendStatus;
}

export type Relationship = "none" | "friends" | "incoming" | "outgoing";

/** The relationship between me and another user, from the requests I can see. */
export function deriveRelationship(
  requests: FriendRequest[],
  meId: string,
  otherId: string,
): Relationship {
  for (const r of requests) {
    const involvesBoth =
      (r.requester_id === meId && r.addressee_id === otherId) ||
      (r.requester_id === otherId && r.addressee_id === meId);
    if (!involvesBoth) continue;
    if (r.status === "accepted") return "friends";
    if (r.status === "pending")
      return r.requester_id === meId ? "outgoing" : "incoming";
    // 'declined' → treat as none (a fresh request is allowed later)
  }
  return "none";
}

/** Split my visible requests into accepted friends / incoming / outgoing pending. */
export function partition(
  requests: FriendRequest[],
  meId: string,
): { friends: FriendRequest[]; incoming: FriendRequest[]; outgoing: FriendRequest[] } {
  const friends: FriendRequest[] = [];
  const incoming: FriendRequest[] = [];
  const outgoing: FriendRequest[] = [];
  for (const r of requests) {
    if (r.status === "accepted") friends.push(r);
    else if (r.status === "pending") {
      if (r.addressee_id === meId) incoming.push(r);
      else if (r.requester_id === meId) outgoing.push(r);
    }
  }
  return { friends, incoming, outgoing };
}

/** The other party's user id in a request row, relative to me. */
export function otherPartyId(r: FriendRequest, meId: string): string {
  return r.requester_id === meId ? r.addressee_id : r.requester_id;
}
