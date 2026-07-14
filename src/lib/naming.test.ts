import { describe, it, expect } from "vitest";
import { autoTrailName } from "./naming";
import type { ArrivedVia, TrailStep } from "./types";

function step(title: string, via: ArrivedVia = { type: "drift" }): TrailStep {
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

describe("autoTrailName", () => {
  it("returns a placeholder for an empty trail", () => {
    expect(autoTrailName([])).toBe("An empty trail");
  });

  it("returns the single title for a one-stop trail", () => {
    expect(autoTrailName([step("Octopus")])).toBe("Octopus");
  });

  it('joins first and last with " → " for multi-stop trails', () => {
    expect(
      autoTrailName([step("Pasta"), step("Physics"), step("Naval warfare")]),
    ).toBe("Pasta → Naval warfare");
  });

  it("uses displayTitle and preserves unicode", () => {
    expect(autoTrailName([step("Café"), step("Grimpoteuthis")])).toBe(
      "Café → Grimpoteuthis",
    );
  });
});
