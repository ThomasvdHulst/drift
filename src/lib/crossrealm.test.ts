import { describe, it, expect } from "vitest";
import {
  realmOfSource,
  forwardEntities,
  passesReverseGate,
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

describe("passesReverseGate (Encyclopedia → Gallery)", () => {
  const gate = passesReverseGate;

  // Every case below was re-verified against The Met's live search when the
  // score clause was dropped (Phase 31B): the four concrete subjects open a
  // doorway and the three abstract ones stay silent, without any score.
  it("passes when the term appears in the top result's title", () => {
    expect(gate("Octopus", { title: "Terracotta stirrup jar with octopus" })).toBe(true);
    expect(gate("Samurai", { title: "Two Young Samurai" })).toBe(true);
    // multi-word term present in the full title
    expect(
      gate("Mount Fuji", { title: "Dish in shape of Mount Fuji with horse" }),
    ).toBe(true);
  });

  it("passes on a subject-tag (stem) match", () => {
    expect(gate("Cat", { title: "Border Fragments", term_titles: ["cats", "animals"] })).toBe(true);
    expect(gate("Octopus", { title: "Stirrup jar", term_titles: ["fish", "octopus"] })).toBe(true);
  });

  it("rejects abstract / unrelated tops (term not in title or tags)", () => {
    expect(
      gate("Quantum mechanics", {
        title: "The Bewitched Mill",
        term_titles: ["oil on canvas", "painting"],
      }),
    ).toBe(false);
    expect(gate("Inflation", { title: "Jar", term_titles: [] })).toBe(false);
    expect(gate("Napoleon", { title: "Cinderella", term_titles: ["etching", "print"] })).toBe(false);
  });

  // The Art Institute's relevance score used to add a floor here. The Met returns
  // no score, so the term-in-title-or-tags rule stands alone — and it should: a
  // work whose TITLE is the article's subject is a good doorway however the
  // upstream happened to rank it.
  it("passes a title match that the old score floor would have refused", () => {
    expect(gate("Cat", { title: "Cat on a Cushion" })).toBe(true);
  });

  it("rejects empty input", () => {
    expect(gate("", { title: "Anything" })).toBe(false);
  });
});

describe("DOORWAY_EYEBROW", () => {
  it("names the destination realm", () => {
    expect(DOORWAY_EYEBROW.encyclopedia).toBe("In the Encyclopedia");
    expect(DOORWAY_EYEBROW.gallery).toBe("In the Gallery");
  });
});
