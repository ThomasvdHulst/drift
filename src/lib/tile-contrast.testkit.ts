// Test-only colour maths, shared by the two homepage tile grids (the 28 field
// cards in topics.ts and the 10 news sections in current.ts). Not a test file
// itself — vitest only collects `*.test.ts` — and never imported by the app.
//
// It answers one question both grids need answered: does any card look like the
// card next to it? Comparing raw tints would miss that `TileGrid` renders them
// blended 45% over the raised paper tone, which washes most of the difference
// out. The pre-2026-07-22 field palette had neighbours 0.6 apart in CIE L*a*b*,
// i.e. indistinguishable, which is the bug these assertions exist to prevent.

/** The two paper tones a tile can sit on (globals.css `--paper-raised`). */
export const PAPERS = { light: "#fbf7ef", dark: "#24211d" };

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** What the eye actually sees: the tint as `TileGrid`'s color-mix renders it. */
function tileColor(tint: string, paper: string): [number, number, number] {
  const [t, p] = [rgb(tint), rgb(paper)];
  return t.map((v, i) => 0.45 * v + 0.55 * p[i]) as [number, number, number];
}

/** CIE L*a*b* (D65), so "different" means different to an eye, not to a byte. */
function lab([r, g, b]: [number, number, number]): [number, number, number] {
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

export function deltaE(a: string, b: string, paper: string): number {
  const [l1, a1, b1] = lab(tileColor(a, paper));
  const [l2, a2, b2] = lab(tileColor(b, paper));
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
