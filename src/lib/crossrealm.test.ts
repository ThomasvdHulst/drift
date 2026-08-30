import { describe, it, expect } from "vitest";
import {
  realmOfSource,
  forwardEntities,
  trailRealms,
  DOORWAY_EYEBROW,
} from "./crossrealm";
import type { Trail, TrailStep } from "./types";

function stepWith(source: "wikipedia" | "met" | undefined): TrailStep {
  return {
    card: { pageTitle: "x", displayTitle: "x", extract: "", sourceUrl: "", source },
    arrivedVia: { type: "drift" },
    timestamp: 0,
    expanded: false,
  };
}
function trailOf(...sources: ("wikipedia" | "met" | undefined)[]): Trail {
  return { id: "t", name: "t", steps: sources.map(stepWith), createdAt: 0, liked: false };
}

describe("trailRealms", () => {
  it("lists the distinct realms a trail spans, in order", () => {
    expect(trailRealms(trailOf("wikipedia", "wikipedia"))).toEqual(["encyclopedia"]);
    expect(trailRealms(trailOf("met", "met"))).toEqual(["gallery"]);
    // a mixed trail (a crossing) lists both, first-visited first
    expect(trailRealms(trailOf("wikipedia", "met", "met"))).toEqual([
      "encyclopedia",
      "gallery",
    ]);
    expect(trailRealms(trailOf("met", "wikipedia"))).toEqual(["gallery", "encyclopedia"]);
    // legacy cards (no source) default to encyclopedia
    expect(trailRealms(trailOf(undefined))).toEqual(["encyclopedia"]);
  });
});

describe("realmOfSource", () => {
  it("maps a source to its realm, defaulting to encyclopedia", () => {
    expect(realmOfSource("wikipedia")).toBe("encyclopedia");
    expect(realmOfSource("met")).toBe("gallery");
    expect(realmOfSource("gutenberg")).toBe("library");
    expect(realmOfSource(undefined)).toBe("encyclopedia");
    expect(realmOfSource(null)).toBe("encyclopedia");
  });
});

describe("forwardEntities (Gallery → Encyclopedia)", () => {
  it("returns artist, movement, place in order, skipping empties", () => {
    expect(
      forwardEntities({
        artist: "Claude Monet",
        movement: "Impressionism",
        place: "France",
      }),
    ).toEqual(["Claude Monet", "Impressionism", "France"]);
    expect(
      forwardEntities({ artist: "", movement: "Ukiyo-e" }),
    ).toEqual(["Ukiyo-e"]);
    expect(forwardEntities({})).toEqual([]);
  });
});

describe("DOORWAY_EYEBROW", () => {
  it("names the destination realm", () => {
    expect(DOORWAY_EYEBROW.encyclopedia).toBe("In the Encyclopedia");
    expect(DOORWAY_EYEBROW.gallery).toBe("In the Gallery");
  });
});
