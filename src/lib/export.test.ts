import { describe, it, expect } from "vitest";
import { trailToText, TEXT_EXPORT_NOTICE } from "./export";
import type { ArrivedVia, Trail, TrailStep } from "./types";

function step(title: string, via: ArrivedVia): TrailStep {
  return {
    card: {
      pageTitle: title,
      displayTitle: title,
      extract: "x",
      sourceUrl: `https://en.wikipedia.org/wiki/${title}`,
    },
    arrivedVia: via,
    timestamp: 0,
    expanded: false,
  };
}

const trail: Trail = {
  id: "t1",
  name: "Octopus → Naval warfare",
  liked: false,
  createdAt: 0,
  steps: [
    step("Octopus", { type: "seed", seedName: "Animal Kingdom" }),
    step("Cephalopod", { type: "thread", label: "How gears work", fromTitle: "Octopus" }),
    step("Naval warfare", { type: "drift" }),
  ],
};

describe("trailToText", () => {
  const text = trailToText(trail);

  it("starts with a thread emoji header including the name and stop count", () => {
    expect(text.split("\n")[0]).toBe("🧵 Octopus → Naval warfare · 3 stops");
  });

  it("numbers each stop with its URL", () => {
    expect(text).toContain("1. Octopus");
    expect(text).toContain("   https://en.wikipedia.org/wiki/Octopus");
    expect(text).toContain("3. Naval warfare");
  });

  it("annotates how each stop was reached", () => {
    expect(text).toContain("2. Cephalopod (How gears work)");
    expect(text).toContain("3. Naval warfare (drift)");
  });

  it("ends with the Drift signature", () => {
    expect(text.trim().endsWith("Mapped with Drift")).toBe(true);
  });

  it("uses the singular 'stop' for a one-step trail", () => {
    const one = trailToText({ ...trail, steps: [trail.steps[0]] });
    expect(one.split("\n")[0]).toContain("· 1 stop");
  });

  // Not required, and worth knowing why (compliance audit BP-2, B-5 row iv): a
  // text export of titles and URLs is not Adapted Material and does not even
  // engage CC BY-SA §3(a), because titles are too short to carry protected
  // expression and URLs are facts. This is one line of courtesy that makes the
  // artefact self-describing once it has left Drift.
  it("names the source and the licence, and says images are not included", () => {
    expect(text).toContain(TEXT_EXPORT_NOTICE);
    expect(text).toContain("CC BY-SA 4.0");
    expect(text).toContain("creativecommons.org/licenses/by-sa/4.0");
    expect(text).toContain("Images not included");
  });

  it("puts the notice above the signature, not after it", () => {
    const lines = text.trim().split("\n");
    expect(lines[lines.length - 1]).toBe("Mapped with Drift");
    expect(lines[lines.length - 2]).toBe(TEXT_EXPORT_NOTICE);
  });
});

// Phase 28: the exported trail now carries quoted article prose, which is what
// turns the licence notice from courtesy into an obligation (see export.ts).
describe("trailToText with bridges", () => {
  const bridgeTrail: Trail = {
    ...trail,
    steps: [
      step("Black hole", { type: "seed", seedName: "Physics" }),
      step("Event horizon", {
        type: "thread",
        label: "Event horizon",
        fromTitle: "Black hole",
        bridge: "The boundary of no escape is called the event horizon.",
      }),
    ],
  };

  it("prints the sentence that led to each stop, under that stop", () => {
    expect(trailToText(bridgeTrail)).toContain(
      "2. Event horizon (Event horizon)\n   “The boundary of no escape is called the event horizon.”",
    );
  });

  it("still names the licence, which now covers real article text", () => {
    expect(trailToText(bridgeTrail)).toContain(TEXT_EXPORT_NOTICE);
  });

  it("says nothing extra for a hop that carried no quote", () => {
    expect(trailToText(trail)).not.toContain("“");
  });
});

// Phase 29: a trail can fork. Written straight down the stored order, a branch
// would be numbered as if it continued the trunk, which claims a hop nobody
// made.
describe("trailToText with branches", () => {
  const branched: Trail = {
    ...trail,
    steps: [
      step("Black hole", { type: "seed", seedName: "Physics" }),
      step("Event horizon", {
        type: "thread",
        label: "Event horizon",
        fromTitle: "Black hole",
      }),
      step("Time dilation", { type: "drift" }),
      {
        ...step("Hawking radiation", {
          type: "thread",
          label: "Hawking radiation",
          fromTitle: "Event horizon",
          viaDoor: true,
        }),
        parent: 1,
      },
      step("Entropy", { type: "drift" }),
    ],
  };
  const text = trailToText(branched);

  it("counts every stop, on whichever line it sits", () => {
    expect(text.split("\n")[0]).toBe("🧵 Octopus → Naval warfare · 5 stops");
  });

  it("writes the main line first, then the branch, and says where it left", () => {
    const lines = text.split("\n").filter((l) => /^(\d+\.|↳)/.test(l));
    expect(lines).toEqual([
      "1. Black hole",
      "2. Event horizon (Event horizon)",
      "3. Time dilation (drift)",
      "↳ back at Event horizon:",
      "1. Hawking radiation (Hawking radiation)",
      "2. Entropy (drift)",
    ]);
  });

  it("leaves an unbranched trail exactly as it was", () => {
    expect(trailToText(trail)).not.toContain("↳");
  });
});
