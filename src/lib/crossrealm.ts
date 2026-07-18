// Pure cross-realm "doorway" logic (Phase 15). No network — the server resolver
// (realms/server/doorway.ts) fetches and calls these; the client uses realmOfSource
// + DOORWAY_EYEBROW. Kept React/DOM-free + unit-tested (CLAUDE.md §5).

import type { SourceId, RealmId } from "./realms/types";
import type { Trail } from "./types";

/** Which realm a card's content source belongs to. Absent ⇒ Encyclopedia
 *  (back-compat with pre-realm cards). */
const SOURCE_TO_REALM: Record<SourceId, RealmId> = {
  wikipedia: "encyclopedia",
  artic: "gallery",
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

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

/**
 * Gallery → Encyclopedia (forward): the ordered entities to try resolving onto a
 * Wikipedia article — artist first (most reliable + interesting), then the
 * movement, then the place. The resolver tries them in order until one resolves.
 */
export function forwardEntities(art: {
  artist_title?: string | null;
  style_title?: string | null;
  place_of_origin?: string | null;
}): string[] {
  return [art.artist_title, art.style_title, art.place_of_origin]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0);
}

export interface ReverseTopResult {
  title?: string | null;
  term_titles?: string[] | null;
  _score?: number;
}

const REVERSE_SCORE_FLOOR = 12;

/**
 * Encyclopedia → Gallery (reverse): whether the top AIC result for an article
 * title is a *genuine* match worth a doorway. AIC full-text search is noisy (it
 * relevance-ranks against everything), so we require the article term to actually
 * appear in the top result's title or subject tags, with a mild score backstop.
 * Keeps concrete subjects (Octopus, Samurai, Mount Fuji, Cat) and stays silent for
 * abstract ones (Quantum mechanics → "Mechanical Elephant").
 */
export function passesReverseGate(term: string, top: ReverseTopResult): boolean {
  const t = norm(term);
  if (!t) return false;
  if ((top._score ?? 0) < REVERSE_SCORE_FLOOR) return false;
  if (norm(top.title).includes(t)) return true;
  return (top.term_titles ?? []).some((tag) => norm(tag).includes(t));
}
