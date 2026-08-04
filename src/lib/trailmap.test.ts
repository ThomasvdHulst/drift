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

// Doors left open (Phase 28) are drawn as short dashed spurs. They must stay
// visually quiet — the map shows THAT a choice happened; the list under it says
// what the choice was.
describe("layoutMeander stubs", () => {
  const withDoors: TrailStep[] = [
    { ...step({ type: "seed", seedName: "Space" }), doorsLeft: [
      { pageTitle: "Squid", displayTitle: "Squid" },
      { pageTitle: "Nautilus", displayTitle: "Nautilus" },
    ] },
    step({ type: "drift" }),
    { ...step({ type: "drift" }), doorsLeft: [{ pageTitle: "Yarn", displayTitle: "Yarn" }] },
  ];

  it("marks only the stops that left a door", () => {
    const stubs = layoutMeander(withDoors).stubs;
    expect(stubs.map((s) => s.index)).toEqual([0, 2]);
    expect(stubs[0].count).toBe(2);
  });

  it("spurs INWARD, so it never collides with the title column", () => {
    const layout = layoutMeander(withDoors, { width: 520 });
    const [first, second] = layout.stubs;
    // Node 0 sits left of centre, so its spur runs right; node 2 also sits left
    // (even indices are the left side), so the same holds.
    expect(first.x).toBeGreaterThan(layout.nodes[0].cx);
    expect(second.x).toBeGreaterThan(layout.nodes[2].cx);
    // and it stays inside the canvas
    for (const s of layout.stubs) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(layout.width);
    }
  });

  it("is empty for a trail that left no doors, including an empty one", () => {
    expect(layoutMeander(steps).stubs).toEqual([]);
    expect(layoutMeander([]).stubs).toEqual([]);
  });

  it("drops the spur for a door the trail later walked through", () => {
    // The same trail, but stop 1 IS Squid — one of the doors stop 0 left. That
    // door became a branch, so it must not also keep the mark that says you
    // never went.
    const walked: TrailStep[] = [
      withDoors[0],
      { ...withDoors[1], card: { ...withDoors[1].card, pageTitle: "Squid" } },
      withDoors[2],
    ];
    const stubs = layoutMeander(walked).stubs;
    expect(stubs.map((s) => s.index)).toEqual([0, 2]);
    expect(stubs[0].count).toBe(1); // Nautilus only
  });
});

// Branches (Phase 29): a fork runs in a parallel lane beside the trunk. The
// hard requirement is that a trail which never forks lays out EXACTLY as it did
// before — the tests above are the ones guarding that.
describe("layoutMeander branches", () => {
  /** 0-1-2 with a branch (3-4) forking off step 1. */
  function branched(): TrailStep[] {
    const trunk = [
      step({ type: "seed", seedName: "Space" }),
      step({ type: "drift" }),
      step({ type: "drift" }),
    ];
    const door: TrailStep = {
      ...step({
        type: "thread",
        label: "Hawking radiation",
        fromTitle: "T",
        viaDoor: true,
      }),
      parent: 1,
    };
    return [...trunk, door, step({ type: "drift" })];
  }

  it("keeps a trail that never forks in one lane", () => {
    const layout = layoutMeander(steps);
    expect(layout.lanes).toBe(1);
    expect(layout.nodes.every((n) => n.lane === 0)).toBe(true);
    // …and the title column still alternates with the spine.
    expect(layout.nodes.map((n) => n.titleSide)).toEqual([
      "left",
      "right",
      "left",
    ]);
  });

  it("puts the branch in its own lane, one row below the fork", () => {
    const layout = layoutMeander(branched(), { width: 520 });
    expect(layout.lanes).toBe(2);
    expect(layout.nodes[3].lane).toBe(1);
    expect(layout.nodes[4].lane).toBe(1);
    // Branch root sits one row under its parent (step 1), beside step 2.
    expect(layout.nodes[3].row).toBe(2);
    expect(layout.nodes[3].cy).toBe(layout.nodes[2].cy);
    expect(layout.nodes[3].cx).toBeGreaterThan(layout.nodes[2].cx);
  });

  it("widens the canvas and pins each lane's titles outward", () => {
    const plain = layoutMeander(steps, { width: 520 });
    const layout = layoutMeander(branched(), { width: 520 });
    expect(layout.width).toBeGreaterThan(plain.width);
    // Main line reads left, every branch reads right.
    expect(layout.nodes.slice(0, 3).every((n) => n.titleSide === "left")).toBe(true);
    expect(layout.nodes.slice(3).every((n) => n.titleSide === "right")).toBe(true);
    // No title column runs off the canvas or into the next lane.
    for (const n of layout.nodes) {
      expect(n.titleW).toBeGreaterThan(0);
      expect(n.titleX + n.titleW).toBeLessThanOrEqual(layout.width);
      if (n.lane === 0) {
        expect(n.titleX + n.titleW).toBeLessThanOrEqual(n.cx);
      }
    }
  });

  it("connects each step to the one it CONTINUES from, not to i-1", () => {
    const layout = layoutMeander(branched());
    const byTo = new Map(layout.segments.map((s) => [s.to, s]));
    expect(layout.segments).toHaveLength(4);
    expect(byTo.get(2)!.from).toBe(1);
    expect(byTo.get(3)!.from).toBe(1); // the fork, NOT step 2
    expect(byTo.get(4)!.from).toBe(3);
  });

  it("flags the fork and the door it was walked through", () => {
    const byTo = new Map(layoutMeander(branched()).segments.map((s) => [s.to, s]));
    expect(byTo.get(3)!.fork).toBe(true);
    expect(byTo.get(3)!.viaDoor).toBe(true);
    expect(byTo.get(3)!.label).toBe("Hawking radiation");
    // An ordinary hop is neither.
    expect(byTo.get(2)!.fork).toBeUndefined();
    expect(byTo.get(2)!.viaDoor).toBeUndefined();
  });

  it("spurs a door away from the title, not into it", () => {
    // Stop 1 sits on the RIGHT of the trunk but is now titled on the LEFT (the
    // branch lane took the right). A spur drawn "inward" would run through that
    // title, which is what the old rule did.
    const steps = branched();
    steps[1] = {
      ...steps[1],
      doorsLeft: [{ pageTitle: "Squid", displayTitle: "Squid" }],
    };
    const layout = layoutMeander(steps, { width: 520 });
    const stub = layout.stubs.find((s) => s.index === 1)!;
    expect(layout.nodes[1].side).toBe("right");
    expect(layout.nodes[1].titleSide).toBe("left");
    expect(stub.x).toBeGreaterThan(layout.nodes[1].cx);
  });

  it("keeps the whole canvas within reach of the exit screen", () => {
    // Nothing goes between the main line and the first branch (one reads its
    // titles left, the other right), so that gap is air rather than a column.
    const layout = layoutMeander(branched(), { width: 520 });
    expect(layout.width).toBeLessThan(760);
    // …and a third lane, which DOES need a column between it and the second,
    // costs more than the second did.
    const steps = branched();
    const three = [...steps, { ...steps[3], parent: 1 }];
    expect(layoutMeander(three, { width: 520 }).width - layout.width).toBeGreaterThan(
      layout.width - layoutMeander(steps.slice(0, 3), { width: 520 }).width,
    );
  });

  it("grows tall enough for a branch that outruns the trunk", () => {
    const short = layoutMeander(branched());
    const long = layoutMeander([
      ...branched(),
      step({ type: "drift" }),
      step({ type: "drift" }),
    ]);
    expect(long.height).toBeGreaterThan(short.height);
    for (const n of long.nodes) expect(n.cy).toBeLessThan(long.height);
  });
});
