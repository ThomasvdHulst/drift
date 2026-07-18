import type { Card, RelatedCandidate } from "./types";
import { cardId, toCardId } from "./card";
import { candidateToCard, isJunk } from "./wiki";

// ---------------------------------------------------------------------------
// The "page orbit" engine (Phase 18, M-FD2) — the pure, DOM-free core of a
// directed drift *anchored* to a seed page. A single `morelike:` hop is very
// tight (near-duplicates), so instead of walking neighbour-to-neighbour we grow
// a breadth-first neighbourhood of the ORIGINAL seed and serve it lowest-ring
// first: the seed's neighbours (ring 1), then THEIR neighbours (ring 2), and so
// on. You spiral gently outward — stay near your idea, or keep drifting to reach
// new territory. Threads remain the deliberate fast way out (handled elsewhere).
//
// Reducer-style: the feed wires fetches (relatedUrl) to these; all the bug-prone
// bookkeeping (ring ordering, dedup, frontier growth, seen-filtering) lives here
// and is unit-tested. Encyclopedia-only, so ids are Wikipedia titles.
// ---------------------------------------------------------------------------

export type OrbitCard = { card: Card; ring: number };

export type OrbitState = {
  seedTitle: string;
  seedLabel: string;
  /** Ready-to-serve cards; drained lowest-ring-first (see takeFromPool). */
  pool: OrbitCard[];
  /** BFS queue of titles to expand, kept FIFO so it stays ring-sorted. */
  frontier: { title: string; ring: number }[];
  /** Native titles whose morelike we've already fetched (no double expansion). */
  expanded: Set<string>;
  /** cardIds ever pooled (+ the seed): orbit-internal dedup. */
  known: Set<string>;
  /** The furthest ring served so far (drives the "how far out" word). */
  maxRingServed: number;
};

// How many of a page's morelike neighbours to fold into the orbit. We skip the
// tightest (rank 0, usually a near-duplicate) and cap the rest so a single ring
// can't flood the pool: ~6 keeps you near the seed for a handful of drifts, then
// the spiral visibly widens (ring 2 is still coherent, just labeled "further
// out"), rather than 10+ drifts before anything moves.
export const MAX_PER_PARENT = 6;

export function initOrbit(seedTitle: string, seedLabel?: string): OrbitState {
  return {
    seedTitle,
    seedLabel: seedLabel || seedTitle,
    pool: [],
    frontier: [{ title: seedTitle, ring: 0 }],
    expanded: new Set(),
    known: new Set([toCardId("wikipedia", seedTitle)]),
    maxRingServed: 0,
  };
}

/** The ≤k lowest-ring frontier entries not yet expanded (BFS order). Read-only. */
export function nextToExpand(
  state: OrbitState,
  k = 2,
): { title: string; ring: number }[] {
  const out: { title: string; ring: number }[] = [];
  for (const f of state.frontier) {
    if (out.length >= k) break;
    if (!state.expanded.has(f.title)) out.push(f);
  }
  return out;
}

/**
 * Fold one parent's morelike candidates into the orbit: mark the parent expanded
 * and add up to MAX_PER_PARENT fresh (unseen, non-junk, not-already-known)
 * candidates to the pool + frontier at ring+1. Skips the tightest neighbour
 * (rank 0) unless the page is thin (≤3 candidates), so the orbit widens instead
 * of crawling through near-duplicates. Pure — returns a new state.
 */
export function ingestMorelike(
  state: OrbitState,
  parentTitle: string,
  parentRing: number,
  candidates: RelatedCandidate[],
  seen: Set<string>,
): OrbitState {
  const expanded = new Set(state.expanded);
  expanded.add(parentTitle);
  const known = new Set(state.known);
  const pool = state.pool.slice();
  const added: { title: string; ring: number }[] = [];
  const childRing = parentRing + 1;

  candidates.forEach((c, rank) => {
    if (added.length >= MAX_PER_PARENT) return;
    if (rank === 0 && candidates.length > 3) return; // drop the near-duplicate
    if (!c.pageTitle) return;
    const id = cardId(c);
    if (known.has(id) || seen.has(id)) return;
    if (isJunk({ title: c.pageTitle, extract: c.extract })) return;
    known.add(id);
    pool.push({ card: candidateToCard(c), ring: childRing });
    added.push({ title: c.pageTitle, ring: childRing });
  });

  return {
    ...state,
    pool,
    frontier: state.frontier
      .filter((f) => f.title !== parentTitle)
      .concat(added),
    expanded,
    known,
  };
}

/**
 * Take the lowest-ring not-yet-seen card from the pool (spiral outward), dropping
 * any pooled cards that became seen in the meantime (e.g. reached via a thread).
 * Returns the updated state + the card, or null when nothing is servable.
 */
export function takeFromPool(
  state: OrbitState,
  seen: Set<string>,
): { state: OrbitState; card: OrbitCard | null } {
  const fresh = state.pool
    .filter((oc) => !seen.has(cardId(oc.card)))
    .sort((a, b) => a.ring - b.ring); // stable in V8 → preserves rank within a ring
  if (fresh.length === 0) {
    return { state: { ...state, pool: [] }, card: null };
  }
  const [card, ...rest] = fresh;
  return {
    state: {
      ...state,
      pool: rest,
      maxRingServed: Math.max(state.maxRingServed, card.ring),
    },
    card,
  };
}

/** A short, monotonic "how far from the seed" word for the banner + mode chip. */
export function proximityWord(ring: number): string {
  if (ring <= 1) return "nearby";
  if (ring === 2) return "further out";
  if (ring === 3) return "far out";
  return "distant";
}
