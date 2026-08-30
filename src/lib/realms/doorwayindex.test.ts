// ---------------------------------------------------------------------------
// The reverse doorway's matcher.
//
// The cases below are not invented. They are what was MEASURED on 30 August 2026
// when the old `passesReverseGate` (a raw substring test) was run directly over
// the museum's 237,000 usable works instead of over five relevance-ranked search
// results: it answered "Owl" with an Open Bowl and "Cat" with Adam and Eve. Every
// boundary test here pins one of those.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  doorwayCandidates,
  lineStarts,
  normalizeForIndex,
  FIELD_SEP as S,
  type DoorwayIndex,
} from "./doorwayindex";

/** Build a tiny index the way scripts/build-met-index.mjs builds the real one:
 *  every field wrapped in the separator and space-padded, in rank order. */
function makeIndex(
  works: { id: number; title: string; tags?: string[]; death?: number }[],
): DoorwayIndex {
  const lines = works.map((w) =>
    [normalizeForIndex(w.title), ...(w.tags ?? []).map(normalizeForIndex)]
      .filter(Boolean)
      .map((f) => `${S} ${f} `)
      .join("") + S,
  );
  const blob = lines.join("\n");
  const ids = new Int32Array(works.length * 2);
  works.forEach((w, i) => {
    ids[i * 2] = w.id;
    ids[i * 2 + 1] = w.death ?? 0;
  });
  return { blob, starts: lineStarts(blob), ids };
}

const first = (idx: DoorwayIndex, term: string) =>
  doorwayCandidates(idx, term)[0]?.id ?? null;

describe("a match must land on a word boundary", () => {
  it("does not answer Owl with a bowl", () => {
    // The exact false positive that killed the raw substring gate.
    const idx = makeIndex([
      { id: 1, title: "Open Bowl" },
      { id: 2, title: "Owl" },
    ]);
    expect(first(idx, "Owl")).toBe(2);
  });

  it("does not answer Cat with a cathedral, a catalogue or something delicate", () => {
    const idx = makeIndex([
      { id: 1, title: "Cathedral at Rouen" },
      { id: 2, title: "Catalogue of Arms" },
      { id: 3, title: "Delicate Vessel" },
    ]);
    expect(doorwayCandidates(idx, "Cat")).toHaveLength(0);
  });

  it("still matches a word at the start, middle or end of a title", () => {
    const idx = makeIndex([
      { id: 1, title: "Jacket with Octopus and Waves" },
      { id: 2, title: "Octopus" },
    ]);
    // Both are genuine; the shorter, more on-point one is baked earlier by the
    // build script, so order here follows the blob.
    expect(doorwayCandidates(idx, "Octopus").map((c) => c.id).sort()).toEqual([1, 2]);
  });
});

describe("the inflection allowance", () => {
  it("matches the plural the museum catalogues in", () => {
    // Subjects are tagged in the plural while an article title is singular.
    // Losing this would lose most of the good doorways.
    const idx = makeIndex([{ id: 7, title: "Stirrup Jar", tags: ["octopuses"] }]);
    expect(first(idx, "Octopus")).toBe(7);
  });

  it("matches cats from cat", () => {
    const idx = makeIndex([{ id: 8, title: "A Lady", tags: ["cats"] }]);
    expect(first(idx, "Cat")).toBe(8);
  });

  it("stops well short of a different word", () => {
    // Three letters is the ceiling precisely so "cart" cannot reach
    // "cartography" and the gate start lying.
    const idx = makeIndex([{ id: 9, title: "Cartography of the Nile" }]);
    expect(doorwayCandidates(idx, "Cart")).toHaveLength(0);
  });

  it("allows only letters, so a number or a hyphen is a different word", () => {
    const idx = makeIndex([{ id: 10, title: "Cat 5 Cable" }]);
    expect(first(idx, "Cat")).toBe(10);
    const idx2 = makeIndex([{ id: 11, title: "Cat5000 Device" }]);
    expect(doorwayCandidates(idx2, "Cat")).toHaveLength(0);
  });
});

describe("fields are separated, not concatenated", () => {
  it("does not let a term run from the title into a tag", () => {
    // A work titled "...mount" that happens to be tagged "fuji" is not a
    // Mount Fuji. Wrapping every field is what prevents it.
    const idx = makeIndex([{ id: 1, title: "The Mount", tags: ["fuji"] }]);
    expect(doorwayCandidates(idx, "Mount Fuji")).toHaveLength(0);
  });

  it("still matches a multi-word term inside one field", () => {
    const idx = makeIndex([{ id: 2, title: "Mount Fuji from the Sea" }]);
    expect(first(idx, "Mount Fuji")).toBe(2);
  });

  it("does not let a term run across two works", () => {
    const idx = makeIndex([{ id: 1, title: "Mount" }, { id: 2, title: "Fuji" }]);
    expect(doorwayCandidates(idx, "Mount Fuji")).toHaveLength(0);
  });
});

describe("ranking", () => {
  it("puts a visible title match above a tag match", () => {
    // Principle 1: the reader always sees WHY. "Swiss Glacier" answers the
    // article visibly; a landscape merely tagged so reads as arbitrary.
    const idx = makeIndex([
      { id: 1, title: "Mountain Landscape", tags: ["glaciers"] },
      { id: 2, title: "Swiss Glacier" },
    ]);
    const got = doorwayCandidates(idx, "Glacier");
    expect(got[0]).toMatchObject({ id: 2, viaTitle: true });
    expect(got[1]).toMatchObject({ id: 1, viaTitle: false });
  });

  it("otherwise keeps the baked order, which is already the quality order", () => {
    const idx = makeIndex([
      { id: 1, title: "Wolf" },
      { id: 2, title: "Wolf and Fox Hunt in a Wooded Landscape" },
    ]);
    expect(doorwayCandidates(idx, "Wolf").map((c) => c.id)).toEqual([1, 2]);
  });

  it("offers each work once, however many of its fields match", () => {
    const idx = makeIndex([{ id: 1, title: "Cat", tags: ["cats", "cat"] }]);
    expect(doorwayCandidates(idx, "Cat")).toHaveLength(1);
  });
});

describe("terms that must stay silent", () => {
  it("says nothing for an abstract article", () => {
    const idx = makeIndex([
      { id: 1, title: "Mechanical Elephant" },
      { id: 2, title: "Portrait of a Man", tags: ["men", "portraits"] },
    ]);
    for (const term of ["Quantum mechanics", "Existentialism", "Game theory"]) {
      expect(doorwayCandidates(idx, term)).toHaveLength(0);
    }
  });

  it("refuses a term too short to mean anything", () => {
    const idx = makeIndex([{ id: 1, title: "An Ox in a Field" }]);
    expect(doorwayCandidates(idx, "Ox")).toHaveLength(0);
    expect(doorwayCandidates(idx, "")).toHaveLength(0);
  });
});

describe("what the caller needs to apply the EU copyright test", () => {
  it("carries the artist death year so no request is spent to learn it", () => {
    const idx = makeIndex([{ id: 5, title: "Aurora", death: 1932 }]);
    expect(doorwayCandidates(idx, "Aurora")[0]).toMatchObject({
      id: 5,
      deathYear: 1932,
    });
  });

  it("reports 0 where the catalogue records no death year", () => {
    const idx = makeIndex([{ id: 6, title: "Aurora" }]);
    expect(doorwayCandidates(idx, "Aurora")[0].deathYear).toBe(0);
  });
});

describe("normalisation", () => {
  it("folds case, accents and punctuation the same way on both sides", () => {
    const idx = makeIndex([{ id: 1, title: "Café Terrace at Night" }]);
    expect(first(idx, "cafe")).toBe(1);
    expect(first(idx, "CAFÉ")).toBe(1);
  });

  it("collapses whitespace so a padded term still matches", () => {
    const idx = makeIndex([{ id: 1, title: "Mount Fuji" }]);
    expect(first(idx, "  mount   fuji  ")).toBe(1);
  });
});

describe("lineStarts", () => {
  it("gives one offset per work and none past the end", () => {
    const blob = ["a", "b", "c"].join("\n");
    expect(Array.from(lineStarts(blob))).toEqual([0, 2, 4]);
  });

  it("does not invent a phantom line after a trailing newline", () => {
    expect(Array.from(lineStarts("a\nb\n"))).toEqual([0, 2]);
  });
});

// ---------------------------------------------------------------------------
// The build script carries a COPY of `normalizeForIndex`, because it runs under
// plain Node and cannot import a TypeScript module. The same arrangement as
// scripts/bots/urls.mjs and lib/loadbot.test.ts: the copy is pinned rather than
// trusted.
//
// If these two ever disagree the failure is silent and total — the blob is
// normalised one way, every lookup normalises the other way, and the doorway
// simply stops finding anything while every unit test still passes.
// ---------------------------------------------------------------------------
describe("the build script's copy of the normaliser", () => {
  it("still behaves exactly like the runtime one", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("scripts/build-met-index.mjs", "utf8");
    // The script self-executes on import, so lift the function out by source.
    const body = src.match(/function normalize\(s\) \{[\s\S]*?\n\}/)?.[0];
    expect(body, "normalize() not found in the build script").toBeTruthy();
    const scriptNormalize = new Function(`${body}; return normalize;`)() as (
      s: string,
    ) => string;

    for (const sample of [
      "Terracotta stirrup jar with octopus",
      "Café Terrace at Night",
      "北斎麁画|Various Pictures by Hokusai",
      "Mount   Fuji\n",
      "Cat-5 Cable (No. 3)",
      "  ÉLÈVE  ",
      "",
      "Ånd så",
      "Dish in shape of Mount Fuji with horse",
    ]) {
      expect(scriptNormalize(sample), sample).toBe(normalizeForIndex(sample));
    }
  });

  it("uses the same field separator on both sides", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("scripts/build-met-index.mjs", "utf8");
    expect(src).toContain("const SEP = String.fromCharCode(1)");
    expect(S).toBe(String.fromCharCode(1));
  });
});
