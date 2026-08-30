// Pure cross-realm "doorway" logic (Phase 15). No network — the server resolver
// (realms/server/doorway.ts) fetches and calls these; the client uses realmOfSource
// + DOORWAY_EYEBROW. Kept React/DOM-free + unit-tested (CLAUDE.md §5).

import type { SourceId, RealmId } from "./realms/types";
import type { Trail } from "./types";

/** Which realm a card's content source belongs to. Absent ⇒ Encyclopedia
 *  (back-compat with pre-realm cards). */
const SOURCE_TO_REALM: Record<SourceId, RealmId> = {
  wikipedia: "encyclopedia",
  // Both museums map to the Gallery. "artic" is history — the Art Institute's
  // image host went behind a blanket Cloudflare block (Phase 31) — but art cards
  // saved before the move still carry that source and must still resolve to a
  // room rather than silently falling back to the Encyclopedia.
  artic: "gallery",
  met: "gallery",
  gutenberg: "library",
  arxiv: "papers",
};

export function realmOfSource(source?: SourceId | null): RealmId {
  return (source && SOURCE_TO_REALM[source]) || "encyclopedia";
}

/** The distinct realms a trail's cards span (Phase 15: a trail can weave both).
 *  In first-visited order; falls back to the trail's own realm hint if empty. */
export function trailRealms(trail: Trail): RealmId[] {
  const seen: RealmId[] = [];
  for (const step of trail.steps) {
    const r = realmOfSource(step.card.source);
    if (!seen.includes(r)) seen.push(r);
  }
  return seen.length ? seen : [trail.realm ?? "encyclopedia"];
}

/** The eyebrow shown on a doorway chip — names the destination realm. Title-case;
 *  the chip CSS uppercases it. */
export const DOORWAY_EYEBROW: Record<RealmId, string> = {
  encyclopedia: "In the Encyclopedia",
  gallery: "In the Gallery",
  library: "In the Library",
  today: "In Today",
  papers: "In Papers",
};

/**
 * Gallery → Encyclopedia (forward): the ordered entities to try resolving onto a
 * Wikipedia article — artist first (most reliable + interesting), then the
 * movement, then the place. The resolver tries them in order until one resolves.
 */
export interface ForwardEntities {
  /** The maker, most reliable and most interesting to land on. */
  artist?: string | null;
  /** The movement or period, whichever the museum records. */
  movement?: string | null;
  /** The culture or country the work comes from. */
  place?: string | null;
}

export function forwardEntities(art: ForwardEntities): string[] {
  return [art.artist, art.movement, art.place]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0);
}

// ⚠️ `passesReverseGate` AND `ReverseTopResult` LIVED HERE AND ARE GONE (Phase 34).
//
// They are recorded rather than quietly deleted because the rule still exists —
// it just moved and got stricter, and a reader looking for "how does the reverse
// doorway decide?" should be sent to the right place rather than find nothing.
//
// The gate was: the article's term must appear as a SUBSTRING of the top museum
// result's title or one of its subject tags. It worked, but only ever as a
// CONFIRMATION on top of five relevance-ranked search results. Phase 34 stopped
// searching entirely and now decides from a blob baked out of the museum's own
// CC0 catalogue, and run directly over all 223,576 works the substring rule fell
// apart — measured 30 August 2026, it answered "Owl" with an "Open Bowl" and
// would equally have matched "cathedral", "delicate" and "catalogue" for "Cat".
//
// The replacement requires a WORD-BOUNDARY match with a short inflection
// allowance, and lives in `lib/realms/doorwayindex.ts` next to the index it
// reads. `norm` went with it; `forwardEntities` above is the direction that
// stayed, because Gallery → Encyclopedia never needed a gate.
