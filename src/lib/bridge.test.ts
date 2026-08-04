import { describe, it, expect } from "vitest";
import { leadLinks, sentenceAround, pickBridges } from "./bridge";
import { BROOKLYN_LEAD, TAXOBOX, EULER_LEAD } from "./wikihtml.fixtures";

// The sentence a chip quotes is the app's answer to "why is this thread here?",
// so every rule here is about not lying: no truncation, no repetition, and no
// quoting the reader's own screen back at them.

describe("leadLinks", () => {
  const links = leadLinks(BROOKLYN_LEAD);
  const byTarget = (t: string) => links.find((l) => l.target === t);

  it("carries the sentence each link sits in", () => {
    expect(byTarget("Suspension bridge")?.sentence).toBe(
      "The Brooklyn Bridge is a cable-stayed/suspension bridge in New York City, spanning the East River between the boroughs of Manhattan and Brooklyn.",
    );
    // A link from the SECOND paragraph gets that paragraph's sentence, not the
    // lead sentence: the sentence is per-link, not per-article.
    expect(byTarget("John A. Roebling")?.sentence).toBe(
      "Proposals for a bridge connecting Manhattan and Brooklyn were first made in the early 19th century, which eventually led to the construction of the current span, designed by John A. Roebling.",
    );
  });

  it("keeps the words that actually carry the link", () => {
    expect(byTarget("Cable-stayed bridge")?.anchor).toBe("cable-stayed");
    expect(byTarget("Boroughs of New York City")?.anchor).toBe("boroughs");
  });

  it("ignores everything that is not read as prose", () => {
    // The hatnote ("For other uses, see …") and the infobox are full of links
    // that explain nothing about why you would go there. Walking <p> elements
    // is what excludes them, the same way htmlBlocks excludes them.
    expect(byTarget("Brooklyn Bridge (disambiguation)")).toBeUndefined();
    expect(byTarget("Roadway")).toBeUndefined(); // infobox "Carries" row
    expect(byTarget("Cycling")).toBeUndefined();
    // An infobox on its own contributes nothing at all.
    expect(leadLinks(TAXOBOX)).toEqual([]);
  });

  it("skips file and other namespace links", () => {
    expect(links.some((l) => /^(File|Image|Help|Category):/i.test(l.target))).toBe(
      false,
    );
  });

  it("survives a lead full of math without inventing a sentence", () => {
    // Euler's identity: the prose is wrapped around MathML, an annotation and a
    // fallback image. Nothing should throw, and a real link still resolves.
    const euler = leadLinks(EULER_LEAD);
    const number = euler.find((l) => l.target === "E (mathematical constant)");
    expect(number?.anchor).toBe("Euler's number");
    expect(number?.sentence).toContain("is the");
  });
});

describe("sentenceAround", () => {
  it("returns the whole sentence containing the phrase", () => {
    const text =
      "A black hole is a region of spacetime. The boundary of no escape is called the event horizon. It has an enormous effect on light.";
    expect(sentenceAround(text, "event horizon")).toBe(
      "The boundary of no escape is called the event horizon.",
    );
  });

  it("does not break at an abbreviation or an initial", () => {
    // Every one of these was a real way the naive "period + capital" rule cut a
    // quote off mid-clause.
    const born =
      "She was born c. 1815 in London. Her tutor was Mary Somerville.";
    expect(sentenceAround(born, "London")).toBe("She was born c. 1815 in London.");
    const tolkien =
      "The style owes much to J. R. R. Tolkien and his imitators. Later writers went further.";
    expect(sentenceAround(tolkien, "Tolkien")).toBe(
      "The style owes much to J. R. R. Tolkien and his imitators.",
    );
    const eg =
      "Some fermentations, e.g. lactic acid fermentation, need no oxygen. Others do.";
    expect(sentenceAround(eg, "lactic acid")).toBe(
      "Some fermentations, e.g. lactic acid fermentation, need no oxygen.",
    );
  });

  it("ends a sentence that closes on a bracket or a number", () => {
    // Both cost real bridges before they were fixed: the guard that protects
    // "J. R. R." from being split looked for a letter before the full stop, and
    // finding none it refused the boundary — so the paragraph became one
    // enormous sentence and every quote in it was rejected for length.
    const octopus =
      "An octopus is a mollusc of the order Octopoda (/ɒkˈtɒpədə/, ok-TOP-ə-də). The order consists of some 300 species and is grouped with squids.";
    expect(sentenceAround(octopus, "squids")).toBe(
      "The order consists of some 300 species and is grouped with squids.",
    );
    const dated =
      "The school was founded in 1919. It moved to Dessau six years later.";
    expect(sentenceAround(dated, "Dessau")).toBe(
      "It moved to Dessau six years later.",
    );
  });

  it("handles the first and last sentence, and a missing phrase", () => {
    const text = "The first one. The middle one. The last one.";
    expect(sentenceAround(text, "first")).toBe("The first one.");
    expect(sentenceAround(text, "last")).toBe("The last one.");
    expect(sentenceAround(text, "nowhere")).toBeNull();
    expect(sentenceAround("", "x")).toBeNull();
  });
});

describe("pickBridges", () => {
  const link = (target: string, anchor: string, sentence: string) => ({
    target,
    anchor,
    sentence,
  });
  const SHORT = "The boundary of no escape is called the event horizon.";
  // Verbatim from the Bauhaus lead: 434 characters, four clauses, unreadable on
  // a chip. Rejected rather than cut, because a cut quote is a misquote.
  const MONSTER =
    "The school existed in three German cities—Weimar, from 1919 to 1925; Dessau, from 1925 to 1932; and Berlin, from 1932 to 1933—under three different architect-directors: Walter Gropius from 1919 to 1928; Hannes Meyer from 1928 to 1930; and Ludwig Mies van der Rohe from 1930 until 1933, when the school was closed by its own leadership under pressure from the Nazi regime, having been painted as a centre of communist intellectualism.";

  it("gives each title the sentence it is linked in", () => {
    const out = pickBridges(
      ["Event horizon"],
      [link("Event horizon", "event horizon", SHORT)],
    );
    expect(out.get("Event horizon")).toEqual({
      sentence: SHORT,
      anchor: "event horizon",
    });
  });

  it("refuses a sentence too long or too short to be quoted", () => {
    const out = pickBridges(
      ["Hannes Meyer", "Squid"],
      [
        link("Hannes Meyer", "Hannes Meyer", MONSTER),
        link("Squid", "squids", "Squids are cephalopods."),
      ],
    );
    expect(out.has("Hannes Meyer")).toBe(false);
    expect(out.has("Squid")).toBe(false);
  });

  it("answers every candidate independently of the others", () => {
    // Octopus's lead explains three candidates in one line. Suppressing two of
    // them HERE was a real bug: the chip the reader is shown is Cephalopod (the
    // zoom-out), and it arrived bare because Squid (rank 0) had claimed the
    // sentence and was never shown. The quoted-once rule belongs where the three
    // chips are chosen — see classifyThreads.
    const shared =
      "The order consists of some 300 species and is grouped within the class Cephalopoda with squids, cuttlefish, and nautiloids.";
    const out = pickBridges(
      ["Squid", "Cephalopod", "Cuttlefish"],
      [
        link("Squid", "squids", shared),
        link("Cephalopod", "Cephalopoda", shared),
        link("Cuttlefish", "cuttlefish", shared),
      ],
    );
    expect(out.get("Squid")?.sentence).toBe(shared);
    expect(out.get("Cephalopod")?.sentence).toBe(shared);
    expect(out.get("Cuttlefish")?.sentence).toBe(shared);
  });

  it("prefers a sentence the reader cannot already see on the card", () => {
    const onCard =
      "Lovelace was an English mathematician known for her work on the analytical engine.";
    const further =
      "She was the first to recognise that the machine had applications beyond calculation.";
    const out = pickBridges(
      ["Analytical engine"],
      [
        link("Analytical engine", "analytical engine", onCard),
        link("Analytical engine", "the machine", further),
      ],
      { avoid: onCard },
    );
    expect(out.get("Analytical engine")?.sentence).toBe(further);
  });

  it("still bridges with the visible sentence when it is the only one", () => {
    const onCard =
      "Lovelace was an English mathematician known for her work on the analytical engine.";
    const out = pickBridges(
      ["Analytical engine"],
      [link("Analytical engine", "analytical engine", onCard)],
      { avoid: onCard },
    );
    expect(out.get("Analytical engine")?.sentence).toBe(onCard);
  });

  it("prefers the crisper of two usable sentences", () => {
    const long =
      "The theory, which describes gravitation as the curvature of spacetime rather than as a force acting at a distance, predicts black holes.";
    const out = pickBridges(
      ["General relativity"],
      [
        link("General relativity", "the theory", long),
        link("General relativity", "general relativity", SHORT),
      ],
    );
    expect(out.get("General relativity")?.sentence).toBe(SHORT);
  });

  it("says nothing when the lead never links there", () => {
    // Including the documented limit: a lead that links the REDIRECT "octopuses"
    // does not match the canonical title, and no bridge is better than a wrong one.
    const out = pickBridges(
      ["Octopus", "Women in computing"],
      [link("Octopuses", "octopuses", "Octopuses are soft-bodied molluscs of note.")],
    );
    expect(out.size).toBe(0);
    expect(pickBridges([], []).size).toBe(0);
  });

  it("matches a title whose link is spelled with underscores or other case", () => {
    const out = pickBridges(
      ["Event horizon"],
      [link("event_horizon", "event horizon", SHORT)],
    );
    expect(out.has("Event horizon")).toBe(true);
  });
});
