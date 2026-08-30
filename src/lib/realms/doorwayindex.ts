// ---------------------------------------------------------------------------
// The reverse doorway's matcher (Phase 34) — pure, no network, no DOM.
//
// Given an Encyclopedia article title, find the Gallery work that answers it,
// using a blob baked offline by scripts/build-met-index.mjs. This is what makes
// a doorway MISS free: about half of all cards have no Gallery match, and every
// one of those used to pay for a search plus record fetches to discover it.
//
// ⚠️ THIS SUPERSEDES `passesReverseGate`, AND IS DELIBERATELY STRICTER. That gate
// was a raw substring test, and it only ever worked because it CONFIRMED results
// the museum's relevance search had already ranked. Run directly over 237,000
// works it produces nonsense, measured on 30 August 2026:
//
//     Owl  ->  "Open Bowl"        because "bowl".includes("owl")
//     Cat  ->  "Adam and Eve"     and equally "cathedral", "delicate", "catalogue"
//
// So a match must land on a WORD BOUNDARY. The inflection allowance below is
// what keeps that from being too strict in the other direction: the museum
// catalogues subjects in the plural ("octopuses", "cats") while an article title
// is singular, and losing those would lose most of the good doorways.
//
// Re-measured with these rules: Octopus -> "Terracotta stirrup jar with
// octopus", Mount Fuji -> "Mount Fuji", Aurora -> "Aurora", Wolf -> "Wolf",
// Butterfly -> "A Butterfly"; and Quantum mechanics, Existentialism, Inflation,
// Game theory, Photosynthesis, Bioluminescence, Beekeeping, Coral reef,
// Cartography and Fermentation all stay silent.
// ---------------------------------------------------------------------------

/** Field separator inside a line: wraps every field (the title, then each tag).
 *  Wrapping rather than joining is what stops a match running from the end of
 *  the title into the start of a tag — otherwise "mount fuji" matches a work
 *  titled "...mount" that happens to be tagged "fuji". */
export const FIELD_SEP = String.fromCharCode(1);

/**
 * The one normalisation.
 *
 * ⚠️ MUST STAY IDENTICAL TO `normalize` IN scripts/build-met-index.mjs. The
 * script is plain Node and cannot import this module, so the copy is pinned by
 * a test rather than trusted — the same arrangement lib/loadbot*.test.ts uses
 * for the load harness's copied URL builders. If these two ever disagree, every
 * lookup silently misses.
 *
 * ⚠️ COMBINING MARKS ARE REMOVED, NOT REPLACED BY A SPACE, and the difference is
 * not cosmetic. NFKD splits "é" into "e" plus a combining acute; letting the
 * class replacement turn that mark into a space SPLITS THE WORD AROUND IT.
 * Measured on the real tables (Phase 35): "Maison Léoty" became "maison le oty"
 * and "Santos Hernández" became "santos herna ndez", so every accented artist
 * was unfindable — and the same bug was quietly in the doorway, where an article
 * about a "Café" could never match a work catalogued with one.
 */
export function normalizeForIndex(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

/**
 * How many letters may follow a match and still count as the same word.
 *
 * Three covers the inflections the museum's cataloguing actually uses —
 * octopus/octopuses, cat/cats, wolf/wolves is not covered and does not need to
 * be, because "wolf" still matches the title "Wolf". It is deliberately short:
 * at four, "cart" would match "cartography" and the gate would start lying.
 */
const MAX_INFLECTION = 3;

/** A candidate the index is willing to offer, best first. */
export interface DoorwayCandidate {
  /** The Met object id. A record still has to be fetched for its image. */
  id: number;
  /** The artist's death year, or 0 when the catalogue records none. Carried so
   *  the caller can apply the EU copyright test without spending a request. */
  deathYear: number;
  /** True when the term matched the work's TITLE rather than one of its tags. */
  viaTitle: boolean;
}

/** The baked index, as the server loads it. */
export interface DoorwayIndex {
  /** Newline-separated lines, one per work, already normalised and wrapped. */
  blob: string;
  /** Byte offset of each line's start, ascending. */
  starts: Int32Array;
  /** Two Int32 columns per work: object id, then artist death year. */
  ids: Int32Array;
}

/** Build the line-offset table once, at load. One scan over the blob. */
export function lineStarts(blob: string): Int32Array {
  const out: number[] = [0];
  for (let i = blob.indexOf("\n"); i !== -1; i = blob.indexOf("\n", i + 1)) {
    out.push(i + 1);
  }
  // A trailing newline would leave a phantom empty line past the last work.
  if (out[out.length - 1] >= blob.length) out.pop();
  return Int32Array.from(out);
}

/** Which line an offset falls in. Binary search over the offset table. */
function lineAt(starts: Int32Array, at: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= at) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/**
 * Does a match at `at` end on a word boundary, or on a short inflection before
 * one? This is the whole difference between "Owl" finding an owl and "Owl"
 * finding a bowl.
 */
function endsCleanly(blob: string, end: number): boolean {
  const c = blob[end];
  if (c === " " || c === FIELD_SEP || c === "\n" || c === undefined) return true;
  for (let k = 1; k <= MAX_INFLECTION; k++) {
    const nxt = blob[end + k];
    if (nxt === " " || nxt === FIELD_SEP || nxt === "\n" || nxt === undefined) {
      // Letters only: "cat" may reach "cats", never "cat-5" or "cat 2".
      return /^[a-z]+$/.test(blob.slice(end, end + k));
    }
  }
  return false;
}

/**
 * The ranked candidates for an article title, best first.
 *
 * A TITLE match outranks a TAG match, and that is a product decision rather than
 * a technical one: principle 1 is that the reader always sees WHY the next thing
 * appeared. A work titled "Swiss Glacier" visibly answers the article "Glacier";
 * one merely tagged so reads as arbitrary, even though the museum's cataloguers
 * put the tag there. Tag matches stay as the fallback because they are already
 * what the live gate admitted, and dropping them would lose about a third of all
 * doorways.
 *
 * Everything below that is settled by the blob's own order: it is baked sorted
 * by the museum's curation flags and then by title length, so an earlier line is
 * already a better answer and ties need no further work here.
 */
export function doorwayCandidates(
  index: DoorwayIndex,
  term: string,
  limit = 25,
): DoorwayCandidate[] {
  const q = normalizeForIndex(term);
  // One character would match nearly every line; two is already thin. The live
  // gate had the same floor implicitly, because a one-letter search returned
  // noise the relevance ranking then buried.
  if (q.length < 3) return [];

  const needle = " " + q;
  const found: DoorwayCandidate[] = [];
  const seen = new Set<number>();

  for (
    let at = index.blob.indexOf(needle);
    at !== -1 && found.length < limit;
    at = index.blob.indexOf(needle, at + 1)
  ) {
    if (!endsCleanly(index.blob, at + needle.length)) continue;
    const line = lineAt(index.starts, at);
    if (seen.has(line)) continue;
    seen.add(line);
    // The title is the FIRST field on the line, so a match before the second
    // separator is a title match.
    const secondSep = index.blob.indexOf(
      FIELD_SEP,
      index.starts[line] + 1,
    );
    found.push({
      id: index.ids[line * 2],
      deathYear: index.ids[line * 2 + 1],
      viaTitle: secondSep === -1 || at < secondSep,
    });
  }

  // Stable partition: title matches first, each group still in blob order.
  return [...found.filter((c) => c.viaTitle), ...found.filter((c) => !c.viaTitle)];
}
