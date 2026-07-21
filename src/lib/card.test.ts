import { describe, it, expect } from "vitest";
import {
  cardSource,
  nativeId,
  toCardId,
  cardId,
  normalizeSeenEntry,
} from "./card";
import { SOURCE_IDS } from "./realms/types";
import type { Card } from "./types";

function card(partial: Partial<Card>): Card {
  return {
    pageTitle: "X",
    displayTitle: "X",
    extract: "",
    sourceUrl: "",
    ...partial,
  };
}

describe("card identity", () => {
  it("defaults a missing source to wikipedia", () => {
    expect(cardSource(card({ pageTitle: "Octopus" }))).toBe("wikipedia");
    expect(cardId(card({ pageTitle: "Octopus" }))).toBe("wikipedia:Octopus");
  });

  it("namespaces non-wikipedia cards by source", () => {
    expect(cardId(card({ pageTitle: "16568", source: "artic" }))).toBe(
      "artic:16568",
    );
    expect(cardId(card({ pageTitle: "1400", source: "gutenberg" }))).toBe(
      "gutenberg:1400",
    );
  });

  it("nativeId returns the source-native key", () => {
    expect(nativeId(card({ pageTitle: "Water Lilies" }))).toBe("Water Lilies");
  });

  it("toCardId joins parts", () => {
    expect(toCardId("artic", "27992")).toBe("artic:27992");
  });
});

describe("normalizeSeenEntry (legacy migration)", () => {
  it("prefixes a bare Wikipedia title", () => {
    expect(normalizeSeenEntry("Octopus")).toBe("wikipedia:Octopus");
  });

  it("leaves an already-namespaced entry untouched", () => {
    expect(normalizeSeenEntry("wikipedia:Octopus")).toBe("wikipedia:Octopus");
    expect(normalizeSeenEntry("artic:16568")).toBe("artic:16568");
    expect(normalizeSeenEntry("gutenberg:1400")).toBe("gutenberg:1400");
  });

  it("does not mangle a title that merely contains a colon", () => {
    // "Blade Runner" is not a known source prefix → treated as a Wikipedia title.
    expect(normalizeSeenEntry("Blade Runner: The Final Cut")).toBe(
      "wikipedia:Blade Runner: The Final Cut",
    );
  });

  // Regression guard: a source missing from card.ts's allowlist silently turns
  // every one of its cardIds into "wikipedia:<source>:<id>" on read, which breaks
  // that realm's seen-set and reaction map after a reload. Deriving both from
  // SOURCE_IDS makes this impossible; this test keeps it that way.
  it("round-trips a cardId from EVERY known source", () => {
    for (const source of SOURCE_IDS) {
      const id = toCardId(source, "some-native-id");
      expect(normalizeSeenEntry(id)).toBe(id);
    }
  });
});
