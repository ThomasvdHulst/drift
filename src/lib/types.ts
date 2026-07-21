// Core data model (see drift-spec.md §7). Card / RelatedCandidate / Thread drive
// the feed; TrailStep / Trail / SessionStats drive saved trails and the stats view.

import type { SourceId, RealmId } from "./realms/types";

export type Card = {
  // Source-native id / key. For Wikipedia this is the canonical title (used in
  // morelike/summary calls); for other realms it's the source's own id (e.g. an
  // Art Institute artwork id). The app-wide unique id is `cardId` = source +
  // ":" + pageTitle (see lib/card.ts).
  pageTitle: string;
  displayTitle: string; // the human title
  description?: string; // short description / subtitle
  extract: string; // 2–3 sentence hook
  longExtract?: string; // fetched lazily on "read more" (Phase 2)
  imageUrl?: string;
  sourceUrl: string; // canonical URL at the content source
  // Where the content comes from. Absent ⇒ "wikipedia" (back-compat with trails
  // saved before Phase 5's realms).
  source?: SourceId;
  // Optional richer card fields (Phase 14 — Gallery, Deepened). All optional and
  // back-compatible: absent on Wikipedia cards and on trails saved before Phase 14.
  facts?: { label: string; value: string }[]; // structured "museum label" rows
  zoomUrl?: string; // hi-res image for the deep-zoom lightbox (art: IIIF 1686px)
  blurDataUrl?: string; // tiny base64 placeholder for a blur-up load (art: lqip)
  imageAlt?: string; // real alt text when the source provides one (art: alt_text)
  // A generated, field-themed "cover" for image-less realms (Phase 17 — Papers):
  // a hue + motif + seed the card renders instead of a photo. Only arXiv sets it.
  cover?: { hue: string; motif: string; seed: number };
};

// A related page returned by a realm's "related" endpoint — already carries
// enough to render a Card without a second fetch (we synthesize the canonical
// URL). `threadLabel`/`facet` are set by realms whose threads are facet-based
// (Gallery/Library: "More by {artist}", "Other {style}", …); Wikipedia leaves
// them unset and the client derives a label from the description.
export type RelatedCandidate = {
  pageTitle: string;
  displayTitle: string;
  description?: string;
  extract?: string;
  imageUrl?: string;
  source?: SourceId;
  sourceUrl?: string; // set by non-Wikipedia realms (Wikipedia synthesizes it)
  threadLabel?: string;
  facet?: string;
  // A short uppercase facet word shown above the label on a facet-realm chip
  // (Gallery: "MORE BY" / "THE MOVEMENT" / "THE SUBJECT" …). The facet-realm
  // parallel to the Encyclopedia's directional `kind` (Phase 14 M-G3).
  eyebrow?: string;
  // Rich card fields carried through so a candidate that LANDS on a card keeps its
  // museum label / zoom / blur-up / alt (Phase 14 fields). Only art sets these.
  zoomUrl?: string;
  blurDataUrl?: string;
  imageAlt?: string;
  facts?: { label: string; value: string }[];
  cover?: { hue: string; motif: string; seed: number }; // Papers: field-themed cover
};

// The "direction" a thread takes you (Phase 6). Encyclopedia threads are
// classified into these; facet realms (Gallery) leave kind undefined.
export type ThreadKind = "deeper" | "zoomout" | "nearby" | "tangent";

// A chosen, labeled next-step shown as a chip on the card.
export type Thread = {
  candidate: RelatedCandidate;
  label: string;
  kind?: ThreadKind;
  // Facet-realm eyebrow (Gallery). Distinct from `kind` (Encyclopedia). At most
  // one of `kind` / `eyebrow` is set.
  eyebrow?: string;
  // A cross-realm "doorway" (Phase 15): presence marks this chip a realm-crossing,
  // the value is the destination realm. Pulling it lands you in the other realm.
  doorway?: RealmId;
};

export type ArrivedVia =
  | { type: "seed"; seedName: string }
  // `kind` records the thread's direction (Phase 6); optional ⇒ back-compatible
  // with trails saved before it, and with facet realms (Gallery) that omit it.
  // `crossedFrom` (Phase 15) is set when this step crossed into a new realm (the
  // realm you came FROM) — powers the honest "Crossed to …" line + a distinct
  // trail-map / atlas edge. Absent ⇒ an in-realm thread.
  | {
      type: "thread";
      label: string;
      fromTitle: string;
      kind?: ThreadKind;
      crossedFrom?: RealmId;
    }
  // A drift may carry the topic it landed in (interesting-random, M8) and why
  // that topic was chosen (M9): "interest" = weighted by what you like,
  // "wildcard" = the serendipity floor. "field"/"orbit" are the Phase 18 focused
  // drifts (confined to a field / spiraling out from a seed). Optional →
  // back-compatible with trails saved before Phase 4.
  | {
      type: "drift";
      topic?: { id: string; label: string };
      reason?: "interest" | "wildcard" | "field" | "orbit";
      // Set only on an orbit drift (Phase 18): the seed being orbited + the ring
      // (distance) this card sits at, for the honest "Orbiting X · nearby" chip.
      orbit?: { seedLabel: string; ring: number };
      // Set when a horizontal swipe crossed into a new realm with no doorway (a
      // fresh wander into the other realm) — the realm you came FROM (Phase 15).
      crossedFrom?: RealmId;
      // Set when this drift followed a related thread because you ♥-liked the
      // previous card ("keep me in this stream"). The value is that liked card's
      // title, for an honest "More like {title}" mode chip.
      fromLiked?: string;
    };

export type TrailStep = {
  card: Card;
  arrivedVia: ArrivedVia;
  timestamp: number;
  dwellMs?: number;
  expanded: boolean;
};

export type Trail = {
  id: string;
  name: string;
  steps: TrailStep[];
  createdAt: number;
  liked: boolean;
  // Which realm this trail was drifted in. Absent ⇒ "encyclopedia" (back-compat).
  realm?: RealmId;
};

export type SessionStats = {
  id: string; // per drift-session id (one page-load of /drift); lets us upsert
  startedAt: number;
  stops: number;
  threadsPulled: number;
  drifts: number;
  durationMs?: number;
};
