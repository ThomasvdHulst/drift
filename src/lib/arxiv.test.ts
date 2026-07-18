import { describe, it, expect } from "vitest";
import {
  parseArxivAtom,
  isUsableEntry,
  arxivToCard,
  arxivToCandidate,
  paperCover,
  type ArxivEntry,
} from "./realms/arxiv";
import {
  arxivBucketById,
  categoryGroupOf,
  FIELD_STYLES,
} from "./realms/arxiv.categories";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <title>ArXiv Query</title>
  <entry>
    <id>http://arxiv.org/abs/2401.01234v2</id>
    <published>2024-01-02T18:30:00Z</published>
    <title>Deep Learning for
  Galaxies &amp; Quasars</title>
    <summary>  We present a method
for classifying galaxies. It works &lt;well&gt;.  </summary>
    <author><name>Jane A. Doe</name></author>
    <author><name>John Q. Smith</name></author>
    <author><name>Rui Zhang</name></author>
    <author><name>Ada Lovelace</name></author>
    <arxiv:primary_category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
    <category term="astro-ph.GA" scheme="http://arxiv.org/schemas/atom"/>
    <link href="http://arxiv.org/abs/2401.01234v2" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/2401.01234v2" rel="related" type="application/pdf"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/hep-th/9901001v1</id>
    <published>1999-01-01T00:00:00Z</published>
    <title>An Old Style Identifier Paper</title>
    <summary>Classic preprint.</summary>
    <author><name>Edward Witten</name></author>
    <arxiv:primary_category term="hep-th" scheme="http://arxiv.org/schemas/atom"/>
    <category term="hep-th" scheme="http://arxiv.org/schemas/atom"/>
    <link href="http://arxiv.org/abs/hep-th/9901001v1" rel="alternate" type="text/html"/>
  </entry>
</feed>`;

describe("parseArxivAtom", () => {
  const entries = parseArxivAtom(FEED);

  it("extracts each entry", () => {
    expect(entries).toHaveLength(2);
  });

  it("decodes + collapses the title and abstract", () => {
    expect(entries[0].title).toBe("Deep Learning for Galaxies & Quasars");
    expect(entries[0].summary).toBe(
      "We present a method for classifying galaxies. It works <well>.",
    );
  });

  it("collects all authors", () => {
    expect(entries[0].authors).toEqual([
      "Jane A. Doe",
      "John Q. Smith",
      "Rui Zhang",
      "Ada Lovelace",
    ]);
  });

  it("reads the primary + all categories", () => {
    expect(entries[0].primaryCategory).toBe("cs.LG");
    expect(entries[0].categories).toEqual(["cs.LG", "astro-ph.GA"]);
  });

  it("derives bare + versioned ids and https links (modern id)", () => {
    expect(entries[0].id).toBe("2401.01234");
    expect(entries[0].idVersioned).toBe("2401.01234v2");
    expect(entries[0].absUrl).toBe("https://arxiv.org/abs/2401.01234v2");
    expect(entries[0].pdfUrl).toBe("https://arxiv.org/pdf/2401.01234v2");
  });

  it("handles old-style slash ids and derives a pdf url when absent", () => {
    expect(entries[1].id).toBe("hep-th/9901001");
    expect(entries[1].idVersioned).toBe("hep-th/9901001v1");
    expect(entries[1].pdfUrl).toBe("https://arxiv.org/pdf/hep-th/9901001v1");
  });

  it("returns [] for a feed with no entries", () => {
    expect(parseArxivAtom("<feed></feed>")).toEqual([]);
  });

  it("strips inline LaTeX from the title + abstract (detex-lite)", () => {
    const feed = `<feed><entry>
      <id>http://arxiv.org/abs/2501.00001v1</id>
      <title>On $N$ machines and \\textit{block} policies</title>
      <summary>We study $k^*$ with $k \\in \\{1, \\ldots, K\\}$ and \\emph{noise}.</summary>
      <author><name>A B</name></author>
      <category term="stat.ME"/>
      <link href="http://arxiv.org/abs/2501.00001v1" rel="alternate"/>
    </entry></feed>`;
    const [e] = parseArxivAtom(feed);
    expect(e.title).toBe("On N machines and block policies");
    expect(e.summary).toBe("We study k^* with k \\in {1, …, K} and noise.");
  });
});

describe("isUsableEntry", () => {
  const base: ArxivEntry = {
    id: "2401.01234",
    idVersioned: "2401.01234v1",
    title: "A Title",
    summary: "An abstract.",
    authors: ["A"],
    categories: ["cs.LG"],
    absUrl: "https://arxiv.org/abs/2401.01234v1",
    pdfUrl: "https://arxiv.org/pdf/2401.01234v1",
  };

  it("accepts a complete entry", () => {
    expect(isUsableEntry(base)).toBe(true);
  });

  it("drops an arXiv error entry", () => {
    expect(isUsableEntry({ ...base, id: "http://arxiv.org/api/errors#foo" })).toBe(false);
  });

  it("drops entries missing a title or abstract", () => {
    expect(isUsableEntry({ ...base, title: "  " })).toBe(false);
    expect(isUsableEntry({ ...base, summary: "" })).toBe(false);
    expect(isUsableEntry(null)).toBe(false);
  });
});

describe("arxivToCard", () => {
  const card = arxivToCard(parseArxivAtom(FEED)[0]);

  it("maps to an arxiv-sourced card with the abstract as the extract", () => {
    expect(card.source).toBe("arxiv");
    expect(card.pageTitle).toBe("2401.01234");
    expect(card.extract).toContain("classifying galaxies");
    expect(card.sourceUrl).toBe("https://arxiv.org/abs/2401.01234v2");
    expect(card.imageUrl).toBeUndefined();
  });

  it("builds a truncated author + year description", () => {
    expect(card.description).toBe("Jane A. Doe, John Q. Smith, Rui Zhang, et al. · 2024");
  });

  it("includes museum-label facts with an honest preprint status", () => {
    const facts = Object.fromEntries((card.facts ?? []).map((f) => [f.label, f.value]));
    expect(facts.Field).toBe("Computer Science");
    expect(facts.Categories).toBe("cs.LG, astro-ph.GA");
    expect(facts.Status).toContain("not peer reviewed");
  });

  it("carries a field-themed cover", () => {
    expect(card.cover?.hue).toBe(FIELD_STYLES.cs.hue);
    expect(card.cover?.motif).toBe("graph");
    expect(typeof card.cover?.seed).toBe("number");
  });
});

describe("arxivToCandidate", () => {
  it("keeps facet metadata + the cover so a pulled thread lands on a full card", () => {
    const c = arxivToCandidate(parseArxivAtom(FEED)[0], "More by", "author:Doe", "More by");
    expect(c.source).toBe("arxiv");
    expect(c.threadLabel).toBe("More by");
    expect(c.facet).toBe("author:Doe");
    expect(c.eyebrow).toBe("More by");
    expect(c.cover?.motif).toBe("graph");
    expect(c.facts?.length).toBeGreaterThan(0);
  });
});

describe("paperCover", () => {
  it("is deterministic for the same id", () => {
    expect(paperCover("cs", "2401.01234")).toEqual(paperCover("cs", "2401.01234"));
  });

  it("differs across ids (seed) and uses the group's hue + motif", () => {
    expect(paperCover("physics", "a").seed).not.toBe(paperCover("physics", "b").seed);
    expect(paperCover("physics", "a").hue).toBe(FIELD_STYLES.physics.hue);
    expect(paperCover("physics", "a").motif).toBe("orbits");
  });
});

describe("categoryGroupOf", () => {
  it.each([
    ["cs.LG", "cs"],
    ["astro-ph.GA", "physics"],
    ["hep-th", "physics"],
    ["math.NT", "math"],
    ["math-ph", "physics"],
    ["q-bio.PE", "bio"],
    ["stat.ME", "stats"],
    ["econ.GN", "econ"],
    ["eess.SP", "eess"],
    ["q-fin.MF", "qfin"],
    ["totally.unknown", "other"],
    [undefined, "other"],
  ])("maps %s → %s", (cat, group) => {
    expect(categoryGroupOf(cat as string | undefined)).toBe(group);
  });
});

describe("arxivBucketById (injection guard)", () => {
  it("resolves a known bucket", () => {
    expect(arxivBucketById("ml")?.query).toBe("cat:cs.LG");
  });

  it("rejects unknown / injection strings", () => {
    expect(arxivBucketById("cat:cs.LG); DROP TABLE")).toBeUndefined();
    expect(arxivBucketById("")).toBeUndefined();
  });
});
