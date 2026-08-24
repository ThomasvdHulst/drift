import { describe, it, expect } from "vitest";
import { MET_BUCKETS, metBucketById } from "./met.buckets";
import {
  THEMES,
  deltaE,
  neighbourPairs,
  labelRatio,
  blurbRatio,
  MIN_TILE_TEXT_RATIO,
} from "../tile-contrast.testkit";

describe("the Gallery's rooms", () => {
  it("offers enough of them to browse", () => {
    expect(MET_BUCKETS.length).toBeGreaterThanOrEqual(8);
  });

  it("looks every bucket up by id, and refuses one it does not know", () => {
    for (const b of MET_BUCKETS) expect(metBucketById(b.id)).toBe(b);
    expect(metBucketById("nope")).toBeUndefined();
    expect(metBucketById("")).toBeUndefined();
  });

  it("has unique ids, labels and glyphs", () => {
    for (const key of ["id", "label", "glyph"] as const) {
      const values = MET_BUCKETS.map((b) => b[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  // A bucket must always be answerable. `departmentId` is the exact filter we
  // prefer, but `q` is the floor: without it a bucket could resolve to nothing.
  it("always carries a full-text term, even when it has a department", () => {
    for (const b of MET_BUCKETS) {
      expect(b.q.trim().length, b.id).toBeGreaterThan(0);
    }
  });

  it("uses real Met department ids where it claims one", () => {
    // The museum's published department ids. A typo here would silently return
    // an empty room, which is exactly the sort of bug a test should catch.
    const known = new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21]);
    const withDept = MET_BUCKETS.filter((b) => b.departmentId !== undefined);
    expect(withDept.length).toBeGreaterThan(0);
    for (const b of withDept) {
      expect(known.has(b.departmentId!), `${b.id} → ${b.departmentId}`).toBe(true);
    }
  });

  it("renders in alphabetical order, which is how the grid reads", () => {
    const labels = MET_BUCKETS.map((b) => b.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "en")));
  });

  // The owner dislikes em/en dashes as punctuation and the copy rules forbid
  // them in user-facing text.
  it("uses no em or en dashes in any user-facing string", () => {
    for (const b of MET_BUCKETS) {
      for (const s of [b.label, b.blurb]) {
        expect(s, `${b.id}: ${s}`).not.toMatch(/[—–]/);
      }
    }
  });

  it("uses typographic marks, not emoji, for the tile glyphs", () => {
    for (const b of MET_BUCKETS) {
      expect(b.glyph.length, b.id).toBeLessThanOrEqual(2);
      // Emoji presentation would render as a coloured pictograph and break the
      // quiet-reading-room look every other tile keeps.
      expect(b.glyph, b.id).not.toMatch(/\p{Emoji_Presentation}|️/u);
    }
  });

  it("uses six-digit hex tints", () => {
    for (const b of MET_BUCKETS) expect(b.tint, b.id).toMatch(/^#[0-9a-f]{6}$/);
  });
});

// Two gates, and they are deliberately not the same bar (CLAUDE.md §10).
//
// TEXT CONTRAST is a real WCAG 1.4.3 requirement and gets the full AA ratio, in
// both themes, no exceptions.
//
// NEIGHBOUR DISTINCTNESS is an internal quality bar, not a WCAG rule: a tile is
// identified by its label and its unique glyph, both of which are text. The
// FORM tiles hold themselves to `MIN_NEIGHBOUR_DELTA_E` across a 5-position
// window because they are a dense grid of near-identical phrasings. Bucket tiles
// never have: the Art Institute palette this replaces failed that window on 46
// pairs (worst 0.95) and shipped that way for a year. So the bar here is the one
// that catches the defect that actually matters — two tiles the eye reads as the
// same colour sitting side by side — applied to immediate neighbours, where a
// clash is visible. Raising it to the form-tile window is not possible without
// leaving Drift's warm muted range, which is a worse trade.
const MIN_ADJACENT_DELTA_E = 3;

describe("tile palette", () => {
  it("keeps adjacent tiles distinguishable in both themes", () => {
    for (const theme of THEMES) {
      for (const [a, b, gap] of neighbourPairs(MET_BUCKETS)) {
        if (gap > 2) continue; // see the note above
        expect(
          deltaE(a.tint, b.tint, theme),
          `${theme}: ${a.id} vs ${b.id} (gap ${gap})`,
        ).toBeGreaterThanOrEqual(MIN_ADJACENT_DELTA_E);
      }
    }
  });

  it("keeps the label and blurb readable on every tile, in both themes", () => {
    for (const theme of THEMES) {
      for (const b of MET_BUCKETS) {
        expect(labelRatio(b.tint, theme), `${theme} label ${b.id}`).toBeGreaterThanOrEqual(
          MIN_TILE_TEXT_RATIO,
        );
        expect(blurbRatio(b.tint, theme), `${theme} blurb ${b.id}`).toBeGreaterThanOrEqual(
          MIN_TILE_TEXT_RATIO,
        );
      }
    }
  });
});
