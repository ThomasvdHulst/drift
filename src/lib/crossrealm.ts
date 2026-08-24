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

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

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

export interface ReverseTopResult {
  title?: string | null;
  /** The museum's own subject keywords for the work (The Met: `tags[].term`). */
  term_titles?: string[] | null;
}

/**
 * Encyclopedia → Gallery (reverse): whether the top museum result for an article
 * title is a *genuine* match worth a doorway. Museum full-text search is noisy
 * (it relevance-ranks against everything), so we require the article term to
 * actually appear in the top result's title or its subject tags. Keeps concrete
 * subjects (Octopus, Samurai, Mount Fuji, Cat) and stays silent for abstract ones
 * (Quantum mechanics → "Mechanical Elephant").
 *
 * THERE IS NO LONGER A SCORE BACKSTOP, and that is not a weakening. The Art
 * Institute returned a relevance `_score` and this gate required at least 12 of
 * it; The Met's API returns no score at all, so the clause could only ever have
 * been a constant. The term-in-title-or-tags rule was always the load-bearing
 * half, and it was re-verified against The Met on the original cases before the
 * score clause was removed: Octopus, Samurai, Mount Fuji and Cat all open a
 * doorway; Quantum mechanics, Existentialism and Inflation all stay silent.
 */
export function passesReverseGate(term: string, top: ReverseTopResult): boolean {
  const t = norm(term);
  if (!t) return false;
  if (norm(top.title).includes(t)) return true;
  return (top.term_titles ?? []).some((tag) => norm(tag).includes(t));
}
