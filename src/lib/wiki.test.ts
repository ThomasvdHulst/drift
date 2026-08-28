import { describe, it, expect } from "vitest";
import {
  titleToSourceUrl,
  isDisambiguation,
  isJunk,
  isJunkPage,
  firstPage,
  actionPageToCard,
  relatedToCandidates,
  candidateToCard,
  selectCardBatch,
  isListLikeTitle,
  topicSearch,
  LIST_TITLE_PHRASES,
  isValidWikiTitle,
  type ActionPage,
} from "./wiki";

describe("titleToSourceUrl", () => {
  it("underscores spaces and encodes the title", () => {
    expect(titleToSourceUrl("Deep sea")).toBe(
      "https://en.wikipedia.org/wiki/Deep_sea",
    );
    expect(titleToSourceUrl("Café")).toContain("Caf%C3%A9");
  });
});

describe("isDisambiguation", () => {
  it("detects the disambiguation pageprop", () => {
    expect(isDisambiguation({ pageprops: { disambiguation: "" } })).toBe(true);
    expect(isDisambiguation({ pageprops: {} })).toBe(false);
    expect(isDisambiguation({})).toBe(false);
  });
});

describe("isJunk", () => {
  it("flags pages with no extract", () => {
    expect(isJunk({ title: "Octopus", extract: "" })).toBe(true);
    expect(isJunk({ title: "Octopus", extract: undefined })).toBe(true);
  });
  it("flags disambiguation pages", () => {
    expect(
      isJunk({ title: "Mercury", extract: "text", isDisambiguation: true }),
    ).toBe(true);
  });
  it('flags "List of …" titles', () => {
    expect(isJunk({ title: "List of octopus species", extract: "text" })).toBe(
      true,
    );
  });
  it("flags list/index/navigation hubs the discover feed surfaces", () => {
    expect(isJunk({ title: "Lists of lakes", extract: "text" })).toBe(true);
    expect(isJunk({ title: "Index of physics articles", extract: "text" })).toBe(true);
    expect(isJunk({ title: "Outline of chemistry", extract: "text" })).toBe(true);
    expect(isJunk({ title: "Timeline of the far future", extract: "text" })).toBe(true);
    expect(
      isJunk({
        title: "National Register of Historic Places listings in Arizona",
        extract: "text",
      }),
    ).toBe(true);
  });
  it("does not over-match legitimate titles", () => {
    // "listing" (singular) in a normal title stays allowed.
    expect(isJunk({ title: "Listed building", extract: "text" })).toBe(false);
    expect(isJunk({ title: "Indexing", extract: "text" })).toBe(false);
  });
  it('flags stray "may refer to" text', () => {
    expect(isJunk({ title: "Mercury", extract: "Mercury may refer to:" })).toBe(
      true,
    );
  });
  it("passes a normal article", () => {
    expect(
      isJunk({ title: "Octopus", extract: "An octopus is a mollusc." }),
    ).toBe(false);
  });
});

describe("isJunkPage", () => {
  it("combines extract + disambiguation + title checks", () => {
    expect(
      isJunkPage({
        title: "Mercury",
        extract: "t",
        pageprops: { disambiguation: "" },
      }),
    ).toBe(true);
    expect(isJunkPage({ title: "Octopus", extract: "" })).toBe(true);
    expect(isJunkPage({ title: "Octopus", extract: "real content" })).toBe(
      false,
    );
  });
});

describe("firstPage", () => {
  it("returns the first page or null", () => {
    expect(firstPage({ query: { pages: [{ title: "A" }] } })?.title).toBe("A");
    expect(firstPage({ query: { pages: [] } })).toBeNull();
    expect(firstPage(null)).toBeNull();
    expect(firstPage({})).toBeNull();
  });
});

describe("actionPageToCard", () => {
  const page: ActionPage = {
    title: "Octopus",
    description: "Soft-bodied eight-limbed mollusc",
    extract: "An octopus is a soft-bodied, eight-limbed mollusc.",
    thumbnail: {
      source: "https://upload.wikimedia.org/.../960px-Octopus2.jpg",
      width: 800,
      height: 609,
    },
    canonicalurl: "https://en.wikipedia.org/wiki/Octopus",
  };

  it("maps all fields and keeps the thumbnail URL as-is (no upscaling)", () => {
    const card = actionPageToCard(page);
    expect(card.pageTitle).toBe("Octopus");
    expect(card.displayTitle).toBe("Octopus");
    expect(card.description).toBe("Soft-bodied eight-limbed mollusc");
    expect(card.extract).toContain("octopus");
    expect(card.imageUrl).toBe(page.thumbnail!.source); // unchanged — valid URL
    expect(card.sourceUrl).toBe("https://en.wikipedia.org/wiki/Octopus");
  });

  it("synthesizes a source URL when canonicalurl is missing", () => {
    const card = actionPageToCard({ ...page, canonicalurl: undefined });
    expect(card.sourceUrl).toBe("https://en.wikipedia.org/wiki/Octopus");
  });

  it("tolerates an imageless page", () => {
    const card = actionPageToCard({ ...page, thumbnail: undefined });
    expect(card.imageUrl).toBeUndefined();
    expect(card.extract).not.toBe("");
  });
});

describe("relatedToCandidates", () => {
  const raw = {
    query: {
      pages: [
        {
          pageid: 2,
          title: "Cephalopod",
          index: 2,
          description: "Class of molluscs",
          extract: "A cephalopod is any member of the class.",
          thumbnail: { source: "https://x/960px-C.jpg" },
        },
        {
          pageid: 1,
          title: "Grimpoteuthis",
          index: 1,
          description: "Genus of cephalopods",
          extract: "Grimpoteuthis is a genus of octopus.",
          thumbnail: { source: "https://x/960px-G.jpg" },
        },
        {
          pageid: 3,
          title: "Mercury",
          index: 3,
          extract: "Mercury may refer to.",
          pageprops: { disambiguation: "" },
        },
      ],
    },
  };

  it("maps, sorts by relevance index, and drops disambiguation pages", () => {
    const cands = relatedToCandidates(raw);
    expect(cands).toHaveLength(2); // Mercury (disambiguation) removed
    expect(cands[0].pageTitle).toBe("Grimpoteuthis"); // index 1 first
    expect(cands[0].imageUrl).toBe("https://x/960px-G.jpg"); // as-is
    expect(cands[1].pageTitle).toBe("Cephalopod");
  });

  it("returns [] for malformed input", () => {
    expect(relatedToCandidates(null)).toEqual([]);
    expect(relatedToCandidates({})).toEqual([]);
    expect(relatedToCandidates({ query: { pages: "nope" } })).toEqual([]);
  });
});

describe("selectCardBatch", () => {
  const imaged = (t: string): ActionPage => ({
    title: t,
    extract: "A real sentence of content.",
    thumbnail: { source: `https://x/${t}.jpg` },
  });
  const imageless = (t: string): ActionPage => ({
    title: t,
    extract: "A real sentence of content.",
  });

  it("drops junk (no extract / disambiguation / List of)", () => {
    const cards = selectCardBatch([
      imaged("Good"),
      { title: "No extract", extract: "" },
      { title: "Mercury", extract: "t", pageprops: { disambiguation: "" } },
      { title: "List of things", extract: "t" },
    ]);
    expect(cards.map((c) => c.pageTitle)).toEqual(["Good"]);
  });

  it("puts imaged cards first", () => {
    const cards = selectCardBatch([
      imageless("Text1"),
      imaged("Pic1"),
      imageless("Text2"),
      imaged("Pic2"),
    ]);
    // Both imaged come before any imageless.
    expect(cards.slice(0, 2).map((c) => c.pageTitle).sort()).toEqual([
      "Pic1",
      "Pic2",
    ]);
    expect(cards.every((c) => c.pageTitle)).toBe(true);
  });

  it("caps imageless to ~25% of the returned set when imaged exist", () => {
    // 6 imaged → cap = floor(6 * 0.25 / 0.75) = 2 imageless allowed.
    const pages = [
      ...["a", "b", "c", "d", "e", "f"].map(imaged),
      ...["g", "h", "i", "j"].map(imageless),
    ];
    const cards = selectCardBatch(pages);
    const imagelessKept = cards.filter((c) => !c.imageUrl).length;
    expect(cards.filter((c) => c.imageUrl)).toHaveLength(6);
    expect(imagelessKept).toBe(2);
  });

  it("returns all imageless when the batch has no imaged pages", () => {
    const cards = selectCardBatch([imageless("A"), imageless("B")]);
    expect(cards.map((c) => c.pageTitle)).toEqual(["A", "B"]);
  });

  it("returns [] for an empty / all-junk batch", () => {
    expect(selectCardBatch([])).toEqual([]);
    expect(selectCardBatch([{ title: "X", extract: "" }])).toEqual([]);
  });

  // The bug behind "I picked a field and got 'couldn't load a card'": sorted by
  // incoming links, a topic's results hold long CONTIGUOUS runs of these
  // navigation hubs, so a whole window could be nothing else and the batch came
  // back empty. `topicSearch` now excludes them upstream; this pins what such a
  // window used to look like, so the two halves of the fix stay tied together.
  it("returns [] for a window that is all 'listings' hubs (the field-drift bug)", () => {
    const window = [
      "National Register of Historic Places listings in Dutchess County, New York",
      "National Register of Historic Places listings in Erie County, New York",
      "National Register of Historic Places listings in Buffalo, New York",
    ].map(imaged);
    expect(selectCardBatch(window)).toEqual([]);
    for (const p of window) expect(isListLikeTitle(p.title!)).toBe(true);
  });
});

describe("topicSearch", () => {
  it("searches the ORES topic", () => {
    expect(topicSearch("architecture")).toContain("articletopic:architecture");
  });

  it("excludes every list/index title phrase the junk filter would drop anyway", () => {
    const q = topicSearch("architecture");
    for (const phrase of LIST_TITLE_PHRASES) {
      expect(q, `excludes ${phrase}`).toContain(`-intitle:"${phrase}"`);
    }
  });

  // The exclusions exist to stop us paying for pages we then throw away, so each
  // one has to correspond to a title `isListLikeTitle` really does reject. If a
  // phrase here stopped matching a junk rule we would be narrowing the feed for
  // no reason at all.
  it("keeps every excluded phrase in step with isListLikeTitle", () => {
    for (const phrase of LIST_TITLE_PHRASES) {
      const title =
        phrase === "listings"
          ? "National Register of Historic Places listings in Ohio"
          : `${phrase[0].toUpperCase()}${phrase.slice(1)} rivers of Wales`;
      expect(isListLikeTitle(title), `${phrase} is junk`).toBe(true);
    }
  });
});

describe("candidateToCard", () => {
  it("synthesizes the source URL from the title", () => {
    const card = candidateToCard({
      pageTitle: "Deep sea",
      displayTitle: "Deep sea",
      description: "Lowest layer of the ocean",
      extract: "The deep sea is the lowest layer.",
      imageUrl: "https://x/960px-D.jpg",
    });
    expect(card.sourceUrl).toBe("https://en.wikipedia.org/wiki/Deep_sea");
    expect(card.imageUrl).toBe("https://x/960px-D.jpg");
    expect(card.extract).toContain("deep sea");
  });
});

// ---------------------------------------------------------------------------
// Title validity (pre-flyer review, finding 08).
//
// The `|` case is the reason this exists: the Action API separates up to 50
// titles with it, so a title carrying one silently became a LIST and the route
// answered with a page nobody asked for. Reproduced against a local instance on
// 27 August 2026: `?id=Main Page|Foo` returned a card for "Foobar".
// ---------------------------------------------------------------------------

describe("isValidWikiTitle", () => {
  it("refuses the separator that turns one title into fifty", () => {
    expect(isValidWikiTitle("Main Page|Foo")).toBe(false);
    expect(isValidWikiTitle("|")).toBe(false);
    expect(isValidWikiTitle("Octopus|")).toBe(false);
  });

  it("refuses the other characters MediaWiki forbids", () => {
    for (const bad of ["a#b", "a<b", "a>b", "a[b", "a]b", "a{b", "a}b"]) {
      expect(isValidWikiTitle(bad), bad).toBe(false);
    }
  });

  it("refuses control characters and the empty string", () => {
    expect(isValidWikiTitle("")).toBe(false);
    expect(isValidWikiTitle("   ")).toBe(false);
    expect(isValidWikiTitle("a\u0000b")).toBe(false);
    expect(isValidWikiTitle("a\nb")).toBe(false);
  });

  it("refuses a title longer than MediaWiki allows, counted in BYTES", () => {
    expect(isValidWikiTitle("a".repeat(255))).toBe(true);
    expect(isValidWikiTitle("a".repeat(256))).toBe(false);
    // Multi-byte characters count for what they weigh, not what they look like.
    expect(isValidWikiTitle("\u00e9".repeat(128))).toBe(false);
    expect(isValidWikiTitle("\u00e9".repeat(127))).toBe(true);
  });

  // The half that matters most: it must reject nothing a reader could reach.
  it("accepts the real titles the app actually asks for", () => {
    for (const good of [
      "Octopus",
      "Main Page",
      "Main_Page",
      "Foo (disambiguation)",
      "Saint-\u00c9tienne",
      "\u30a2\u30cb\u30e1",
      "C++",
      "R\u00e9sum\u00e9",
      "AT&T",
      "1,000,000",
      "Nineteen Eighty-Four",
      "M\u00fcnchen",
      "\u00c6thelred the Unready",
      "Q*bert",
      "50% (song)",
      'Say "Hello"',
      "Rock 'n' Roll",
      "A/B testing",
      "Category talk: not a namespace here, just a colon",
    ]) {
      expect(isValidWikiTitle(good), good).toBe(true);
    }
  });
});
