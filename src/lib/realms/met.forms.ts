// ---------------------------------------------------------------------------
// "Drift a form and a period" — the Gallery's answer to the Encyclopedia's field
// focus. Pick an art form (paintings, prints, photographs) and optionally narrow
// it to a period, and the passive drift stays inside that slice. Threads stay
// free, as always.
//
// WHY A SEPARATE AXIS FROM `met.buckets.ts`. The fourteen rooms are the museum's
// curatorial *departments*: they pick a starting point. A form is a *medium* and
// a period is a *date range* — orthogonal to department, and both are structured
// search filters on The Met, so they can confine a whole session exactly rather
// than approximately.
//
// WHY THE COUNTS ARE BAKED. The collection is emphatically not uniform: 82,687
// prints against 14,297 paintings, and no photographs at all before 1800 because
// photography did not exist. Offering "Photographs, 1600s" would be a button
// that leads nowhere, so `erasForForm` filters the ladder down to the periods a
// form actually has. The numbers come from `scripts/probe-met-pools.mjs`
// (hand-run; re-run it if the catalogue shifts) rather than a per-visit
// aggregation call — which The Met could not answer anyway, since its API has no
// aggregations at all.
//
// ⚠️ The counts are `hasImages` totals, NOT public-domain totals: one search each
// rather than tens of thousands of record fetches. They over-count what a reader
// will actually be shown, which is why MIN_ERA_WORKS sits well above zero rather
// than at 1.
//
// Pure data + lookups: no network, no React, unit-tested. Imported by both the
// client (homepage tiles) and the server adapter (query building).
// ---------------------------------------------------------------------------

import pools from "./met.pools.json";

export interface MetForm {
  id: string;
  label: string;
  /** The value sent as `medium=` upstream. Ours, never user input. */
  medium: string;
  glyph: string;
  blurb: string;
  tint: string;
}

export interface MetEra {
  id: string;
  label: string;
  from: number;
  to: number;
}

// ORDER IS THE GRID'S ORDER, same contract as topics.ts and met.buckets.ts:
// alphabetical by label, with tints cycling through six far-apart hue families
// (sand, green, blue, rose, teal, violet) so no
// neighbour in a 2-, 3- or 4-column grid shares a family. Glyphs are checked
// against the room tiles too: both grids render on the Gallery home, one above
// the other, and two tiles that look alike but behave differently (start here vs
// stay here) is a trap. met.forms.test.ts asserts all of it.
export const MET_FORMS: MetForm[] = [
  { id: "ceramics", label: "Ceramics", medium: "Ceramics", glyph: "◍", blurb: "Fired clay, glazed and painted", tint: "#e6d8b2" },
  { id: "drawing", label: "Drawings", medium: "Drawings", glyph: "✎", blurb: "Chalk, ink, and watercolour on paper", tint: "#d0e7c5" },
  { id: "glass", label: "Glass", medium: "Glass", glyph: "⌾", blurb: "Blown, cut, and stained", tint: "#b3c7e5" },
  { id: "jewelry", label: "Jewellery", medium: "Jewelry", glyph: "❖", blurb: "Worn, treasured, and buried", tint: "#edc9d4" },
  { id: "metalwork", label: "Metalwork", medium: "Metalwork", glyph: "◆", blurb: "Worked silver, bronze, and iron", tint: "#a2d7d7" },
  { id: "painting", label: "Paintings", medium: "Paintings", glyph: "❐", blurb: "Oil, tempera, and ink on panel", tint: "#d5b2e1" },
  { id: "photograph", label: "Photographs", medium: "Photographs", glyph: "◨", blurb: "Light caught on plate and film", tint: "#e8deba" },
  { id: "print", label: "Prints", medium: "Prints", glyph: "▥", blurb: "Woodblock, etching, and lithograph", tint: "#d4eacd" },
  { id: "sculpture", label: "Sculpture", medium: "Sculpture", glyph: "⬢", blurb: "Carved and cast, in the round", tint: "#bbcae8" },
  { id: "textile", label: "Textiles", medium: "Textiles", glyph: "▩", blurb: "Cloth, from loom to garment", tint: "#f0d1d9" },
];

// Labels avoid en dashes on purpose (standing copy preference): a period reads
// "1850 to 1899", never "1850–1899". The ids keep hyphens; they are URL slugs,
// not prose.
export const MET_ERAS: MetEra[] = [
  { id: "pre-1500", label: "Before 1500", from: -4000, to: 1499 },
  { id: "1500s", label: "1500s", from: 1500, to: 1599 },
  { id: "1600s", label: "1600s", from: 1600, to: 1699 },
  { id: "1700s", label: "1700s", from: 1700, to: 1799 },
  { id: "1800-1849", label: "1800 to 1849", from: 1800, to: 1849 },
  { id: "1850-1899", label: "1850 to 1899", from: 1850, to: 1899 },
  { id: "1900-1929", label: "1900 to 1929", from: 1900, to: 1929 },
];

/** The "no period filter" choice, offered first on every form. */
export const ERA_ALL = "all";

const COUNTS: Record<string, Record<string, number>> =
  (pools as { formCounts?: Record<string, Record<string, number>> }).formCounts ?? {};

/**
 * The floor a slice must clear to be offered.
 *
 * Higher than it looks it needs to be, deliberately. The counts are `hasImages`
 * totals and only about three works in four survive the public-domain and EU
 * copyright filters, so a slice measuring 200 might show 150. A period that
 * cannot fill a session is worse than a period that is simply not offered.
 */
export const MIN_ERA_WORKS = 200;

const FORM_BY_ID = new Map(MET_FORMS.map((f) => [f.id, f]));
const ERA_BY_ID = new Map(MET_ERAS.map((e) => [e.id, e]));

export function metFormById(id: string): MetForm | undefined {
  return FORM_BY_ID.get(id);
}

export function metEraById(id: string): MetEra | undefined {
  return ERA_BY_ID.get(id);
}

/** Measured works in a slice; 0 for anything we did not probe. */
export function worksInSlice(formId: string, eraId: string): number {
  return COUNTS[formId]?.[eraId] ?? 0;
}

/** The periods worth offering for a form: "All periods" first, then only the
 *  ones the museum can actually fill. */
export function erasForForm(
  formId: string,
): { id: string; label: string; works: number }[] {
  if (!FORM_BY_ID.has(formId)) return [];
  const out = [
    { id: ERA_ALL, label: "All periods", works: worksInSlice(formId, ERA_ALL) },
  ];
  for (const era of MET_ERAS) {
    const works = worksInSlice(formId, era.id);
    if (works >= MIN_ERA_WORKS) out.push({ id: era.id, label: era.label, works });
  }
  return out;
}

// ----- the bucket encoding -----
//
// `/api/realm/gallery/discover` takes one opaque `bucket` string, so a form
// drift needs no new route: it rides the existing seam as `form:<form>:<era>`.
// Writer and reader live side by side here so they cannot drift apart.

export function formBucketId(formId: string, eraId: string = ERA_ALL): string {
  return `form:${formId}:${eraId}`;
}

/** Parse a `form:` bucket, or null if it is malformed or names anything we do
 *  not offer. Doubles as the discover route's injection guard. */
export function parseFormBucket(
  bucket: string | null | undefined,
): { form: MetForm; era: MetEra | null } | null {
  if (!bucket) return null;
  const parts = bucket.split(":");
  if (parts.length !== 3 || parts[0] !== "form") return null;
  const form = metFormById(parts[1]);
  if (!form) return null;
  if (parts[2] === ERA_ALL) return { form, era: null };
  const era = metEraById(parts[2]);
  if (!era) return null;
  // An era we would never offer for this form is treated as junk, so a
  // hand-edited URL cannot land you in an empty slice.
  if (worksInSlice(form.id, era.id) < MIN_ERA_WORKS) return null;
  return { form, era };
}

/** The focus banner / "why this card" label for a slice, e.g. "Paintings, 1850
 *  to 1899" or plain "Photographs". */
export function describeSlice(form: MetForm, era: MetEra | null): string {
  return era ? `${form.label}, ${era.label}` : form.label;
}
