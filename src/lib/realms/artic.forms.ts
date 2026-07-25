// ---------------------------------------------------------------------------
// "Drift a form and a period" (Phase 24) — the Gallery's answer to the
// Encyclopedia's field focus. Pick an art form (paintings, prints, photographs)
// and optionally narrow it to a period, and the passive drift stays inside that
// slice. Threads stay free, as always.
//
// WHY A SEPARATE AXIS FROM `artic.buckets.ts`. The ten browse buckets are
// *themes* (Impressionism, Japanese Prints, Landscapes): they pick a starting
// point. A form is a *medium* and a period is a *date range* — orthogonal to
// theme, and both are structured fields on every AIC record, so they can confine
// a whole session exactly rather than approximately.
//
// WHY THE COUNTS ARE BAKED. AIC's public-domain collection is emphatically NOT
// uniform: it holds 24,509 prints and only 2,093 paintings, no photographs
// before 1800, and no coins after about 1500. Offering "Photographs, 1600s"
// would be a button that leads nowhere, so `erasForForm` filters the ladder down
// to the periods a form actually has. The numbers come from
// `scripts/probe-artic-forms.mjs` (hand-run; re-run it if the catalogue shifts)
// rather than a per-visit aggregation call, which would be a needless upstream
// hit just to render tiles.
//
// Pure data + lookups: no network, no React, unit-tested. Imported by both the
// client (homepage tiles) and the server adapter (query building).
// ---------------------------------------------------------------------------

/** An art form, as AIC's `artwork_type_title` field spells it. */
export interface ArticForm {
  /** Stable slug used in the bucket id + the URL. */
  id: string;
  label: string;
  /** The exact `artwork_type_title` value to match upstream. Ours, never user
   *  input, so it is safe to interpolate into the search query. */
  aicType: string;
  glyph: string;
  blurb: string;
  tint: string;
}

/** A period on the shared ladder. `from`/`to` bound AIC's numeric `date_start`. */
export interface ArticEra {
  id: string;
  label: string;
  from: number;
  to: number;
}

// ORDER IS THE GRID'S ORDER, same contract as topics.ts and current.ts:
// alphabetical by label, with tints cycling through six far-apart hue families
// (sand, green, blue, rose, teal, violet) so no neighbour in a 2-, 3- or
// 4-column grid shares a family. These are the same ten tints current.ts uses,
// in the same order, so the two grids stay visually of a piece.
// artic.forms.test.ts asserts all of it.
export const ARTIC_FORMS: ArticForm[] = [
  { id: "ceramics", label: "Ceramics", aicType: "Ceramics", glyph: "◍", blurb: "Fired clay, glazed and painted", tint: "#e6d8b2" },
  { id: "coin", label: "Coins", aicType: "Coin", glyph: "⊙", blurb: "Struck metal, passed hand to hand", tint: "#d0e7c5" },
  { id: "drawing", label: "Drawings", aicType: "Drawing and Watercolor", glyph: "✎", blurb: "Chalk, ink, and watercolour on paper", tint: "#b3c7e5" },
  { id: "metalwork", label: "Metalwork", aicType: "Metalwork", glyph: "◆", blurb: "Worked silver, bronze, and iron", tint: "#edc9d4" },
  { id: "painting", label: "Paintings", aicType: "Painting", glyph: "❐", blurb: "Oil, tempera, and acrylic on canvas", tint: "#a2d7d7" },
  { id: "photograph", label: "Photographs", aicType: "Photograph", glyph: "◧", blurb: "Light caught on plate and film", tint: "#d5b2e1" },
  { id: "print", label: "Prints", aicType: "Print", glyph: "▥", blurb: "Woodblock, etching, and lithograph", tint: "#e8deba" },
  { id: "sculpture", label: "Sculpture", aicType: "Sculpture", glyph: "⬢", blurb: "Carved and cast, in the round", tint: "#d4eacd" },
  // Glyph and blurb deliberately differ from the "Textiles" *theme* bucket in
  // artic.buckets.ts: both appear on the Gallery home, and two tiles that look
  // identical but behave differently (start here vs stay here) is a trap.
  { id: "textile", label: "Textiles", aicType: "Textile", glyph: "▩", blurb: "Cloth, from loom to garment", tint: "#bbcae8" },
  { id: "vessel", label: "Vessels", aicType: "Vessel", glyph: "∪", blurb: "Jars, bowls, and cups for daily use", tint: "#f0d1d9" },
];

// Labels avoid en dashes on purpose (standing copy preference): a period reads
// "1850 to 1899", never "1850–1899". The ids keep hyphens; they are URL slugs,
// not prose.
export const ARTIC_ERAS: ArticEra[] = [
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

// Measured public-domain-with-image counts, from scripts/probe-artic-forms.mjs
// (2026-07-25). Used only to hide empty slices and to show an honest "N works"
// line; nothing downstream depends on them being exact.
const COUNTS: Record<string, Record<string, number>> = {
  ceramics: { "pre-1500": 982, "1500s": 34, "1600s": 80, "1700s": 1198, "1800-1849": 315, "1850-1899": 139, "1900-1929": 8 },
  coin: { "pre-1500": 1214, "1500s": 1, "1600s": 4, "1700s": 0, "1800-1849": 0, "1850-1899": 0, "1900-1929": 0 },
  drawing: { "pre-1500": 162, "1500s": 936, "1600s": 1448, "1700s": 1942, "1800-1849": 1690, "1850-1899": 1171, "1900-1929": 136 },
  metalwork: { "pre-1500": 208, "1500s": 29, "1600s": 96, "1700s": 428, "1800-1849": 250, "1850-1899": 187, "1900-1929": 41 },
  painting: { "pre-1500": 201, "1500s": 173, "1600s": 348, "1700s": 438, "1800-1849": 334, "1850-1899": 510, "1900-1929": 76 },
  photograph: { "pre-1500": 30, "1500s": 0, "1600s": 0, "1700s": 0, "1800-1849": 455, "1850-1899": 2851, "1900-1929": 414 },
  print: { "pre-1500": 521, "1500s": 2133, "1600s": 2402, "1700s": 5302, "1800-1849": 5336, "1850-1899": 7401, "1900-1929": 1348 },
  sculpture: { "pre-1500": 844, "1500s": 57, "1600s": 70, "1700s": 76, "1800-1849": 71, "1850-1899": 134, "1900-1929": 23 },
  textile: { "pre-1500": 735, "1500s": 394, "1600s": 919, "1700s": 1476, "1800-1849": 1315, "1850-1899": 866, "1900-1929": 30 },
  vessel: { "pre-1500": 1173, "1500s": 55, "1600s": 131, "1700s": 221, "1800-1849": 90, "1850-1899": 12, "1900-1929": 3 },
};

/**
 * The floor a period must clear to be offered. A session runs ~25 cards and the
 * drift samples random pages of the result set, so a slice wants comfortably
 * more than that to stay fresh to the end without repeating.
 */
export const MIN_ERA_WORKS = 60;

const FORM_BY_ID = new Map(ARTIC_FORMS.map((f) => [f.id, f]));
const ERA_BY_ID = new Map(ARTIC_ERAS.map((e) => [e.id, e]));

export function articFormById(id: string | null | undefined): ArticForm | undefined {
  return id ? FORM_BY_ID.get(id) : undefined;
}

export function articEraById(id: string | null | undefined): ArticEra | undefined {
  return id ? ERA_BY_ID.get(id) : undefined;
}

/** How many public-domain works a slice holds (0 for an unknown form/era). */
export function worksInSlice(formId: string, eraId: string): number {
  const row = COUNTS[formId];
  if (!row) return 0;
  if (eraId === ERA_ALL) {
    return Object.values(row).reduce((n, v) => n + v, 0);
  }
  return row[eraId] ?? 0;
}

/**
 * The periods worth offering for a form: "All periods" first, then every era on
 * the ladder that clears `MIN_ERA_WORKS`. This is what keeps the UI honest —
 * photographs simply have no centuries before 1800 to show, so those chips never
 * render rather than rendering and disappointing.
 */
export function erasForForm(
  formId: string,
): { id: string; label: string; works: number }[] {
  if (!FORM_BY_ID.has(formId)) return [];
  const out = [
    { id: ERA_ALL, label: "All periods", works: worksInSlice(formId, ERA_ALL) },
  ];
  for (const era of ARTIC_ERAS) {
    const works = worksInSlice(formId, era.id);
    if (works >= MIN_ERA_WORKS) out.push({ id: era.id, label: era.label, works });
  }
  return out;
}

// ----- the bucket encoding -----
//
// `/api/realm/gallery/discover` takes one opaque `bucket` string, so a form
// drift needs no new route: it rides the existing seam as `form:<form>:<era>`.
// Writer and reader live side by side here so they cannot drift apart (the same
// lesson focus.ts records about its own params).

export function formBucketId(formId: string, eraId: string = ERA_ALL): string {
  return `form:${formId}:${eraId}`;
}

/** Parse a `form:` bucket, or null if it is malformed or names anything we do
 *  not offer. Doubles as the discover route's injection guard. */
export function parseFormBucket(
  bucket: string | null | undefined,
): { form: ArticForm; era: ArticEra | null } | null {
  if (!bucket) return null;
  const parts = bucket.split(":");
  if (parts.length !== 3 || parts[0] !== "form") return null;
  const form = articFormById(parts[1]);
  if (!form) return null;
  if (parts[2] === ERA_ALL) return { form, era: null };
  const era = articEraById(parts[2]);
  if (!era) return null;
  // An era we would never offer for this form is treated as junk, so a
  // hand-edited URL cannot land you in an empty slice.
  if (worksInSlice(form.id, era.id) < MIN_ERA_WORKS) return null;
  return { form, era };
}

/** The focus banner / "why this card" label for a slice, e.g. "Paintings, 1850
 *  to 1899" or plain "Photographs". */
export function describeSlice(form: ArticForm, era: ArticEra | null): string {
  return era ? `${form.label}, ${era.label}` : form.label;
}
