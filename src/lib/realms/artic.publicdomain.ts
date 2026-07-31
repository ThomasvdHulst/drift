// ---------------------------------------------------------------------------
// Is this artwork out of copyright in EUROPE?
//
// WHY THIS EXISTS. Every Gallery query is constrained to `is_public_domain=true`,
// and that flag was treated as the answer. It is not, for a Dutch operator
// serving European readers (compliance audit M-4, the finding the operator's own
// description did not anticipate).
//
//   United States: 95 years from publication. In 2026, published before 1931.
//   European Union: life of the author plus 70 years, running from 31 December
//                   of the year of death (Directive 2006/116/EC Art 1, Art 37
//                   Auteurswet). In 2026, the author must have died in 1955 or
//                   earlier.
//
// The gap is real and not narrow. A painting published in the US in 1925 by an
// artist who died in 1970 is public domain there and protected here until 2041,
// and the museum's collection is full of early-twentieth-century work with
// exactly that profile. The museum's own terms put the burden on the reuser:
// "it is the sole responsibility of the image user to identify and obtain any
// necessary third-party permissions".
//
// ONE POINT IN OUR FAVOUR, and it is why this is a filter and not a licensing
// project. Where the underlying artwork IS out of copyright in the EU, the
// museum's photograph of it creates no fresh layer of protection: Article 14 of
// Directive (EU) 2019/790 provides that material resulting from reproducing a
// visual work whose term has expired is not protected unless it is itself an
// original intellectual creation, and a faithful reproduction of a flat painting
// is not. So for genuinely EU-public-domain works the museum's IIIF images are
// free here regardless of what US law says about the photograph.
//
// Pure and network-free: the server adapter fetches the artist records and calls
// these. The rules are the audit's, verbatim:
//
//   1. Admit only where every attributed artist has a death date at or before
//      the cut-off.
//   2. Where an artist has no death date (or could not be looked up), fall back
//      to the artwork's own end date and require it to precede 1830.
//   3. A work with several attributed artists is admitted only if ALL of them
//      pass. One unknown modern hand is enough to exclude it.
// ---------------------------------------------------------------------------

/** The EU term is life plus 70, counted from 31 December of the year of death.
 *  So in year Y, a work is out of copyright once its author died in or before
 *  Y minus 71. Recomputed from the clock rather than baked in, so the Gallery
 *  widens by one year every 1 January without anyone remembering to edit it. */
export function euPublicDomainCutoff(now: Date = new Date()): number {
  return now.getUTCFullYear() - 71;
}

/**
 * The fallback for an anonymous or unrecorded hand: admit only work finished
 * before this. Deliberately conservative and deliberately not "cut-off minus a
 * lifetime": it is a proxy for "nobody in living memory made this", and an
 * anonymous work has its own term rules that a date proxy cannot model. Losing
 * some nineteenth-century work is the acceptable side of the error.
 */
export const ANONYMOUS_CUTOFF_YEAR = 1830;

/** An artist record as `/agents/{id}` returns it. Dates are plain years. */
export interface ArticAgent {
  id: number;
  title?: string;
  birth_date?: number | null;
  death_date?: number | null;
}

/** Only the artwork fields this decision needs. */
export interface PdArtwork {
  artist_id?: number | null;
  artist_ids?: number[] | null;
  date_end?: number | null;
  date_start?: number | null;
}

export type PdVerdict =
  | { ok: true }
  | { ok: false; reason: "artist-in-copyright" | "undated-unknown-artist" };

/** Every artist id attributed to a work, de-duplicated. `artist_ids` is the
 *  authoritative list; `artist_id` is the primary one and is sometimes the only
 *  field a lean query asked for, so both are read. */
export function attributedArtistIds(art: PdArtwork): number[] {
  const ids = new Set<number>();
  for (const id of art.artist_ids ?? []) {
    if (Number.isFinite(id)) ids.add(id);
  }
  if (Number.isFinite(art.artist_id)) ids.add(art.artist_id as number);
  return [...ids];
}

/** Whether one artist's term has expired in the EU. A missing or unparseable
 *  death date is NOT a pass: it means we do not know, and the caller falls back
 *  to the artwork's date instead. A living artist has no death date either. */
export function artistOutOfCopyright(
  agent: ArticAgent | undefined,
  cutoff: number,
): boolean {
  const died = agent?.death_date;
  return typeof died === "number" && Number.isFinite(died) && died <= cutoff;
}

/**
 * The decision. `agents` is what the server managed to look up; an id missing
 * from it is treated exactly like an artist with no recorded death date, so a
 * transient upstream failure narrows the Gallery to old work rather than
 * emptying it.
 */
export function artworkEuPublicDomain(
  art: PdArtwork,
  agents: Map<number, ArticAgent>,
  now: Date = new Date(),
): PdVerdict {
  const cutoff = euPublicDomainCutoff(now);
  const ids = attributedArtistIds(art);

  // Every attributed hand has to clear the bar. One unknown modern artist on a
  // collaborative work is enough to exclude the whole thing.
  const unresolved = ids.filter((id) => !artistOutOfCopyright(agents.get(id), cutoff));
  if (ids.length > 0 && unresolved.length === 0) return { ok: true };

  // Nobody attributed, or somebody we cannot clear. Fall back to the work's own
  // date: finished before 1830 means no living-memory author is involved.
  // `date_end` is the museum's end of the creation range; `date_start` stands in
  // when it is absent, since a work cannot have finished before it began.
  const finished = art.date_end ?? art.date_start;
  if (typeof finished === "number" && Number.isFinite(finished) && finished < ANONYMOUS_CUTOFF_YEAR) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: ids.length > 0 ? "artist-in-copyright" : "undated-unknown-artist",
  };
}

/** Which of these artists Drift may build a drift around. Used by the artist
 *  search, so an artist still in copyright is not offered as a destination at
 *  all rather than resolving to an empty feed. */
export function artistsOutOfCopyright(
  agents: ArticAgent[],
  now: Date = new Date(),
): Set<number> {
  const cutoff = euPublicDomainCutoff(now);
  const out = new Set<number>();
  for (const a of agents) {
    if (artistOutOfCopyright(a, cutoff)) out.add(a.id);
  }
  return out;
}
