import { describe, it, expect } from "vitest";
import { classOf, labelFor, selectDiverseThreads } from "./diversity";
import type { RelatedCandidate } from "./types";

function cand(
  pageTitle: string,
  description?: string,
  extract = "A sentence with enough content.",
): RelatedCandidate {
  return { pageTitle, displayTitle: pageTitle, description, extract };
}

describe("classOf", () => {
  it("uses the first word of the description, lowercased", () => {
    expect(classOf(cand("Grimpoteuthis", "Genus of cephalopods"))).toBe(
      "genus",
    );
  });
  it("gives description-less candidates a unique class", () => {
    expect(classOf(cand("A"))).not.toBe(classOf(cand("B")));
  });
});

describe("labelFor", () => {
  it("uses a short description", () => {
    expect(labelFor(cand("X", "Class of molluscs"))).toBe("Class of molluscs");
  });
  it("falls back to the title for long descriptions", () => {
    const long = "A very long description that exceeds the forty character cap";
    expect(labelFor(cand("Shipwreck archaeology", long))).toBe(
      "Shipwreck archaeology",
    );
  });
  it("falls back to the title when there is no description", () => {
    expect(labelFor(cand("Ancient computing"))).toBe("Ancient computing");
  });
});

describe("selectDiverseThreads", () => {
  it("does not pick three of the same class in a row", () => {
    const candidates = [
      cand("Genus A", "Genus of cephalopods"),
      cand("Genus B", "Genus of cephalopods"),
      cand("Genus C", "Genus of cephalopods"),
      cand("A Novel", "Novel by someone"),
      cand("A City", "City in France"),
    ];
    const threads = selectDiverseThreads(candidates, { count: 3 });
    const classes = threads.map((t) =>
      (t.candidate.description ?? "").split(" ")[0],
    );
    // three distinct classes → Genus, Novel, City
    expect(new Set(classes).size).toBe(3);
  });

  it("fills remaining slots when classes run out", () => {
    const candidates = [
      cand("Genus A", "Genus of cephalopods"),
      cand("Genus B", "Genus of cephalopods"),
    ];
    const threads = selectDiverseThreads(candidates, { count: 3 });
    expect(threads).toHaveLength(2); // only two available
    expect(threads[0].candidate.pageTitle).toBe("Genus A");
    expect(threads[1].candidate.pageTitle).toBe("Genus B");
  });

  it("excludes seen pages", () => {
    const candidates = [
      cand("Seen one", "Genus of cephalopods"),
      cand("Fresh one", "Novel by someone"),
    ];
    const threads = selectDiverseThreads(candidates, {
      count: 3,
      seen: new Set(["Seen one"]),
    });
    expect(threads.map((t) => t.candidate.pageTitle)).toEqual(["Fresh one"]);
  });

  it("excludes junk (no extract / list / disambiguation)", () => {
    const candidates = [
      cand("No extract", "Genus of things", ""),
      cand("List of things", "List article"),
      cand("Good one", "Novel by someone"),
    ];
    const threads = selectDiverseThreads(candidates, { count: 3 });
    expect(threads.map((t) => t.candidate.pageTitle)).toEqual(["Good one"]);
  });

  it("respects the count and preserves relevance order within a class", () => {
    const candidates = [
      cand("First", "Novel by A"),
      cand("Second", "City in B"),
      cand("Third", "Genus of C"),
      cand("Fourth", "Painting by D"),
    ];
    const threads = selectDiverseThreads(candidates, { count: 2 });
    expect(threads).toHaveLength(2);
    expect(threads.map((t) => t.candidate.pageTitle)).toEqual([
      "First",
      "Second",
    ]);
  });
});
