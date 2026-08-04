import { describe, it, expect } from "vitest";
import { commonPages, isMeaningful, stopsToProbe } from "./common";
import { DOOR_DWELL_MS } from "./doors";
import type { TrailStep } from "./types";

// Every filter here earned its place against real link data (see the Phase 28
// entry in plan.md): the first honest run of this returned "Bibcode
// (identifier)" at 4/4, which is a fact about how physicists cite, not about
// what the reader was reading.

describe("isMeaningful", () => {
  it("rejects citation infrastructure", () => {
    for (const junk of [
      "Bibcode (identifier)",
      "ISSN (identifier)",
      "S2CID (identifier)",
      "Doi (identifier)",
      "PMID (identifier)",
      "Wayback Machine",
      "Internet Archive",
    ]) {
      expect(isMeaningful(junk), junk).toBe(false);
    }
  });

  it("rejects a page too big to mean anything about one trail", () => {
    expect(isMeaningful("United States")).toBe(false);
    expect(isMeaningful("World War II")).toBe(false);
    expect(isMeaningful("Latin")).toBe(false);
  });

  it("rejects dates, namespaces and the list pages the feed already refuses", () => {
    expect(isMeaningful("1815")).toBe(false);
    expect(isMeaningful("19th century")).toBe(false);
    expect(isMeaningful("Category:Physics")).toBe(false);
    expect(isMeaningful("List of black holes")).toBe(false);
    expect(isMeaningful("")).toBe(false);
  });

  it("keeps the answers worth having", () => {
    for (const good of [
      "General relativity",
      "Form follows function",
      "Yarn",
      "Spacetime",
      "Sericulture",
    ]) {
      expect(isMeaningful(good), good).toBe(true);
    }
  });
});

describe("commonPages", () => {
  // The measured example, verbatim from the probe that justified this feature.
  const links = {
    "Black hole": ["General relativity", "Spacetime", "Bibcode (identifier)", "Star"],
    "Time dilation": ["General relativity", "Spacetime", "Bibcode (identifier)"],
    "Global Positioning System": [
      "General relativity",
      "Bibcode (identifier)",
      "United States",
    ],
  };

  it("finds the page they all point at, and names the stops that do", () => {
    const [best] = commonPages(links);
    expect(best.title).toBe("General relativity");
    expect(best.from).toEqual([
      "Black hole",
      "Time dilation",
      "Global Positioning System",
    ]);
  });

  it("never offers a page the reader already opened", () => {
    const out = commonPages(links, { visited: ["General relativity"] });
    expect(out.map((p) => p.title)).not.toContain("General relativity");
  });

  it("needs several stops to agree, not two", () => {
    expect(
      commonPages({ A: ["Shared"], B: ["Shared"] }).map((p) => p.title),
    ).toEqual([]);
    expect(
      commonPages({ A: ["Shared"], B: ["Shared"], C: ["Shared"] })[0].title,
    ).toBe("Shared");
  });

  it("counts a stop once, however many times it links there", () => {
    const out = commonPages({
      A: ["Yarn", "Yarn", "Yarn"],
      B: ["Silk"],
      C: ["Silk"],
    });
    expect(out).toEqual([]);
  });

  it("prefers wider agreement, then a page some lead thought worth naming", () => {
    const ranked = commonPages(
      {
        A: ["Everywhere", "Named", "Unnamed"],
        B: ["Everywhere", "Named", "Unnamed"],
        C: ["Everywhere", "Named", "Unnamed"],
        D: ["Everywhere"],
      },
      { lead: ["Named"], max: 3 },
    );
    expect(ranked[0].title).toBe("Everywhere"); // 4 stops beats 3
    expect(ranked[1].title).toBe("Named"); // then the one an article introduced
  });

  it("says nothing rather than something weak", () => {
    expect(commonPages({})).toEqual([]);
    expect(commonPages({ A: ["Bibcode (identifier)"], B: ["Bibcode (identifier)"], C: ["Bibcode (identifier)"] })).toEqual([]);
  });
});

describe("stopsToProbe", () => {
  const step = (
    title: string,
    extra: Partial<TrailStep> = {},
    source?: "artic",
  ): TrailStep => ({
    card: {
      pageTitle: title,
      displayTitle: title,
      extract: "x",
      sourceUrl: "",
      ...(source ? { source } : {}),
    },
    arrivedVia: { type: "drift" },
    timestamp: 0,
    expanded: false,
    ...extra,
  });

  it("asks about the stops you actually read", () => {
    const steps = [
      step("Glanced at"),
      step("Read", { expanded: true }),
      step("Stayed with", { dwellMs: DOOR_DWELL_MS }),
      step("Left a door", { doorsLeft: [{ pageTitle: "X", displayTitle: "X" }] }),
    ];
    expect(stopsToProbe(steps)).toEqual(["Read", "Stayed with", "Left a door"]);
  });

  it("falls back to the whole trail when nothing was read for long", () => {
    const steps = [step("A"), step("B"), step("C")];
    expect(stopsToProbe(steps)).toEqual(["A", "B", "C"]);
  });

  it("leaves out artworks, which have no article links", () => {
    const steps = [step("A"), step("129884", {}, "artic"), step("C")];
    expect(stopsToProbe(steps)).toEqual(["A", "C"]);
  });

  it("keeps the most recent when a long trail is trimmed", () => {
    const steps = Array.from({ length: 12 }, (_, i) => step(`S${i}`));
    const probe = stopsToProbe(steps, 4);
    expect(probe).toEqual(["S8", "S9", "S10", "S11"]);
  });
});
