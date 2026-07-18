import { describe, it, expect } from "vitest";
import { layoutMeander } from "./trailmap";
import type { ArrivedVia, TrailStep } from "./types";

function step(via: ArrivedVia): TrailStep {
  return {
    card: {
      pageTitle: "T",
      displayTitle: "T",
      extract: "x",
      sourceUrl: "https://en.wikipedia.org/wiki/T",
    },
    arrivedVia: via,
    timestamp: 0,
    expanded: false,
  };
}

const steps: TrailStep[] = [
  step({ type: "seed", seedName: "Space" }),
  step({ type: "thread", label: "How gears work", fromTitle: "A" }),
  step({ type: "drift" }),
];

describe("layoutMeander", () => {
  it("produces one node per step, alternating sides, descending", () => {
    const { nodes } = layoutMeander(steps);
    expect(nodes).toHaveLength(3);
    expect(nodes.map((n) => n.side)).toEqual(["left", "right", "left"]);
    expect(nodes[0].cy).toBeLessThan(nodes[1].cy);
    expect(nodes[1].cy).toBeLessThan(nodes[2].cy);
    // left nodes sit left of centre, right nodes right of centre
    expect(nodes[0].cx).toBeLessThan(nodes[1].cx);
  });

  it("produces N-1 segments carrying each step's arrival kind + label", () => {
    const { segments } = layoutMeander(steps);
    expect(segments).toHaveLength(2);
    expect(segments[0].kind).toBe("thread");
    expect(segments[0].label).toBe("How gears work");
    expect(segments[1].kind).toBe("drift");
    expect(segments[1].label).toBeUndefined();
    expect(segments.every((s) => s.d.startsWith("M "))).toBe(true);
  });

  it("has positive canvas dimensions that grow with step count", () => {
    const small = layoutMeander(steps);
    const big = layoutMeander([...steps, ...steps]);
    expect(small.width).toBeGreaterThan(0);
    expect(small.height).toBeGreaterThan(0);
    expect(big.height).toBeGreaterThan(small.height);
  });

  it("handles the empty trail without segments", () => {
    const { nodes, segments, height } = layoutMeander([]);
    expect(nodes).toHaveLength(0);
    expect(segments).toHaveLength(0);
    expect(height).toBeGreaterThan(0);
  });

  it("respects a custom width by centring the spine", () => {
    const { nodes } = layoutMeander(steps, { width: 600, amplitude: 50 });
    expect(nodes[0].cx).toBe(300 - 50); // left of centre
    expect(nodes[1].cx).toBe(300 + 50); // right of centre
  });

  it("flags a segment that crosses realms (Phase 15)", () => {
    const wiki: TrailStep = { ...step({ type: "seed", seedName: "Octopus" }) };
    const art: TrailStep = {
      card: {
        pageTitle: "123",
        displayTitle: "Octopus and Shell",
        extract: "x",
        sourceUrl: "https://www.artic.edu/artworks/123",
        source: "artic",
      },
      arrivedVia: { type: "thread", label: "Octopus and Shell", fromTitle: "Octopus", crossedFrom: "encyclopedia" },
      timestamp: 0,
      expanded: false,
    };
    const { segments } = layoutMeander([wiki, art, { ...wiki }]);
    expect(segments[0].crossRealm).toBe(true); // wiki → artic
    expect(segments[1].crossRealm).toBe(true); // artic → wiki
    // A same-realm hop is not a crossing.
    expect(layoutMeander([wiki, { ...wiki }]).segments[0].crossRealm).toBe(false);
  });
});
