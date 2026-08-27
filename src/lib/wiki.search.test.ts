import { describe, it, expect } from "vitest";
import { isListLikeTitle, normalizeSearchResults,
  readSearchQuery,
  SEARCH_QUERY_MAX,
} from "./wiki";

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

describe("readSearchQuery — bounded at both ends", () => {
  it("drops anything under two characters", () => {
    expect(readSearchQuery("")).toBe("");
    expect(readSearchQuery("a")).toBe("");
    expect(readSearchQuery("  b  ")).toBe("");
    expect(readSearchQuery(null)).toBe("");
    expect(readSearchQuery(undefined)).toBe("");
  });

  it("passes an ordinary query through, trimmed", () => {
    expect(readSearchQuery("  Octopus ")).toBe("Octopus");
    expect(readSearchQuery("Black hole")).toBe("Black hole");
  });

  // A MediaWiki title cannot exceed 255 bytes, so a longer term matches nothing;
  // measured, a 400 character prefixsearch returns no pages at all. Truncating
  // rather than rejecting keeps a long paste working in an autocomplete box.
  it("truncates rather than rejecting an over-long query", () => {
    const long = "x".repeat(1000);
    const out = readSearchQuery(long);
    expect(out).toHaveLength(SEARCH_QUERY_MAX);
    expect(out).toBe("x".repeat(SEARCH_QUERY_MAX));
  });

  it("leaves no trailing space behind after truncating", () => {
    const out = readSearchQuery("y".repeat(SEARCH_QUERY_MAX - 1) + "   tail");
    expect(out).toBe(out.trim());
    expect(out.length).toBeLessThanOrEqual(SEARCH_QUERY_MAX);
  });
});
