import { describe, it, expect } from "vitest";
import {
  ARTIC_FORMS,
  ARTIC_ERAS,
  ERA_ALL,
  MIN_ERA_WORKS,
  articFormById,
  articEraById,
  describeSlice,
  erasForForm,
  formBucketId,
  parseFormBucket,
  worksInSlice,
} from "./artic.forms";
import { ARTIC_BUCKETS } from "./artic.buckets";
import {
  THEMES,
  deltaE,
  neighbourPairs,
  MIN_NEIGHBOUR_DELTA_E,
  labelRatio,
  blurbRatio,
  MIN_TILE_TEXT_RATIO,
} from "../tile-contrast.testkit";

describe("art form registry", () => {
  it("looks a form or era up by id, and rejects junk", () => {
    expect(articFormById("painting")?.label).toBe("Paintings");
    expect(articFormById("not-a-form")).toBeUndefined();
    expect(articFormById(null)).toBeUndefined();
    expect(articEraById("1850-1899")?.label).toBe("1850 to 1899");
    expect(articEraById("1750s")).toBeUndefined();
  });

  it("ids are unique, and every form names an AIC artwork type", () => {
    const ids = ARTIC_FORMS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of ARTIC_FORMS) expect(f.aicType.trim().length).toBeGreaterThan(0);
  });

  it("eras are a contiguous, ascending ladder", () => {
    for (const e of ARTIC_ERAS) expect(e.from).toBeLessThanOrEqual(e.to);
    for (let i = 1; i < ARTIC_ERAS.length; i++) {
      expect(ARTIC_ERAS[i].from, ARTIC_ERAS[i].id).toBe(ARTIC_ERAS[i - 1].to + 1);
    }
  });
});

describe("art form registry — homepage face", () => {
  it("every form has a glyph, a blurb and a #rrggbb tint", () => {
    for (const f of ARTIC_FORMS) {
      expect(f.glyph.trim().length, f.label).toBeGreaterThan(0);
      expect(f.blurb.trim().length, f.label).toBeGreaterThan(0);
      expect(f.tint, f.label).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("glyphs are unique so the grid never shows the same mark twice", () => {
    const glyphs = ARTIC_FORMS.map((f) => f.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  // Same rule as the field + news grids: typographic symbols, never emoji.
  it("glyphs are single symbols, never emoji", () => {
    for (const f of ARTIC_FORMS) {
      expect([...f.glyph].length, `${f.label}: one code point`).toBe(1);
      expect(f.glyph, `${f.label}: no variation selector`).not.toMatch(/️/);
      expect(f.glyph.codePointAt(0), `${f.label}: stays in the BMP`).toBeLessThan(
        0x10000,
      );
      expect(f.glyph, `${f.label}: not an emoji`).not.toMatch(
        /\p{Emoji_Presentation}/u,
      );
    }
  });

  // Standing copy preference: no em/en dashes in anything the reader sees. This
  // is why a period reads "1850 to 1899" and not "1850–1899".
  it("blurbs and labels use no em or en dashes", () => {
    for (const f of ARTIC_FORMS) {
      expect(f.blurb, f.label).not.toMatch(/[—–]/);
      expect(f.label, f.label).not.toMatch(/[—–]/);
    }
    for (const e of ARTIC_ERAS) expect(e.label, e.id).not.toMatch(/[—–]/);
  });
});

describe("art form registry — grid order", () => {
  it("is alphabetical by label", () => {
    const labels = ARTIC_FORMS.map((f) => f.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it("no card looks like any neighbour in a 2, 3 or 4 column grid", () => {
    for (const theme of THEMES) {
      for (const [a, b, gap] of neighbourPairs(ARTIC_FORMS)) {
        expect(
          deltaE(a.tint, b.tint, theme),
          `${a.label} vs ${b.label} (${gap} apart, ${theme})`,
        ).toBeGreaterThan(MIN_NEIGHBOUR_DELTA_E);
      }
    }
  });


  // 1.4.3 AA. Guarded here, beside the neighbour check, because the two pull in
  // opposite directions: a face deep enough to read on is a face closer to its
  // neighbours. See src/lib/tiles.ts.
  it("every card's label and blurb are readable on its own face", () => {
    for (const theme of THEMES) {
      for (const f of ARTIC_FORMS) {
        expect(
          labelRatio(f.tint, theme),
          `${f.label} label (${theme})`,
        ).toBeGreaterThanOrEqual(MIN_TILE_TEXT_RATIO);
        expect(
          blurbRatio(f.tint, theme),
          `${f.label} blurb (${theme})`,
        ).toBeGreaterThanOrEqual(MIN_TILE_TEXT_RATIO);
      }
    }
  });

  it("uses distinct tints throughout", () => {
    const tints = ARTIC_FORMS.map((f) => f.tint);
    expect(new Set(tints).size).toBe(tints.length);
  });

  // Both grids render on the Gallery home, one above the other: the themed
  // buckets ("start here") and the forms ("stay here"). "Textiles" is a label in
  // both, so the glyph and blurb have to carry the difference, or the two tiles
  // read as a duplicate of each other.
  it("never shows a form tile that looks like a themed bucket tile", () => {
    const bucketGlyphs = new Set(ARTIC_BUCKETS.map((b) => b.glyph));
    const bucketBlurbs = new Set(
      ARTIC_BUCKETS.map((b) => b.blurb.toLowerCase()),
    );
    for (const f of ARTIC_FORMS) {
      expect(bucketGlyphs, `${f.label}: glyph collides with a bucket`).not.toContain(
        f.glyph,
      );
      expect(
        bucketBlurbs,
        `${f.label}: blurb collides with a bucket`,
      ).not.toContain(f.blurb.toLowerCase());
    }
  });
});

describe("era availability", () => {
  it("offers All periods first for every form", () => {
    for (const f of ARTIC_FORMS) {
      const eras = erasForForm(f.id);
      expect(eras.length, f.label).toBeGreaterThan(0);
      expect(eras[0].id, f.label).toBe(ERA_ALL);
    }
  });

  // The whole point of baking counts: a form is only offered the centuries it
  // actually holds. AIC has no photographs before 1800 and no coins after ~1500.
  it("hides periods a form has too little of", () => {
    const photo = erasForForm("photograph").map((e) => e.id);
    expect(photo).not.toContain("1500s");
    expect(photo).not.toContain("1600s");
    expect(photo).not.toContain("1700s");
    expect(photo).toContain("1850-1899");

    const coin = erasForForm("coin").map((e) => e.id);
    expect(coin).toEqual([ERA_ALL, "pre-1500"]);
  });

  it("every offered period clears the floor", () => {
    for (const f of ARTIC_FORMS) {
      for (const era of erasForForm(f.id)) {
        if (era.id === ERA_ALL) continue;
        expect(era.works, `${f.label} / ${era.id}`).toBeGreaterThanOrEqual(
          MIN_ERA_WORKS,
        );
      }
    }
  });

  it("counts All periods as the sum of the ladder", () => {
    expect(worksInSlice("painting", ERA_ALL)).toBe(
      ARTIC_ERAS.reduce((n, e) => n + worksInSlice("painting", e.id), 0),
    );
    expect(worksInSlice("not-a-form", ERA_ALL)).toBe(0);
  });

  it("returns nothing for an unknown form", () => {
    expect(erasForForm("sonnets")).toEqual([]);
  });
});

describe("form bucket encoding", () => {
  it("round-trips a form with and without a period", () => {
    const withEra = parseFormBucket(formBucketId("painting", "1850-1899"));
    expect(withEra?.form.id).toBe("painting");
    expect(withEra?.era?.id).toBe("1850-1899");

    const noEra = parseFormBucket(formBucketId("print"));
    expect(noEra?.form.id).toBe("print");
    expect(noEra?.era).toBeNull();
  });

  it("round-trips every offered slice", () => {
    for (const f of ARTIC_FORMS) {
      for (const era of erasForForm(f.id)) {
        const parsed = parseFormBucket(formBucketId(f.id, era.id));
        expect(parsed, `${f.id}/${era.id}`).not.toBeNull();
        expect(parsed?.form.id).toBe(f.id);
        expect(parsed?.era?.id ?? ERA_ALL).toBe(era.id);
      }
    }
  });

  // The parser doubles as the discover route's injection guard, so junk of every
  // shape has to come back null rather than reaching the upstream query.
  it("rejects malformed, unknown, and hand-edited buckets", () => {
    for (const junk of [
      null,
      undefined,
      "",
      "painting",
      "form:painting",
      "form:painting:1850-1899:extra",
      "form:sonnets:all",
      "form:painting:1750s",
      "style:painting:all",
      'form:painting:all") OR 1=1',
    ]) {
      expect(parseFormBucket(junk), String(junk)).toBeNull();
    }
  });

  it("rejects a period the form is too thin for, even though the era exists", () => {
    // 1600s photographs: a real era, a real form, zero works.
    expect(parseFormBucket("form:photograph:1600s")).toBeNull();
    // and the same era IS valid for a form that has it
    expect(parseFormBucket("form:print:1600s")).not.toBeNull();
  });
});

describe("describeSlice", () => {
  it("names the form alone, or the form and the period", () => {
    const painting = articFormById("painting")!;
    expect(describeSlice(painting, null)).toBe("Paintings");
    expect(describeSlice(painting, articEraById("1850-1899")!)).toBe(
      "Paintings, 1850 to 1899",
    );
  });

  it("never produces an em or en dash", () => {
    for (const f of ARTIC_FORMS) {
      expect(describeSlice(f, null)).not.toMatch(/[—–]/);
      for (const e of ARTIC_ERAS) expect(describeSlice(f, e)).not.toMatch(/[—–]/);
    }
  });
});
