import { describe, it, expect } from "vitest";
import {
  realmOfSource,
  forwardEntities,
  passesReverseGate,
  trailRealms,
  DOORWAY_EYEBROW,
} from "./crossrealm";
import type { Trail, TrailStep } from "./types";

function stepWith(source: "wikipedia" | "artic" | undefined): TrailStep {
  return {
    card: { pageTitle: "x", displayTitle: "x", extract: "", sourceUrl: "", source },
    arrivedVia: { type: "drift" },
    timestamp: 0,
    expanded: false,
  };
}
function trailOf(...sources: ("wikipedia" | "artic" | undefined)[]): Trail {
  return { id: "t", name: "t", steps: sources.map(stepWith), createdAt: 0, liked: false };
}

describe("trailRealms", () => {
  it("lists the distinct realms a trail spans, in order", () => {
    expect(trailRealms(trailOf("wikipedia", "wikipedia"))).toEqual(["encyclopedia"]);
    expect(trailRealms(trailOf("artic", "artic"))).toEqual(["gallery"]);
    // a mixed trail (a crossing) lists both, first-visited first
    expect(trailRealms(trailOf("wikipedia", "artic", "artic"))).toEqual([
      "encyclopedia",
      "gallery",
    ]);
    expect(trailRealms(trailOf("artic", "wikipedia"))).toEqual(["gallery", "encyclopedia"]);
    // legacy cards (no source) default to encyclopedia
    expect(trailRealms(trailOf(undefined))).toEqual(["encyclopedia"]);
  });
});

describe("realmOfSource", () => {
  it("maps a source to its realm, defaulting to encyclopedia", () => {
    expect(realmOfSource("wikipedia")).toBe("encyclopedia");
    expect(realmOfSource("artic")).toBe("gallery");
    expect(realmOfSource("gutenberg")).toBe("library");
    expect(realmOfSource(undefined)).toBe("encyclopedia");
    expect(realmOfSource(null)).toBe("encyclopedia");
  });
});

describe("forwardEntities (Gallery → Encyclopedia)", () => {
  it("returns artist, movement, place in order, skipping empties", () => {
    expect(
      forwardEntities({
        artist_title: "Claude Monet",
        style_title: "Impressionism",
        place_of_origin: "France",
      }),
    ).toEqual(["Claude Monet", "Impressionism", "France"]);
    expect(
      forwardEntities({ artist_title: "", style_title: "Ukiyo-e" }),
    ).toEqual(["Ukiyo-e"]);
    expect(forwardEntities({})).toEqual([]);
  });
});

describe("passesReverseGate (Encyclopedia → Gallery)", () => {
  const gate = passesReverseGate;

  it("passes when the term appears in the top result's title", () => {
    expect(gate("Octopus", { title: "Octopus and Shell", _score: 22 })).toBe(true);
    expect(gate("Samurai", { title: "Samurai", _score: 78 })).toBe(true);
    // multi-word term present in the full title
    expect(
      gate("Mount Fuji", {
        title:
          "Under the Wave off Kanagawa, from Thirty-Six Views of Mount Fuji",
        _score: 2744,
      }),
    ).toBe(true);
  });

  it("passes on a subject-tag (stem) match", () => {
    expect(
      gate("Cat", { title: "Border Fragments", term_titles: ["cats", "animals"], _score: 56 }),
    ).toBe(true);
  });

  it("rejects abstract / unrelated tops (term not in title or tags)", () => {
    expect(
      gate("Quantum mechanics", {
        title: "The Bewitched Mill",
        term_titles: ["oil on canvas", "painting"],
        _score: 69,
      }),
    ).toBe(false);
    expect(
      gate("Napoleon", { title: "Cinderella", term_titles: ["etching", "print"], _score: 83 }),
    ).toBe(false);
  });

  it("rejects a weak-score match as a backstop", () => {
    expect(gate("Cat", { title: "Cat on a Cushion", _score: 3 })).toBe(false);
  });

  it("rejects empty input", () => {
    expect(gate("", { title: "Anything", _score: 100 })).toBe(false);
  });
});

describe("DOORWAY_EYEBROW", () => {
  it("names the destination realm", () => {
    expect(DOORWAY_EYEBROW.encyclopedia).toBe("In the Encyclopedia");
    expect(DOORWAY_EYEBROW.gallery).toBe("In the Gallery");
  });
});
