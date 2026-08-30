// ---------------------------------------------------------------------------
// The Gallery's own lookups, answered offline (Phase 35) — pure, no network.
//
// Phase 34 stopped the DOORWAY searching the museum. This does the same for the
// Gallery's own calls, from the same CC0 catalogue, and the measurements are why:
//
//   six cards read in European Paintings   26 Met requests  (7 searches, 19 fetches)
//   one artist search ("Rembrandt")        30 Met requests  to return TWO names
//   one artist profile                    ~24 Met requests  for a department and a span
//
// The artist and subject facets vary per card, so unlike the room and department
// searches they can never be served from a cache — which is exactly why an
// artist-rich room costs twice what `medieval` does.
//
// ⚠️ WHAT THIS CANNOT REMOVE, so nobody re-derives it: the candidate RECORD
// fetches. The catalogue does not publish image paths and they are not derivable
// — measured, the filenames are internal photo IDs (`DP-42549-001.jpg`,
// `DT3154.jpg`) with no relation to the accession number. Harvesting all 223,576
// at the museum's ~2.4 req/s ceiling is about 26 hours of hammering a source we
// depend on entirely. So a card still pays for the works it actually shows, and
// that is the floor.
// ---------------------------------------------------------------------------

import { dailyWindowOrder } from "./dailyorder";
import { foldName, type MetArtistMatch, type MetArtistProfile } from "./met.artist";
import { normalizeForIndex } from "./doorwayindex";

/** The four directions a Gallery card can thread in. Same order as the chips. */
export type FacetKind = "artist" | "place" | "dept" | "tag";

/** Baked inverted lists: facet value → object ids, best-ranked first. */
export type FacetIndex = Record<FacetKind, Record<string, number[]>>;

/**
 * One artist, tallied across the WHOLE catalogue rather than sampled.
 *
 * Short keys because there are 24,034 of these and the file ships to every
 * function: `k` folded key, `n` display name, `w` works, `d` department,
 * `f`/`t` the year span, `x` death year.
 */
export interface BakedArtist {
  k: string;
  n: string;
  w: number;
  d?: string;
  f?: number;
  t?: number;
  x?: number;
}

/**
 * Candidate ids for one facet, rotated daily.
 *
 * The rotation is the same trick room pools use (`dailyWindowOrder`): a reader
 * who comes back to the same artist or the same subject tomorrow meets different
 * work, while everyone sharing today gets the same order — which is what lets the
 * edge cache actually hold.
 */
export function facetCandidates(
  index: FacetIndex | null,
  kind: FacetKind,
  value: string,
  today = new Date(),
): number[] {
  if (!index) return [];
  const key = normalizeForIndex(value);
  if (!key) return [];
  const ids = index[kind]?.[key];
  if (!ids || !ids.length) return [];
  return dailyWindowOrder(`${kind}:${key}`, ids, today);
}

/** Tokens worth requiring. One-character fragments carry no signal. Mirrors the
 *  rule inside `rankArtists`, which this replaces for the baked path. */
function tokens(folded: string): string[] {
  return folded.split(" ").filter((t) => t.length >= 2);
}

/**
 * Artists whose name matches a query, best first.
 *
 * ⚠️ THE MATCHING RULE IS `rankArtists`', DELIBERATELY: every meaningful token of
 * the query must appear in the folded name, which is what keeps "van gogh" from
 * matching Rembrandt van Rijn (it shares only "van") while still offering both
 * Rembrandt van Rijn and Rembrandt Peale for "rembrandt".
 *
 * What changed is the COUNT it ranks on. `rankArtists` tallied how often an
 * artist appeared in a 40-work sample of a relevance-sorted search, so the number
 * was a proxy for relevance and the totals it reported were not the artist's real
 * ones. Here `w` is the true count across the catalogue. Better numbers, and a
 * slightly different order in the rare case where the two disagreed.
 */
export function rankBakedArtists(
  artists: BakedArtist[] | null,
  query: string,
  limit = 4,
): MetArtistMatch[] {
  if (!artists) return [];
  const want = tokens(foldName(query));
  if (!want.length) return [];

  const hits: MetArtistMatch[] = [];
  for (const a of artists) {
    if (!want.every((t) => a.k.includes(t))) continue;
    hits.push({ name: a.n, hits: a.w, death: a.x ?? null });
  }
  return hits.sort((x, y) => y.hits - x.hits || x.name.localeCompare(y.name)).slice(0, limit);
}

/** The baked row for exactly this artist, or null. */
export function bakedArtist(
  artists: BakedArtist[] | null,
  name: string,
): BakedArtist | null {
  if (!artists) return null;
  const want = foldName(name);
  return artists.find((a) => a.k === want) ?? null;
}

/** A baked row as the profile the widening ladder expects. Absent fields stay
 *  absent rather than becoming zeroes: `MetArtistProfile` treats either as
 *  "unknown" and the ladder copes, but a 0 would look like a real year. */
export function profileFromBaked(a: BakedArtist): MetArtistProfile {
  return {
    name: a.n,
    works: a.w,
    ...(a.d ? { department: a.d } : {}),
    ...(a.f !== undefined ? { from: a.f } : {}),
    ...(a.t !== undefined ? { to: a.t } : {}),
  };
}
