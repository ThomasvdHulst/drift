import { describe, it, expect } from "vitest";
import { TOPICS, topicByKeyword, topicByOresKey } from "./topics";

describe("topic registry — identity", () => {
  it("is non-empty and has unique ids, keywords, labels and ORES keys", () => {
    expect(TOPICS.length).toBeGreaterThan(0);
    for (const key of ["id", "keyword", "label", "oresKey"] as const) {
      const values = TOPICS.map((t) => t[key]);
      expect(new Set(values).size, `duplicate ${key}`).toBe(values.length);
    }
  });

  it("keeps id and keyword in step (the interest model keys on id)", () => {
    for (const t of TOPICS) expect(t.id).toBe(t.keyword);
  });

  it("resolves by keyword and by ORES key", () => {
    for (const t of TOPICS) {
      expect(topicByKeyword(t.keyword)).toBe(t);
      expect(topicByOresKey(t.oresKey)).toBe(t);
    }
    expect(topicByKeyword("not-a-topic")).toBeUndefined();
  });
});

describe("topic registry — homepage face", () => {
  it("every topic has a glyph, a blurb and a #rrggbb tint", () => {
    for (const t of TOPICS) {
      expect(t.glyph.trim().length, t.label).toBeGreaterThan(0);
      expect(t.blurb.trim().length, t.label).toBeGreaterThan(0);
      expect(t.tint, t.label).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("glyphs are unique so the grid never shows the same mark twice", () => {
    const glyphs = TOPICS.map((t) => t.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  // The tiles want typographic *symbols* (dingbats, geometric shapes, math
  // marks), not emoji. The exact rule: one BMP code point, no variation
  // selector, and not a character that renders as colour emoji by default.
  // This correctly admits ⚙ (emoji-capable, but text-presentation by default)
  // while rejecting anything like 🚀.
  it("glyphs are single symbols, never emoji", () => {
    for (const t of TOPICS) {
      expect([...t.glyph].length, `${t.label}: one code point`).toBe(1);
      expect(t.glyph, `${t.label}: no variation selector`).not.toMatch(/️/);
      expect(t.glyph.codePointAt(0), `${t.label}: stays in the BMP`).toBeLessThan(
        0x10000,
      );
      expect(t.glyph, `${t.label}: not an emoji`).not.toMatch(
        /\p{Emoji_Presentation}/u,
      );
    }
  });

  // Standing copy preference: no em/en dashes in anything the reader sees.
  // Mirrors the same guard over the guided-tour script (lib/tour/steps.test.ts).
  it("blurbs use no em or en dashes", () => {
    for (const t of TOPICS) expect(t.blurb, t.label).not.toMatch(/[—–]/);
  });
});

// ---------------------------------------------------------------------------
// The array's order IS the homepage grid's order, so these two guard the layout.
// ---------------------------------------------------------------------------

// How a tile actually looks: the tint blended 45% over the raised paper tone, as
// `TileGrid`'s color-mix does it. Comparing raw tints would miss that the blend
// washes most of the difference out.
const PAPER = { light: "#fbf7ef", dark: "#24211d" };

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

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

function deltaE(a: string, b: string, paper: string): number {
  const [l1, a1, b1] = lab(tileColor(a, paper));
  const [l2, a2, b2] = lab(tileColor(b, paper));
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

describe("topic registry — grid order", () => {
  it("is alphabetical by label, so 28 cards stay scannable without headings", () => {
    const labels = TOPICS.map((t) => t.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  // The grid is 2 columns on mobile, 3 at `sm`, 4 at `lg`. A card's neighbours
  // are therefore always within 5 index positions: 1 across, 2/3/4 straight up,
  // and 3/5 diagonally. Every one of those pairs has to be visibly different, or
  // a row reads as one wash of colour (which it did before this palette).
  it("no card looks like any neighbour in a 2, 3 or 4 column grid", () => {
    for (const paper of [PAPER.light, PAPER.dark]) {
      for (let i = 0; i < TOPICS.length; i++) {
        for (let d = 1; d <= 5 && i - d >= 0; d++) {
          const [a, b] = [TOPICS[i - d], TOPICS[i]];
          // The palette this guards clears ~5. The bar sits at 4 so it still
          // fails loudly on a wash like the pre-2026-07-22 tints, whose closest
          // neighbours were 0.6 apart (indistinguishable), without pinning the
          // exact shades.
          expect(
            deltaE(a.tint, b.tint, paper),
            `${a.label} vs ${b.label} (${d} apart, ${paper})`,
          ).toBeGreaterThan(4);
        }
      }
    }
  });

  it("uses distinct tints throughout", () => {
    const tints = TOPICS.map((t) => t.tint);
    expect(new Set(tints).size).toBe(tints.length);
  });
});
