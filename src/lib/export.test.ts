import { describe, it, expect } from "vitest";
import { trailToText } from "./export";
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
    expect(text.trim().endsWith("— mapped with Drift")).toBe(true);
  });

  it("uses the singular 'stop' for a one-step trail", () => {
    const one = trailToText({ ...trail, steps: [trail.steps[0]] });
    expect(one.split("\n")[0]).toContain("· 1 stop");
  });
});
