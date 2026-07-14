import { describe, it, expect } from "vitest";
import {
  articImageUrl,
  articPageUrl,
  articToCard,
  articToCandidate,
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

  it("maps a faceted candidate carrying its label + facet", () => {
    const cand = articToCandidate(monet, "More by Claude Monet", "artist:35809");
    expect(cand.threadLabel).toBe("More by Claude Monet");
    expect(cand.facet).toBe("artist:35809");
    expect(cand.source).toBe("artic");
  });

  it("rejects non-public-domain / imageless / untitled artworks", () => {
    expect(isUsableArtwork(monet)).toBe(true);
    expect(isUsableArtwork({ ...monet, is_public_domain: false })).toBe(false);
    expect(isUsableArtwork({ ...monet, image_id: null })).toBe(false);
    expect(isUsableArtwork({ ...monet, title: "" })).toBe(false);
  });
});

describe("artic buckets", () => {
  it("resolves a known bucket and rejects unknown", () => {
    expect(articBucketById("impressionism")?.label).toBe("Impressionism");
    expect(articBucketById("not-a-bucket")).toBeUndefined();
    expect(ARTIC_BUCKETS.length).toBeGreaterThanOrEqual(8);
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
});
