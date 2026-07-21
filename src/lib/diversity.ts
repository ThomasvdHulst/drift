import type { RelatedCandidate, Thread } from "./types";
import { isJunk } from "./wiki";
import { cardId } from "./card";

// ---------------------------------------------------------------------------
// Heuristic thread selection: pick up to N candidates that are diverse from each
// other, so we never show three biographies / three genera in a row.
//
// This is the general fallback. Encyclopedia cards normally go through the
// directional classifier (lib/threads.ts) and Gallery through selectFacetThreads;
// selectDiverseThreads runs when neither applies. Cheap, deterministic, no AI.
// ---------------------------------------------------------------------------

export interface SelectOptions {
  count?: number; // default 3
  seen?: Set<string>; // cardIds already visited this session (see lib/card.ts)
}

/**
 * Crude "class" token for a candidate: the first word of its short description
 * (e.g. "Genus", "Species", "Novel", "City"). Candidates with no description
 * each get a unique class (their title) so they're treated as diverse.
 */
export function classOf(c: RelatedCandidate): string {
  const d = (c.description ?? "").trim();
  if (!d) return `~${c.pageTitle.toLowerCase()}`;
  return d.split(/\s+/)[0].toLowerCase();
}

/** Chip label: the short description if present and < 40 chars, else the title. */
export function labelFor(c: RelatedCandidate): string {
  const d = (c.description ?? "").trim();
  if (d && d.length < 40) return d;
  return c.displayTitle || c.pageTitle;
}

export function selectDiverseThreads(
  candidates: RelatedCandidate[],
  opts: SelectOptions = {},
): Thread[] {
  const count = opts.count ?? 3;
  const seen = opts.seen ?? new Set<string>();

  // Drop already-seen and junk candidates; the input order preserves morelike
  // relevance ranking, which we lean on as the tie-breaker.
  const pool = candidates.filter(
    (c) =>
      !seen.has(cardId(c)) &&
      !isJunk({ title: c.pageTitle, extract: c.extract }),
  );

  // Greedy pass 1: take the best candidate of each not-yet-used class.
  const chosen: RelatedCandidate[] = [];
  const usedClasses = new Set<string>();
  for (const c of pool) {
    if (chosen.length >= count) break;
    const cls = classOf(c);
    if (!usedClasses.has(cls)) {
      chosen.push(c);
      usedClasses.add(cls);
    }
  }

  // Pass 2: if classes ran out before we hit `count`, fill with the next best
  // unused candidates regardless of class.
  if (chosen.length < count) {
    for (const c of pool) {
      if (chosen.length >= count) break;
      if (!chosen.includes(c)) chosen.push(c);
    }
  }

  return chosen.map((c) => ({ candidate: c, label: labelFor(c) }));
}

/**
 * Thread selection for facet-based realms (Gallery/Library), where each
 * candidate already carries a ready `threadLabel` and a `facet` group ("More by
 * {artist}", "Other {style}", …). We take one per distinct facet (so the chips
 * are different *directions*, not three of the same), drop seen cards, then fill
 * any spare slots. Labels come from the candidate, not the description.
 */
export function selectFacetThreads(
  candidates: RelatedCandidate[],
  opts: SelectOptions = {},
): Thread[] {
  const count = opts.count ?? 3;
  const seen = opts.seen ?? new Set<string>();
  const pool = candidates.filter((c) => !seen.has(cardId(c)) && c.pageTitle);

  const chosen: RelatedCandidate[] = [];
  const usedFacets = new Set<string>();
  for (const c of pool) {
    if (chosen.length >= count) break;
    const f = c.facet ?? `~${c.pageTitle}`;
    if (usedFacets.has(f)) continue;
    usedFacets.add(f);
    chosen.push(c);
  }
  // We deliberately do NOT pad with more of an already-used facet: a card with
  // only two real directions shows two distinct chips, never a duplicate one
  // (each chip is a genuinely different direction — the point of facet threads).
  return chosen.map((c) => ({
    candidate: c,
    label: c.threadLabel || c.displayTitle || c.pageTitle,
    ...(c.eyebrow ? { eyebrow: c.eyebrow } : {}),
  }));
}
