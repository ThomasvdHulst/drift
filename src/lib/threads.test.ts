import { describe, it, expect } from "vitest";
import { classifyThreads, isDeeper, isZoomOut } from "./threads";
import type { Card, RelatedCandidate } from "./types";

function card(pageTitle: string, description: string, extract: string): Card {
  return {
    pageTitle,
    displayTitle: pageTitle,
    description,
    extract,
    sourceUrl: "",
    source: "wikipedia",
  };
}
function cand(
  pageTitle: string,
  description?: string,
  extract = "A sentence with content.",
): RelatedCandidate {
  return { pageTitle, displayTitle: pageTitle, description, extract, source: "wikipedia" };
}

const octopus = card(
  "Octopus",
  "Order of molluscs",
  "An octopus is a soft-bodied, eight-limbed mollusc of the order Octopoda. Around 300 species are recognised.",
);

describe("isDeeper", () => {
  it("detects title containment (candidate is more specific)", () => {
    expect(isDeeper(octopus, cand("Common octopus", "Species of cephalopod"))).toBe(true);
    expect(isDeeper(octopus, cand("Octopus sinensis", "Species of octopus"))).toBe(true);
  });
  it("detects a '{rank} of {current}' description", () => {
    expect(isDeeper(octopus, cand("Grimpoteuthis", "Genus of octopus"))).toBe(true);
  });
  it("is false for the current page itself and unrelated pages", () => {
    expect(isDeeper(octopus, cand("Octopus", "Order of molluscs"))).toBe(false);
    expect(isDeeper(octopus, cand("Squid", "Superorder of cephalopod molluscs"))).toBe(false);
  });
});

describe("isZoomOut", () => {
  const gpo = card(
    "Giant Pacific octopus",
    "Species of cephalopod",
    "The giant Pacific octopus is a large marine cephalopod belonging to the genus Enteroctopus.",
  );
  it("detects title containment (candidate is the general term)", () => {
    expect(isZoomOut(gpo, cand("Octopus", "Order of molluscs"))).toBe(true);
  });
  it("detects a hypernym named in the current's first sentence", () => {
    expect(isZoomOut(gpo, cand("Cephalopod", "Class of molluscs"))).toBe(true);
  });
  it("does NOT fire on the current title's own words (precision guard)", () => {
    // The candidate equal to the whole current title is not a zoom-out.
    expect(isZoomOut(gpo, cand("Giant Pacific octopus", "Species"))).toBe(false);
    // A mere fragment of the subject's name ("Pacific") is not a broader concept,
    // even though the word appears in the title.
    expect(isZoomOut(gpo, cand("Pacific", "Ocean"))).toBe(false);
  });
});

describe("classifyThreads", () => {
  it("assembles deeper / (nearby fallback) / tangent, always three, in order", () => {
    const threads = classifyThreads(octopus, [
      cand("Grimpoteuthis", "Genus of cephalopods"),
      cand("Cephalopod limb", "Limbs of cephalopod molluscs"),
      cand("Common octopus", "Species of cephalopod"),
      cand("Cephalopod", "Class of mollusks"),
      cand("Squid", "Superorder of cephalopod molluscs"),
    ]);
    expect(threads).toHaveLength(3);
    expect(threads[0].kind).toBe("deeper");
    expect(threads[0].candidate.pageTitle).toBe("Common octopus");
    // Octopus's intro says "mollusc/Octopoda", not "cephalopod" → no honest
    // zoom-out here → that slot falls back to nearby.
    expect(threads[1].kind).toBe("nearby");
    expect(threads[2].kind).toBe("tangent");
    // no candidate used twice
    expect(new Set(threads.map((t) => t.candidate.pageTitle)).size).toBe(3);
  });

  it("surfaces a real zoom-out when one is detectable", () => {
    const gpo = card(
      "Giant Pacific octopus",
      "Species of cephalopod",
      "The giant Pacific octopus is a large marine cephalopod belonging to the genus Enteroctopus.",
    );
    const threads = classifyThreads(gpo, [
      cand("Octopus", "Order of molluscs"),
      cand("Enteroctopus", "Genus of cephalopods"),
      cand("Cephalopod", "Class of molluscs"),
    ]);
    const byKind = Object.fromEntries(threads.map((t) => [t.kind, t.candidate.pageTitle]));
    expect(byKind.zoomout).toBe("Octopus");
    expect(threads.some((t) => t.kind === "tangent")).toBe(true);
  });

  it("labels chips with the destination title", () => {
    const threads = classifyThreads(octopus, [cand("Common octopus", "Species of cephalopod")]);
    expect(threads[0].label).toBe("Common octopus");
  });

  it("excludes seen candidates (by cardId)", () => {
    const threads = classifyThreads(
      octopus,
      [cand("Common octopus", "Species of cephalopod"), cand("Squid", "Superorder of cephalopods")],
      { seen: new Set(["wikipedia:Common octopus"]) },
    );
    expect(threads.map((t) => t.candidate.pageTitle)).not.toContain("Common octopus");
  });

  it("returns what exists for a thin page (<3 candidates)", () => {
    const threads = classifyThreads(octopus, [cand("Squid", "Superorder of cephalopods")]);
    expect(threads).toHaveLength(1);
  });

  it("drops junk candidates (no extract / list)", () => {
    const threads = classifyThreads(octopus, [
      cand("No extract", "Genus", ""),
      cand("List of octopus species", "List article"),
      cand("Common octopus", "Species of cephalopod"),
    ]);
    expect(threads.map((t) => t.candidate.pageTitle)).toEqual(["Common octopus"]);
  });
});
