import { describe, it, expect } from "vitest";
import { isListLikeTitle, normalizeSearchResults } from "./wiki";

describe("isListLikeTitle", () => {
  it("flags list / index / listings titles", () => {
    expect(isListLikeTitle("List of Category 5 Atlantic hurricanes")).toBe(true);
    expect(isListLikeTitle("Lists of composers")).toBe(true);
    expect(isListLikeTitle("Index of physics articles")).toBe(true);
    expect(isListLikeTitle("Outline of mathematics")).toBe(true);
    expect(isListLikeTitle("National Register listings in Ohio")).toBe(true);
  });
  it("leaves normal titles alone", () => {
    expect(isListLikeTitle("Category theory")).toBe(false);
    expect(isListLikeTitle("Bauhaus")).toBe(false);
  });
});

describe("normalizeSearchResults", () => {
  const raw = {
    query: {
      pages: [
        { index: 2, title: "Category 5 cable", description: "A cable" },
        {
          index: 1,
          title: "Category theory",
          description: "General theory of mathematical structures",
          thumbnail: { source: "https://x/thumb.jpg" },
        },
        { index: 3, title: "List of categories", description: "" }, // dropped: list
        {
          index: 4,
          title: "Category",
          description: "Disambiguation",
          pageprops: { disambiguation: "" },
        }, // dropped: disambiguation
      ],
    },
  };

  it("orders by index, drops list + disambiguation, carries the thumbnail", () => {
    const out = normalizeSearchResults(raw);
    expect(out.map((s) => s.title)).toEqual(["Category theory", "Category 5 cable"]);
    expect(out[0].thumbnail).toBe("https://x/thumb.jpg");
    expect(out[1].thumbnail).toBeUndefined();
  });

  it("returns [] for a malformed / empty response", () => {
    expect(normalizeSearchResults(null)).toEqual([]);
    expect(normalizeSearchResults({})).toEqual([]);
    expect(normalizeSearchResults({ query: {} })).toEqual([]);
  });
});
