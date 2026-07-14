// ---------------------------------------------------------------------------
// Realms — the source abstraction (Phase 5). A *realm* is a "room" the user
// browses in (Encyclopedia / Gallery / Library / Today); a *source* is where a
// card's content actually comes from. They're separate because one source can
// back more than one realm (Wikipedia backs both Encyclopedia and Today).
//
// This is a leaf module: it imports nothing from the rest of the app, so it can
// be referenced by `lib/types.ts` without a cycle. Behaviour (discover
// strategies, URL builders) lives in `realms/index.ts`, which may import the
// interest model etc.
// ---------------------------------------------------------------------------

/** Where a Card's content originates. Drives cardId, the seen-set, and which
 *  card body renders. `Card.source` is optional and defaults to "wikipedia" so
 *  every trail saved before Phase 5 still resolves. */
export type SourceId = "wikipedia" | "artic" | "gutenberg";

/** Which room a drift session is in. Drives the homepage tab, the accent, the
 *  discover strategy, and the My-Trails badge. `Trail.realm` defaults to
 *  "encyclopedia" when absent. */
export type RealmId = "encyclopedia" | "gallery" | "library" | "today";

/** Static description of a realm (data only — no functions, so it stays a leaf). */
export interface RealmMeta {
  id: RealmId;
  contentSource: SourceId;
  label: string; // display name for the tab
  glyph: string; // small mark shown on the tab / trail badge
  blurb: string; // one-line description under the tab
  /** Whether ♥/✕ + the interest model apply here. Encyclopedia only, for now. */
  hasInterestModel: boolean;
  /** How the feed selects/labels threads: Wikipedia's description-diversity
   *  heuristic vs. pre-labeled facet chips (Gallery/Library). */
  threadMode: "diverse" | "facet";
}

/** A homepage seed tile. A drift starts either from a specific `titles` pick
 *  (Encyclopedia) or from a browse `bucket` (Gallery/Library). */
export interface SeedTile {
  label: string;
  glyph: string;
  blurb: string;
  tint: string;
  titles?: string[]; // Encyclopedia: pick one at random
  bucket?: string; // Gallery/Library: start a bucket drift
}

/** One "bucket" to pull a discover batch from, plus how to label/explain it on
 *  the card. For Encyclopedia a bucket is an ORES topic; for Gallery a style/
 *  department; for Library a subject. `reason` is Encyclopedia-only (the
 *  interest model's truthful "why", §2.1). */
export interface DiscoverPick {
  id: string; // stable bucket id (shown in ArrivedVia.topic.id)
  label: string; // friendly label (shown on the card)
  bucket: string; // the /api/realm/[realm]/discover `bucket` query value
  reason?: "interest" | "wildcard";
}
