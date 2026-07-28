import { describe, it, expect } from "vitest";
import { licenseFor, CC_BY_SA_4, CC0_1 } from "./licenses";
import { CARD_PROPS } from "./wiki-server";

// These are compliance guards, not style tests. Each one pins something Drift
// promises Wikipedia (or the Art Institute) it will do; if a future change breaks
// one, the reason it existed is in the failure message.

describe("content licences", () => {
  it("labels Wikipedia text CC BY-SA 4.0, the licence the Terms of Use name", () => {
    expect(licenseFor("wikipedia")).toEqual(CC_BY_SA_4);
    expect(CC_BY_SA_4.label).toBe("CC BY-SA 4.0");
  });

  it("treats a card with no source as Wikipedia (older saved trails omit it)", () => {
    expect(licenseFor(undefined)).toEqual(CC_BY_SA_4);
  });

  it("labels Art Institute works CC0", () => {
    expect(licenseFor("artic")).toEqual(CC0_1);
  });

  it("claims nothing for sources Drift cannot label precisely", () => {
    // arXiv abstracts are not ours to license; the card links to the paper.
    expect(licenseFor("arxiv")).toBeNull();
  });

  // The notice must reach the licence TEXT, not merely name it: "a licensing
  // notice stating which license the work is released under, along with either a
  // hyperlink or URL to the text of the license" (WMF Terms of Use §7).
  it("links the licence text itself", () => {
    for (const l of [CC_BY_SA_4, CC0_1]) {
      expect(l.url).toMatch(/^https:\/\/creativecommons\.org\//);
    }
  });
});

describe("page images stay free-licensed", () => {
  // Fair-use files on Wikipedia are "not under the CC BY-SA or GFDL license as
  // such" (WP:Copyrights), so Drift must never show one. `prop=pageimages`
  // defaults to the free image, but a default is not a guarantee: pin it.
  it("asks pageimages for free-licensed images explicitly", () => {
    expect(CARD_PROPS.pilicense).toBe("free");
  });
});
