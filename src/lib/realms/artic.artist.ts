// ---------------------------------------------------------------------------
// "Drift an artist" (Phase 24, M-G3) — the pure core of a Gallery drift anchored
// to one artist. Type a name, and the session wanders that artist's work.
//
// TWO PROBLEMS THIS MODULE EXISTS TO SOLVE, both found by probing the live API:
//
// 1. AN ARTIST WE DO NOT HOLD MUST FAIL HONESTLY. The Art Institute's search
//    always returns *something*: asking it for "Picasso" or "Frida Kahlo" (both
//    still in copyright, so absent from the public-domain set) yields Ancient
//    Greek pottery, because relevance has nothing better to offer. Dropping
//    someone into pottery under the banner "Picasso" would break §2.1 outright.
//    So `rankArtists` gates every candidate on the name actually matching what
//    was typed, and returns [] rather than a plausible-looking lie.
//
// 2. AN OEUVRE RUNS OUT. AIC is a works-on-paper collection, not a greatest-hits
//    of painting: Hokusai has 447 public-domain works but Van Gogh has 18, and a
//    session runs ~25 cards. So an artist drift WIDENS rather than dead-ends,
//    exactly as an "in the news" drift does when its pool empties (current.ts):
//    the artist's own work, then their movement, then their period and medium.
//    `artistLadder` is that widening, expressed as data so it can be tested.
//
// No network, no React. The server adapter builds the profile these read.
// ---------------------------------------------------------------------------

/** The fields a search hit needs for us to rank its artist. */
export interface ArtistHit {
  artist_id?: number | null;
  artist_title?: string | null;
}

/** A resolved artist: who they are and how much of them we actually hold. */
export interface ArtistMatch {
  id: number;
  name: string;
  /** Hits for this artist within the sampled page (the ranking signal, not the
   *  true total, which the server counts separately). */
  hits: number;
}

/**
 * Fold a name for comparison: lowercase, strip diacritics, and reduce anything
 * that is not a letter or digit to a space. This is what lets "durer" match
 * "Albrecht Dürer" and "cezanne" match "Paul Cézanne" — verified against the
 * live catalogue, where accented spellings are the norm.
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

/**
 * Rank the artists behind a page of search hits, keeping only those whose name
 * genuinely matches the query.
 *
 * The gate is "every meaningful token of the query appears in the artist's
 * name": "van gogh" keeps Vincent van Gogh and drops Rembrandt van Rijn (which
 * matches only "van"), while "picasso" keeps nobody at all. Order is by how
 * often the artist appears in the (relevance-sorted) sample, so the artist the
 * search was really about comes first.
 */
export function rankArtists(
  hits: ArtistHit[],
  query: string,
  limit = 4,
): ArtistMatch[] {
  const want = tokens(foldName(query));
  if (want.length === 0) return [];

  const tally = new Map<number, ArtistMatch>();
  for (const h of hits) {
    const id = h.artist_id;
    const name = (h.artist_title ?? "").trim();
    if (!id || !name) continue;
    const existing = tally.get(id);
    if (existing) {
      existing.hits += 1;
      continue;
    }
    const folded = foldName(name);
    if (!want.every((t) => folded.includes(t))) continue;
    tally.set(id, { id, name, hits: 1 });
  }

  return [...tally.values()].sort((a, b) => b.hits - a.hits).slice(0, limit);
}

// ----- the widening ladder -----

/** How far from the artist a drift has wandered. */
export type ArtistRing = 0 | 1 | 2;
export const MAX_ARTIST_RING: ArtistRing = 2;

/**
 * What the server measured about an artist, from aggregations over their own
 * public-domain works. `movement` and `era`/`form` are what rings 1 and 2 widen
 * into; any of them may be absent, and the ladder copes.
 */
export interface ArtistProfile {
  id: number;
  name: string;
  works: number;
  /** The artist's dominant movement, if they have a real one (see
   *  `isMovement` — AIC files "19th century" as a style too). */
  movement?: string;
  /** The era id (from artic.forms.ts) holding most of their work. */
  era?: string;
  /** The `artwork_type_title` most of their work is. */
  form?: string;
}

// AIC files period labels ("19th century", "nineteenth century", "18th Century")
// in the same `style_title` field as real movements, and for some artists a
// period label is the ONLY value present — Dürer's top style is "nineteenth
// century", from a single later impression. Widening into "nineteenth century"
// would be meaningless, so period labels are not treated as movements.
export function isMovement(style: string): boolean {
  const s = style.toLowerCase();
  if (/centur(y|ies)/.test(s)) return false;
  if (/^\d{1,2}(st|nd|rd|th)\b/.test(s)) return false;
  return s.trim().length > 0;
}

/** A movement attested on this few works is noise, not a characterisation:
 *  Rembrandt is filed "Renaissance" on 1 of his 235 works. */
export const MIN_MOVEMENT_WORKS = 3;
export const MIN_MOVEMENT_SHARE = 0.05;

/** Is a candidate movement attested strongly enough to widen into? */
export function movementHolds(count: number, totalWorks: number): boolean {
  if (count < MIN_MOVEMENT_WORKS) return false;
  return totalWorks <= 0 || count / totalWorks >= MIN_MOVEMENT_SHARE;
}

/**
 * The rings this artist can actually offer, in order. Ring 0 always exists; ring
 * 1 only if they have a real movement; ring 2 only if we know their period or
 * medium. `nextArtistRing` walks it, so an artist with no movement widens
 * straight from their own work to their period.
 */
export function availableRings(profile: ArtistProfile): ArtistRing[] {
  const rings: ArtistRing[] = [0];
  if (profile.movement) rings.push(1);
  if (profile.era || profile.form) rings.push(2);
  return rings;
}

/** The next ring out, or null when the ladder is exhausted. */
export function nextArtistRing(
  profile: ArtistProfile,
  ring: ArtistRing,
): ArtistRing | null {
  const rings = availableRings(profile);
  const i = rings.indexOf(ring);
  // An unknown current ring means we're already past the ladder.
  if (i === -1) return null;
  return rings[i + 1] ?? null;
}

/**
 * The banner's trailing phrase for a ring: nothing at ring 0 (you are simply
 * with the artist), and an honest name for where you have wandered beyond it.
 * `eraLabel` comes from artic.forms.ts so the wording matches the form picker.
 */
export function describeArtistRing(
  profile: ArtistProfile,
  ring: ArtistRing,
  eraLabel?: string,
): string | undefined {
  if (ring === 0) return undefined;
  if (ring === 1 && profile.movement) {
    return `wandering wider · ${profile.movement}`;
  }
  const where = [profile.form?.toLowerCase(), eraLabel]
    .filter(Boolean)
    .join(", ");
  return where ? `wandering wider · ${where}` : "wandering wider";
}

/**
 * The "why this card" label for a ring — what the card itself claims it came
 * from. This has to change as the drift widens: a Gauguin served from ring 1
 * saying it arrived via "Vincent van Gogh" would be a small lie, and the card's
 * provenance line is exactly where §2.1 is enforced.
 */
export function artistRingLabel(
  profile: ArtistProfile,
  ring: ArtistRing,
  eraLabel?: string,
): string {
  if (ring === 0) return profile.name;
  if (ring === 1 && profile.movement) {
    return `${profile.movement}, around ${profile.name}`;
  }
  const where = [profile.form, eraLabel].filter(Boolean).join(", ");
  return where ? `${where}, around ${profile.name}` : `Around ${profile.name}`;
}

// ----- the bucket encoding -----
//
// Like a form slice, an artist drift rides the existing opaque `bucket` string
// rather than needing a route of its own: `artist:<id>:<ring>`. Bumping the ring
// is therefore the WHOLE of widening — the feed swaps one bucket for the next
// and the server does the rest.

export function artistBucketId(artistId: number | string, ring: ArtistRing): string {
  return `artist:${artistId}:${ring}`;
}

/** Parse an `artist:` bucket, or null if malformed. Doubles as the discover
 *  route's injection guard: the id must be plain digits, because it is
 *  interpolated into a numeric `term[artist_id]` upstream. */
export function parseArtistBucket(
  bucket: string | null | undefined,
): { artistId: string; ring: ArtistRing } | null {
  if (!bucket) return null;
  const parts = bucket.split(":");
  if (parts.length !== 3 || parts[0] !== "artist") return null;
  if (!/^\d{1,9}$/.test(parts[1])) return null;
  const ring = Number(parts[2]);
  if (ring !== 0 && ring !== 1 && ring !== 2) return null;
  return { artistId: parts[1], ring: ring as ArtistRing };
}
