// Test-only colour maths, shared by the tile grids (the 28 field cards in
// topics.ts, the 10 news sections in current.ts, the 10 art forms in
// realms/artic.forms.ts). Not a test file itself — vitest only collects
// `*.test.ts` — and never imported by the app.
//
// It answers two questions every grid needs answered, both about what the eye
// actually sees rather than what the byte says:
//
//   1. Does any card look like the card next to it? Comparing raw tints would
//      miss that a tile is RENDERED as a face derived from its tint. The
//      pre-2026-07-22 field palette had neighbours 0.6 apart in CIE L*a*b*, i.e.
//      indistinguishable, which is the bug these assertions exist to prevent.
//
//   2. Can you read the card? Added 2026-07-28, after a contrast audit found the
//      dark grid failing WCAG AA badly (label 3.42:1, blurb 2.22:1) because a
//      pale tint mixed over dark paper lands on a mid-tone. The two questions
//      pull against each other — see `src/lib/tiles.ts` — so they are guarded
//      together, here, where a change to one is measured against the other.

import { parseHex, contrastRatio, compositeOver, type RGB } from "./contrast";
import { LIGHT_TILE_MIX, coverLabelColor, tileFaceDark } from "./tiles";

export type Theme = "light" | "dark";
export const THEMES: Theme[] = ["light", "dark"];

/** The two paper tones a tile sits on (globals.css `--paper-raised`). */
export const PAPERS: Record<Theme, string> = {
  light: "#fbf7ef",
  dark: "#24211d",
};

/** The two ink tones (globals.css `--ink`). */
const INKS: Record<Theme, string> = { light: "#2b2723", dark: "#ece4d6" };

/**
 * What the eye actually sees: the rendered face of a tile in one theme.
 *
 * Light is the authored tint mixed over the raised paper, matching
 * `tileFaceLight`'s `color-mix`. Dark is the OKLCH re-light, straight from the
 * app's own `tileFaceDark`, so the app and this check cannot disagree.
 */
export function tileFace(tint: string, theme: Theme): RGB {
  if (theme === "dark") return parseHex(tileFaceDark(tint));
  const [t, p] = [parseHex(tint), parseHex(PAPERS.light)];
  return t.map((v, i) => LIGHT_TILE_MIX * v + (1 - LIGHT_TILE_MIX) * p[i]) as RGB;
}

/** CIE L*a*b* (D65), so "different" means different to an eye, not to a byte. */
function lab([r, g, b]: RGB): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Perceptual distance between two tiles as rendered in one theme. */
export function deltaE(a: string, b: string, theme: Theme): number {
  const [l1, a1, b1] = lab(tileFace(a, theme));
  const [l2, a2, b2] = lab(tileFace(b, theme));
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * Every pair of tiles that a 2-, 3- or 4-column grid can place next to each
 * other. A card's neighbours are always within 5 index positions: 1 across,
 * 2/3/4 straight up, and 3/5 diagonally. Returned as `[earlier, later, gap]`.
 */
export function neighbourPairs<T>(tiles: T[]): [T, T, number][] {
  const out: [T, T, number][] = [];
  for (let i = 0; i < tiles.length; i++)
    for (let d = 1; d <= 5 && i - d >= 0; d++) out.push([tiles[i - d], tiles[i], d]);
  return out;
}

/** The bar neighbours must clear. The palettes clear ~5; this sits low enough to
 *  leave room to restyle, high enough to fail loudly on a wash. */
export const MIN_NEIGHBOUR_DELTA_E = 4;

// ---------------------------------------------------------------------------
// Readability of the text ON a tile. Mirrors what `TileGrid` renders: the label
// at full `--ink`, the blurb at `text-ink/75`.
// ---------------------------------------------------------------------------

/** Contrast of the tile label (`text-ink`, 20px serif) against its face. */
export function labelRatio(tint: string, theme: Theme): number {
  const face = tileFace(tint, theme);
  return contrastRatio(parseHex(INKS[theme]), face);
}

/** Contrast of the tile blurb (`text-ink/75`, 12px) against its face. */
export function blurbRatio(tint: string, theme: Theme): number {
  const face = tileFace(tint, theme);
  return contrastRatio(compositeOver(parseHex(INKS[theme]), face, 0.75), face);
}

/** Both tile texts are normal-size, so both owe the full 1.4.3 AA ratio. */
export const MIN_TILE_TEXT_RATIO = 4.5;

// ---------------------------------------------------------------------------
// The Papers cover label — the same "text on a backdrop made of its own colour"
// problem, checked the same way.
// ---------------------------------------------------------------------------

/**
 * What sits behind the cover label, as `PaperCover` composes it: the chip's own
 * `hue` at 10% (`${hue}1a`), over the cover gradient's strongest stop (`${hue}2e`,
 * 18%), over the raised paper. The strongest stop is used deliberately — it is
 * the most hue-saturated backdrop the label can land on, so passing here means
 * passing anywhere on the cover.
 */
function coverBackdrop(hue: string, theme: Theme): RGB {
  const gradient = compositeOver(parseHex(hue), parseHex(PAPERS[theme]), 0.18);
  return compositeOver(parseHex(hue), gradient, 0.1);
}

/** Contrast of the re-lit cover label against its own hue-tinted backdrop. */
export function coverLabelRatio(hue: string, theme: Theme): number {
  const bg = coverBackdrop(hue, theme);
  return contrastRatio(parseHex(coverLabelColor(hue, theme)), bg);
}
