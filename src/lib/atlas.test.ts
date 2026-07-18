import { describe, it, expect } from "vitest";
import { buildConstellation, layoutConstellation } from "./atlas";
import type { ArrivedVia, Trail, TrailStep, SourceId } from "./types";

function step(pageTitle: string, via: ArrivedVia, source: SourceId = "wikipedia"): TrailStep {
  return {
    card: { pageTitle, displayTitle: pageTitle, extract: "x", sourceUrl: `u/${pageTitle}`, source },
    arrivedVia: via,
    timestamp: 0,
    expanded: false,
  };
}
function trail(id: string, realm: Trail["realm"], steps: TrailStep[]): Trail {
  return { id, name: id, steps, createdAt: 0, liked: false, realm };
}

const spaceTrail = trail("t1", "encyclopedia", [
  step("Space", { type: "seed", seedName: "Space" }),
  step("Black hole", { type: "thread", label: "Black hole", fromTitle: "Space", kind: "deeper" }),
  step("Neutron star", { type: "drift", topic: { id: "physics", label: "Physics" }, reason: "wildcard" }),
]);

describe("buildConstellation", () => {
  it("dedups nodes and counts visits across trails", () => {
    const t2 = trail("t2", "encyclopedia", [
      step("Space", { type: "seed", seedName: "Space" }),
      step("Comet", { type: "drift", topic: { id: "space", label: "Space & Astronomy" } }),
    ]);
    const { nodes } = buildConstellation([spaceTrail, t2]);
    const space = nodes.find((n) => n.id === "wikipedia:Space");
    expect(space?.visits).toBe(2); // in both trails
    expect(nodes.find((n) => n.id === "wikipedia:Comet")?.visits).toBe(1);
  });

  it("makes edges from consecutive steps, tagged by kind, aggregated", () => {
    const { edges } = buildConstellation([spaceTrail, spaceTrail]);
    const e = edges.find((x) => x.fromId === "wikipedia:Space" && x.toId === "wikipedia:Black hole");
    expect(e?.kind).toBe("thread");
    expect(e?.threadKind).toBe("deeper");
    expect(e?.weight).toBe(2); // same edge in both trails
    expect(
      edges.find((x) => x.fromId === "wikipedia:Black hole" && x.toId === "wikipedia:Neutron star")?.kind,
    ).toBe("drift");
  });

  it("propagates clusters: seed → inherit through threads → drift topic", () => {
    const { nodes } = buildConstellation([spaceTrail]);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n.clusterKey]));
    expect(byId["wikipedia:Space"]).toBe("encyclopedia:seed:space");
    expect(byId["wikipedia:Black hole"]).toBe("encyclopedia:seed:space"); // inherited
    expect(byId["wikipedia:Neutron star"]).toBe("encyclopedia:physics"); // own drift topic
  });

  it("falls back to the realm cluster for an anonymous 'Surprise me' start", () => {
    const t = trail("t3", "gallery", [
      step("A", { type: "seed", seedName: "Surprise me" }, "artic"),
      step("B", { type: "thread", label: "More by X", fromTitle: "A" }, "artic"),
    ]);
    const { nodes, clusters } = buildConstellation([t]);
    expect(nodes.every((n) => n.clusterKey === "realm:gallery")).toBe(true);
    expect(clusters.find((c) => c.key === "realm:gallery")?.realm).toBe("gallery");
  });

  it("assigns a node its majority cluster across trails", () => {
    const inPhysics = trail("p", "encyclopedia", [
      step("X", { type: "drift", topic: { id: "physics", label: "Physics" } }),
    ]);
    const inSpaceA = trail("sa", "encyclopedia", [
      step("X", { type: "drift", topic: { id: "space", label: "Space" } }),
    ]);
    const inSpaceB = trail("sb", "encyclopedia", [
      step("X", { type: "drift", topic: { id: "space", label: "Space" } }),
    ]);
    const { nodes } = buildConstellation([inPhysics, inSpaceA, inSpaceB]);
    expect(nodes.find((n) => n.id === "wikipedia:X")?.clusterKey).toBe("encyclopedia:space");
  });
});

describe("layoutConstellation", () => {
  it("is deterministic and places every node inside bounds", () => {
    const g = buildConstellation([spaceTrail]);
    const a = layoutConstellation(g);
    const b = layoutConstellation(g);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.width).toBeGreaterThan(0);
    expect(a.height).toBeGreaterThan(0);
    for (const n of a.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(a.width);
    }
  });

  it("separates cluster discs (no overlap)", () => {
    const g = buildConstellation([spaceTrail]); // ≥2 clusters (space-seed + physics)
    const { clusters } = layoutConstellation(g);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i];
        const b = clusters[j];
        const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        expect(dist).toBeGreaterThanOrEqual(a.radius + b.radius - 0.01);
      }
    }
  });

  it("scales node radius with visit count", () => {
    const busy = trail("t1", "encyclopedia", [
      step("Hub", { type: "seed", seedName: "Space" }),
    ]);
    const busy2 = trail("t2", "encyclopedia", [
      step("Hub", { type: "seed", seedName: "Space" }),
      step("Leaf", { type: "drift", topic: { id: "space", label: "Space" } }),
    ]);
    const { nodes } = layoutConstellation(buildConstellation([busy, busy2]));
    const hub = nodes.find((n) => n.id === "wikipedia:Hub")!;
    const leaf = nodes.find((n) => n.id === "wikipedia:Leaf")!;
    expect(hub.r).toBeGreaterThan(leaf.r); // Hub visited in 2 trails, Leaf in 1
  });
});

describe("Atlas cross-realm nodes (Phase 15)", () => {
  it("keeps each node's own source + image, so the paint can tint per-realm", () => {
    const mixed = trail("m1", "encyclopedia", [
      { ...step("Octopus", { type: "seed", seedName: "Octopus" }), card: { pageTitle: "Octopus", displayTitle: "Octopus", extract: "x", sourceUrl: "u", source: "wikipedia", imageUrl: "octo.jpg" } },
      { ...step("123", { type: "thread", label: "Octopus and Shell", fromTitle: "Octopus", crossedFrom: "encyclopedia" }, "artic"), card: { pageTitle: "123", displayTitle: "Octopus and Shell", extract: "x", sourceUrl: "u2", source: "artic", imageUrl: "art.jpg" } },
    ]);
    const { nodes } = buildConstellation([mixed]);
    expect(nodes.find((n) => n.id === "wikipedia:Octopus")?.source).toBe("wikipedia");
    expect(nodes.find((n) => n.id === "wikipedia:Octopus")?.imageUrl).toBe("octo.jpg");
    expect(nodes.find((n) => n.id === "artic:123")?.source).toBe("artic");
    expect(nodes.find((n) => n.id === "artic:123")?.imageUrl).toBe("art.jpg");
  });
});
