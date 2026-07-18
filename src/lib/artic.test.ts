import { describe, it, expect } from "vitest";
import {
  articImageUrl,
  articPageUrl,
  articToCard,
  articToCandidate,
  artFacts,
  isUsableArtwork,
  type ArticArtwork,
} from "./realms/artic";
import { selectFacetThreads } from "./diversity";
import { articBucketById, ARTIC_BUCKETS } from "./realms/artic.buckets";

const monet: ArticArtwork = {
  id: 16568,
  title: "Water Lilies",
  artist_title: "Claude Monet",
  artist_id: 35809,
  date_display: "1906",
  medium_display: "Oil on canvas",
  place_of_origin: "France",
  style_title: "Impressionism",
  image_id: "3c27b499-af56-f0d5-93b5-a7f2f1ad5813",
  is_public_domain: true,
};

describe("artic mappers", () => {
  it("builds an IIIF image url", () => {
    expect(articImageUrl("abc")).toBe(
      "https://www.artic.edu/iiif/2/abc/full/843,/0/default.jpg",
    );
    expect(articImageUrl(null)).toBeUndefined();
  });

  it("builds the artwork page url", () => {
    expect(articPageUrl(16568)).toBe("https://www.artic.edu/artworks/16568");
  });

  it("maps an artwork to a Card (pageTitle = id, source = artic)", () => {
    const c = articToCard(monet);
    expect(c.pageTitle).toBe("16568");
    expect(c.displayTitle).toBe("Water Lilies");
    expect(c.source).toBe("artic");
    expect(c.description).toBe("Claude Monet · 1906");
    expect(c.extract).toBe("Oil on canvas · France");
    expect(c.imageUrl).toContain("3c27b499");
    expect(c.sourceUrl).toBe("https://www.artic.edu/artworks/16568");
  });

  it("maps a faceted candidate carrying its label + facet + eyebrow + rich fields", () => {
    const cand = articToCandidate(monet, "Claude Monet", "artist:35809", "More by");
    expect(cand.threadLabel).toBe("Claude Monet");
    expect(cand.facet).toBe("artist:35809");
    expect(cand.eyebrow).toBe("More by");
    expect(cand.source).toBe("artic");
    // Rich fields ride along so pulling the thread lands on a full art card.
    expect(cand.zoomUrl).toContain("/full/1686,/");
    expect(cand.facts?.length).toBeGreaterThan(0);
  });

  it("rejects non-public-domain / imageless / untitled artworks", () => {
    expect(isUsableArtwork(monet)).toBe(true);
    expect(isUsableArtwork({ ...monet, is_public_domain: false })).toBe(false);
    expect(isUsableArtwork({ ...monet, image_id: null })).toBe(false);
    expect(isUsableArtwork({ ...monet, title: "" })).toBe(false);
  });
});

describe("artFacts (museum label)", () => {
  const wave: ArticArtwork = {
    id: 77333,
    title: "The Great Wave",
    artist_title: "Katsushika Hokusai",
    date_display: "1830/33",
    medium_display: "Color woodblock print",
    dimensions: "25.4 × 37.6 cm",
    credit_line: "Clarence Buckingham Collection",
    place_of_origin: "Japan",
    classification_title: "woodblock print",
    department_title: "Arts of Asia",
    subject_titles: ["water", "waves"],
    image_id: "abc",
    is_public_domain: true,
    thumbnail: { lqip: "data:image/gif;base64,ZZZ", alt_text: "A woodblock print of a wave." },
  };

  it("builds ordered label rows, skipping empties", () => {
    const rows = artFacts(wave);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(byLabel.Medium).toBe("Color woodblock print");
    expect(byLabel.Dimensions).toBe("25.4 × 37.6 cm");
    expect(byLabel.Classification).toBe("woodblock print");
    expect(byLabel.Department).toBe("Arts of Asia");
    expect(byLabel.Origin).toBe("Japan");
    expect(byLabel.Subjects).toBe("water, waves");
    expect(byLabel.Credit).toBe("Clarence Buckingham Collection");
    // Medium leads, Credit trails (reading order).
    expect(rows[0].label).toBe("Medium");
    expect(rows[rows.length - 1].label).toBe("Credit");
  });

  it("returns no rows when nothing is present", () => {
    expect(artFacts({ id: 1, is_public_domain: true, image_id: "x" })).toEqual([]);
  });

  it("surfaces facts + zoom + blur + alt on the Card", () => {
    const c = articToCard(wave);
    expect(c.facts?.length).toBeGreaterThan(0);
    expect(c.zoomUrl).toBe("https://www.artic.edu/iiif/2/abc/full/1686,/0/default.jpg");
    expect(c.blurDataUrl).toBe("data:image/gif;base64,ZZZ");
    expect(c.imageAlt).toBe("A woodblock print of a wave.");
  });

  it("omits the optional Card fields when the source lacks them", () => {
    const c = articToCard(monet); // no thumbnail / dimensions / credit
    expect(c.blurDataUrl).toBeUndefined();
    expect(c.imageAlt).toBeUndefined();
    expect(c.zoomUrl).toBeDefined(); // has an image_id
  });
});

describe("artic buckets", () => {
  it("resolves a known bucket and rejects unknown", () => {
    expect(articBucketById("impressionism")?.label).toBe("Impressionism");
    expect(articBucketById("not-a-bucket")).toBeUndefined();
    expect(ARTIC_BUCKETS.length).toBeGreaterThanOrEqual(8);
  });

  it("structured-filter buckets name a valid field + keep a full-text fallback", () => {
    const allowed = new Set([
      "style_title",
      "classification_title",
      "subject_titles",
      "department_title",
    ]);
    const filtered = ARTIC_BUCKETS.filter((b) => b.filter);
    expect(filtered.length).toBeGreaterThan(0);
    for (const b of filtered) {
      expect(allowed.has(b.filter!.field)).toBe(true);
      expect(b.filter!.value.length).toBeGreaterThan(0);
      expect(b.q.length).toBeGreaterThan(0); // full-text fallback always present
    }
    // Impressionism uses the movement field; some buckets stay full-text-only.
    expect(articBucketById("impressionism")?.filter?.field).toBe("style_title");
    expect(articBucketById("ukiyo-e")?.filter).toBeUndefined();
  });
});

describe("selectFacetThreads", () => {
  const cand = (id: string, label: string, facet: string): {
    pageTitle: string;
    displayTitle: string;
    source: "artic";
    threadLabel: string;
    facet: string;
  } => ({ pageTitle: id, displayTitle: label, source: "artic", threadLabel: label, facet });

  it("takes one per distinct facet and uses the candidate's threadLabel", () => {
    const threads = selectFacetThreads([
      cand("1", "More by Monet", "artist:1"),
      cand("2", "More by Monet", "artist:1"),
      cand("3", "Other Impressionism", "style:imp"),
      cand("4", "Also from France", "place:fr"),
    ]);
    expect(threads).toHaveLength(3);
    expect(threads.map((t) => t.label)).toEqual([
      "More by Monet",
      "Other Impressionism",
      "Also from France",
    ]);
  });

  it("drops seen candidates (by cardId)", () => {
    const threads = selectFacetThreads(
      [cand("1", "A", "f1"), cand("2", "B", "f2")],
      { seen: new Set(["artic:1"]) },
    );
    expect(threads.map((t) => t.candidate.pageTitle)).toEqual(["2"]);
  });

  it("carries the eyebrow through to the thread", () => {
    const threads = selectFacetThreads([
      {
        pageTitle: "1",
        displayTitle: "Water Lilies",
        source: "artic",
        threadLabel: "Claude Monet",
        facet: "artist:1",
        eyebrow: "More by",
      },
    ]);
    expect(threads[0].label).toBe("Claude Monet");
    expect(threads[0].eyebrow).toBe("More by");
  });
});
