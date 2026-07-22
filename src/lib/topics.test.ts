import { describe, it, expect } from "vitest";
import { TOPICS, topicByKeyword, topicByOresKey } from "./topics";
import {
  PAPERS,
  deltaE,
  neighbourPairs,
  MIN_NEIGHBOUR_DELTA_E,
} from "./tile-contrast.testkit";

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

describe("topic registry — grid order", () => {
  it("is alphabetical by label, so 28 cards stay scannable without headings", () => {
    const labels = TOPICS.map((t) => t.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it("no card looks like any neighbour in a 2, 3 or 4 column grid", () => {
    for (const paper of Object.values(PAPERS)) {
      for (const [a, b, gap] of neighbourPairs(TOPICS)) {
        expect(
          deltaE(a.tint, b.tint, paper),
          `${a.label} vs ${b.label} (${gap} apart, ${paper})`,
        ).toBeGreaterThan(MIN_NEIGHBOUR_DELTA_E);
      }
    }
  });

  it("uses distinct tints throughout", () => {
    const tints = TOPICS.map((t) => t.tint);
    expect(new Set(tints).size).toBe(tints.length);
  });
});
