// Pure share-snapshot helpers (Phase 10). A share carries a self-contained
// SNAPSHOT so the recipient never needs access to the sender's own rows. No I/O
// (ids/timestamps are injected) — unit-tested.

import type { Card, Trail, TrailStep } from "@/lib/types";
import type { RealmId } from "@/lib/realms/types";

export interface TrailSnapshot {
  name: string;
  realm?: RealmId;
  steps: TrailStep[];
}

/** Snapshot a trail for sending (drop local-only fields like id/liked/createdAt). */
export function trailToSharePayload(trail: Trail): TrailSnapshot {
  return { name: trail.name, realm: trail.realm, steps: trail.steps };
}

/** Snapshot a single card for sending. */
export function cardToSharePayload(card: Card): Card {
  return { ...card };
}

/**
 * Turn a received trail snapshot into a fresh LOCAL trail owned by the recipient
 * (new id + createdAt injected by the caller). This is what "Continue this
 * trail" / "Add to my trails" saves, so it then syncs via Phase 9.
 */
export function sharePayloadToLocalTrail(
  snap: TrailSnapshot,
  id: string,
  createdAt: number,
): Trail {
  return {
    id,
    name: snap.name?.trim() || "Shared trail",
    steps: Array.isArray(snap.steps) ? snap.steps : [],
    createdAt,
    liked: false,
    realm: snap.realm,
  };
}

/** A short, safe label for a share in the inbox. */
export function shareTitle(kind: "trail" | "card", payload: unknown): string {
  const p = payload as Partial<TrailSnapshot> & Partial<Card>;
  if (kind === "trail") return p.name?.trim() || "Shared trail";
  return p.displayTitle?.trim() || "Shared card";
}
