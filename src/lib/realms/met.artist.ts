// ---------------------------------------------------------------------------
// Drifting an artist, on The Metropolitan Museum of Art (Phase 31B).
//
// Ported from the Art Institute version, with two real differences:
//
//  1. AN ARTIST IS A NAME, NOT AN ID. The Met has no artist ids in its search
//     API — `artistOrCulture=true&q=<name>` is the only handle it offers — so an
//     artist is identified by the display name the museum spells them with. The
//     name-folding and token matching below were already name-based and port
//     over unchanged; only the tally key moved.
//
//     That makes `parseArtistBucket` the security-critical function in this file:
//     the parsed name IS interpolated into an upstream query, where the old
//     numeric id could be checked with `/^\d{1,9}$/`. See its guard.
//
//  2. THE LADDER IS TWO RINGS, NOT THREE. The Art Institute had a `style_title`
//     field, so ring 1 could widen into an artist's movement. The Met has no
//     style or movement field at all. Deriving one from subject tags was
//     considered and refused: tags are subjects ("Cypresses", "Landscapes"), and
//     a chip reading "THE MOVEMENT" over a subject is a small lie to the reader
//     (§2.1). So ring 1 widens into the artist's own department and period,
//     which the museum does record, with the artist themselves excluded.
//
// Pure and network-free: the server adapter fetches and calls these.
// ---------------------------------------------------------------------------

/**
 * Fold a name for comparison: lowercase, strip diacritics, and reduce anything
 * that is not a letter or digit to a space. This is what lets "durer" match
 * "Albrecht Dürer" and "cezanne" match "Paul Cézanne" — accented spellings are
 * the norm in a museum catalogue.
 */
export function foldName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tokens worth requiring. One-character fragments carry no signal. */
function tokens(folded: string): string[] {
  return folded.split(" ").filter((t) => t.length >= 2);
}

/** One artist as seen on a work, with the death year the copyright test needs. */
export interface MetArtistHit {
  name: string;
  /** Death year, or null where the museum recorded none. */
  death: number | null;
}

export interface MetArtistMatch {
  name: string;
  hits: number;
  death: number | null;
}

/**
 * Rank the artists behind a page of search hits, keeping only those whose name
 * genuinely matches the query.
 *
 * The gate is "every meaningful token of the query appears in the artist's
 * name": "van gogh" keeps Vincent van Gogh and drops Rembrandt van Rijn (which
 * matches only "van"). Order is by how often the artist appears in the
 * (relevance-sorted) sample, so the artist the search was really about is first.
 *
 * Verified against the live API: "rembrandt" correctly separates Rembrandt van
 * Rijn from Rembrandt Peale, and both are offered.
 */
export function rankArtists(
  hits: MetArtistHit[],
  query: string,
  limit = 4,
): MetArtistMatch[] {
  const want = tokens(foldName(query));
  if (want.length === 0) return [];

  const tally = new Map<string, MetArtistMatch>();
  for (const h of hits) {
    const name = (h.name ?? "").trim();
    if (!name) continue;
    const key = foldName(name);
    const existing = tally.get(key);
    if (existing) {
      existing.hits += 1;
      // A death year recorded on any one work is as good as on another; keep the
      // first one we see rather than letting a blank overwrite it.
      if (existing.death === null) existing.death = h.death;
      continue;
    }
    if (!want.every((t) => key.includes(t))) continue;
    tally.set(key, { name, hits: 1, death: h.death });
  }

  return [...tally.values()].sort((a, b) => b.hits - a.hits).slice(0, limit);
}

// ----- the widening ladder -----

/** How far from the artist a drift has wandered. Two rings, see the header. */
export type MetArtistRing = 0 | 1;

/** What the server worked out about an artist, by tallying a sample of their
 *  own public-domain works. Ring 1 widens into these; either may be absent, and
 *  the ladder copes. */
export interface MetArtistProfile {
  name: string;
  works: number;
  /** The department holding most of their work, e.g. "European Paintings". */
  department?: string;
  /** The span their work falls in, as years, for the date filter. */
  from?: number;
  to?: number;
}

/** Which rings this artist actually supports. Ring 1 needs somewhere to widen
 *  INTO, so an artist whose department we could not work out stops at ring 0. */
export function availableRings(profile: MetArtistProfile): MetArtistRing[] {
  return profile.department ? [0, 1] : [0];
}

/** The next ring out, or null when the ladder is exhausted. */
export function nextArtistRing(
  profile: MetArtistProfile,
  ring: MetArtistRing,
): MetArtistRing | null {
  const rings = availableRings(profile);
  const i = rings.indexOf(ring);
  if (i === -1) return null;
  return rings[i + 1] ?? null;
}

/** A period phrase for a span of years, for the banner and the card label. */
export function describeSpan(from?: number, to?: number): string | undefined {
  if (from === undefined || to === undefined) return undefined;
  const century = (y: number) => {
    if (y < 0) return `${Math.abs(Math.floor(y / 100)) + 1}th century BCE`;
    return `${Math.floor(y / 100) + 1}th century`;
  };
  const a = century(from);
  const b = century(to);
  return a === b ? a : `${a} to ${b}`;
}

/**
 * The banner's trailing phrase for a ring: nothing at ring 0 (you are simply
 * with the artist), and an honest name for where you have wandered beyond it.
 */
export function describeArtistRing(
  profile: MetArtistProfile,
  ring: MetArtistRing,
): string | undefined {
  if (ring === 0) return undefined;
  const where = [profile.department?.toLowerCase(), describeSpan(profile.from, profile.to)]
    .filter(Boolean)
    .join(", ");
  return where ? `wandering wider · ${where}` : "wandering wider";
}

/**
 * The "why this card" label for a ring — what the card itself claims it came
 * from. This has to change as the drift widens: a work served from ring 1 still
 * saying it arrived via the artist would be a small lie, and the card's
 * provenance line is exactly where §2.1 is enforced.
 */
export function artistRingLabel(
  profile: MetArtistProfile,
  ring: MetArtistRing,
): string {
  if (ring === 0) return profile.name;
  const where = [profile.department, describeSpan(profile.from, profile.to)]
    .filter(Boolean)
    .join(", ");
  return where ? `${where}, around ${profile.name}` : `Around ${profile.name}`;
}

// ----- the bucket encoding -----
//
// Like a form slice, an artist drift rides the existing opaque `bucket` string
// rather than needing a route of its own: `artist:<name>:<ring>`. Bumping the
// ring is therefore the WHOLE of widening — the feed swaps one bucket for the
// next and the server does the rest.

/** Characters an artist name may keep inside a bucket id. Everything else is
 *  percent-encoded, so a name can never introduce the `:` the codec splits on
 *  or anything that changes the shape of an upstream query. */
function encodeName(name: string): string {
  return encodeURIComponent(name.trim()).replace(/[:]/g, "%3A");
}

export function artistBucketId(name: string, ring: MetArtistRing): string {
  return `artist:${encodeName(name)}:${ring}`;
}

/**
 * Parse an `artist:` bucket, or null if malformed.
 *
 * THIS IS THE INJECTION GUARD, and it carries more weight than the Art
 * Institute's did. There the id was numeric and `/^\d{1,9}$/` settled it; here
 * the value is a human name that ends up in an upstream query string, so the
 * rules are: it must decode cleanly, it must be a plausible length, and after
 * decoding it may contain only letters, digits, spaces and the punctuation that
 * actually occurs in catalogue names (apostrophes, hyphens, full stops, commas,
 * parentheses, ampersands). No slashes, no angle brackets, no control
 * characters, no `%`, and nothing that could re-introduce a separator.
 */
const ARTIST_NAME_OK = /^[\p{L}\p{N} .,'’\-()&]{2,80}$/u;

export function parseArtistBucket(
  bucket: string | null | undefined,
): { name: string; ring: MetArtistRing } | null {
  if (!bucket) return null;
  const parts = bucket.split(":");
  if (parts.length !== 3 || parts[0] !== "artist") return null;

  let name: string;
  try {
    name = decodeURIComponent(parts[1]);
  } catch {
    // A malformed percent-escape is not a name.
    return null;
  }
  name = name.trim();
  if (!ARTIST_NAME_OK.test(name)) return null;

  const ring = Number(parts[2]);
  if (ring !== 0 && ring !== 1) return null;
  return { name, ring: ring as MetArtistRing };
}
