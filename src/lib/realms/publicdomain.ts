// ---------------------------------------------------------------------------
// Is this artwork out of copyright in EUROPE?
//
// WHY THIS EXISTS. Every museum query Drift makes is constrained to the museum's
// own public-domain flag, and that flag was once treated as the answer. It is
// not, for a Dutch operator serving European readers (compliance audit M-4, the
// finding the operator's own description did not anticipate).
//
//   United States: 95 years from publication. In 2026, published before 1931.
//   European Union: life of the author plus 70 years, running from 31 December
//                   of the year of death (Directive 2006/116/EC Art 1, Art 37
//                   Auteurswet). In 2026, the author must have died in 1955 or
//                   earlier.
//
// The gap is real and not narrow. A painting published in the US in 1925 by an
// artist who died in 1970 is public domain there and protected here until 2041,
// and a great museum's collection is full of early-twentieth-century work with
// exactly that profile. The Metropolitan Museum's Open Access dataset is explicit
// that it "include[s] identifying data for artworks under copyright", so the
// separation is ours to make, not theirs.
//
// ONE POINT IN OUR FAVOUR, and it is why this is a filter and not a licensing
// project. Where the underlying artwork IS out of copyright in the EU, the
// museum's photograph of it creates no fresh layer of protection: Article 14 of
// Directive (EU) 2019/790 provides that material resulting from reproducing a
// visual work whose term has expired is not protected unless it is itself an
// original intellectual creation, and a faithful reproduction of a flat painting
// is not. So for genuinely EU-public-domain works the museum's images are free
// here regardless of what US law says about the photograph.
//
// SOURCE-AGNOSTIC ON PURPOSE. This module used to be bound to one museum's data
// shape (Phase 14, the Art Institute: numeric artist ids resolved through a
// separate `/agents` endpoint). It now takes a normalised verdict input, so each
// museum adapter is responsible only for answering "which death years, and was
// anything attributed at all?" — the rules below are the audit's and do not
// change when the source does.
//
// Pure and network-free. The rules are the audit's, verbatim:
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

/**
 * What a museum adapter must work out before this module can rule.
 *
 * `deathYears` carries one entry per ATTRIBUTED hand, in any order, using `null`
 * for a hand whose death year is unknown, unparseable, or simply not recorded —
 * which is also what a living artist looks like. The distinction between "no
 * hands attributed" and "hands attributed but unresolved" is the whole point of
 * `attributed`: the first earns the anonymous date fallback, the second does not
 * automatically, because an unresolved modern artist must not slip through as if
 * the work were anonymous.
 */
export interface PdInput {
  /** One entry per attributed hand; `null` where the year is not established. */
  deathYears: (number | null)[];
  /** Whether the record attributes the work to anyone at all. */
  attributed: boolean;
  /** The year the work was finished, for the anonymous fallback. */
  finishedYear?: number | null;
}

export type PdVerdict =
  | { ok: true }
  | { ok: false; reason: "artist-in-copyright" | "undated-unknown-artist" };

/**
 * Whether one artist's term has expired in the EU. A missing or unparseable
 * death year is NOT a pass: it means we do not know, and the caller falls back
 * to the artwork's date instead. A living artist has no death year either.
 */
export function deathYearCleared(
  death: number | null | undefined,
  cutoff: number,
): boolean {
  return typeof death === "number" && Number.isFinite(death) && death <= cutoff;
}

/**
 * Parse a museum's death-year field into a year, or null when it does not
 * establish one.
 *
 * Museums spell this differently and none of them promise a number. The Met
 * returns `artistEndDate` as a STRING, and for a work with several hands it is
 * pipe-delimited ("1757|1830"), which is why splitting is the caller's job and
 * parsing one segment is this function's. A blank, a "0", or anything that is
 * not a plain year is "not established" rather than an error, because the rules
 * above already have a safe answer for that.
 */
export function parseDeathYear(raw: unknown): number | null {
  // A museum writes an unknown date as 0 rather than leaving the field out, and
  // a 0 taken at face value would clear every cut-off there has ever been. The
  // guard has to sit on BOTH paths, not just the string one.
  const usable = (n: number) => (Number.isFinite(n) && n !== 0 ? n : null);
  if (typeof raw === "number") return usable(raw);
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^-?\d{1,4}$/);
  return m ? usable(Number(m[0])) : null;
}

/**
 * Split a pipe-delimited museum date field into one entry per attributed hand.
 * An empty field yields no entries at all, which the caller reads as "nothing
 * attributed" only when the name field agrees.
 */
export function splitDeathYears(raw: unknown): (number | null)[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw.split("|").map((part) => parseDeathYear(part));
}

/**
 * The decision.
 *
 * A hand present in `deathYears` as `null` is treated exactly like an artist
 * with no recorded death date, so a transient upstream failure narrows the
 * Gallery to old work rather than emptying it.
 */
export function artworkEuPublicDomain(
  input: PdInput,
  now: Date = new Date(),
): PdVerdict {
  const cutoff = euPublicDomainCutoff(now);
  const { deathYears, attributed } = input;

  // Every attributed hand has to clear the bar. One unknown modern artist on a
  // collaborative work is enough to exclude the whole thing.
  if (deathYears.length > 0 && deathYears.every((d) => deathYearCleared(d, cutoff))) {
    return { ok: true };
  }

  // Nobody attributed, or somebody we cannot clear. Fall back to the work's own
  // date: finished before 1830 means no living-memory author is involved.
  //
  // Note this fallback is available even when a hand IS attributed but could not
  // be resolved — that is deliberate and matches the original rule, because a
  // work finished before 1830 cannot have a living author whatever the record
  // says about them.
  const finished = input.finishedYear;
  if (
    typeof finished === "number" &&
    Number.isFinite(finished) &&
    finished < ANONYMOUS_CUTOFF_YEAR
  ) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: attributed ? "artist-in-copyright" : "undated-unknown-artist",
  };
}

/**
 * Which of these named artists Drift may build a drift around. Used by the
 * artist search, so an artist still in copyright is not offered as a destination
 * at all rather than resolving to an empty feed.
 *
 * Keyed by whatever the adapter uses to identify an artist — a numeric id for a
 * museum that has them, the display name for one that does not.
 */
export function artistsOutOfCopyright<K>(
  artists: { key: K; death: number | null }[],
  now: Date = new Date(),
): Set<K> {
  const cutoff = euPublicDomainCutoff(now);
  const out = new Set<K>();
  for (const a of artists) {
    if (deathYearCleared(a.death, cutoff)) out.add(a.key);
  }
  return out;
}
