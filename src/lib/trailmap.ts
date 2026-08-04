import type { TrailStep, ThreadKind } from "./types";
import { cardSource } from "./card";

// ---------------------------------------------------------------------------
// Pure geometry for the trail map — a gently meandering vertical spine. Nodes
// step down a centre line at a fixed row pitch, offset left/right by a small
// amplitude (a soft S-curve). Each segment connects consecutive nodes with a
// smooth cubic bezier, carrying how the reader travelled (seed/thread/drift) so
// the component can style + label edges without re-deriving anything. Keeping
// the maths here (not in the component) makes it unit-testable. See CLAUDE.md §6.
// ---------------------------------------------------------------------------

export type MeanderSide = "left" | "right";

export interface MeanderNode {
  index: number;
  cx: number;
  cy: number;
  side: MeanderSide;
}

export interface MeanderSegment {
  d: string; // SVG path data connecting node i-1 → i
  kind: "seed" | "thread" | "drift";
  label?: string; // thread label, when kind === "thread"
  threadKind?: ThreadKind; // the thread's direction (Phase 6), for the edge glyph
  crossRealm?: boolean; // this hop crossed realms (Phase 15) — a "bridge" edge
}

/** A stop that left a door open (Phase 28): a short dashed spur off its node,
 *  with the point to hang the marker on. */
export interface MeanderStub {
  index: number;
  /** How many doors this stop left. */
  count: number;
  d: string; // SVG path for the spur
  x: number; // the spur's free end
  y: number;
}

export interface MeanderLayout {
  nodes: MeanderNode[];
  segments: MeanderSegment[];
  stubs: MeanderStub[];
  width: number;
  height: number;
  nodeSize: number;
}

export interface MeanderOptions {
  width?: number; // total canvas width; the spine is centred within it
  row?: number; // vertical distance between consecutive nodes
  amplitude?: number; // horizontal offset of nodes from the centre line
  nodeSize?: number; // node (thumbnail) diameter
  padY?: number; // top/bottom padding
}

export function layoutMeander(
  steps: TrailStep[],
  opts: MeanderOptions = {},
): MeanderLayout {
  const width = opts.width ?? 520;
  const row = opts.row ?? 108;
  const amp = opts.amplitude ?? 44;
  const nodeSize = opts.nodeSize ?? 56;
  const padY = opts.padY ?? 44;
  const centerX = width / 2;

  const nodes: MeanderNode[] = steps.map((_, i) => {
    const side: MeanderSide = i % 2 === 0 ? "left" : "right";
    return {
      index: i,
      cx: side === "left" ? centerX - amp : centerX + amp,
      cy: padY + nodeSize / 2 + i * row,
      side,
    };
  });

  const segments: MeanderSegment[] = [];
  for (let i = 1; i < steps.length; i++) {
    const a = nodes[i - 1];
    const b = nodes[i];
    const midY = (a.cy + b.cy) / 2;
    // Cubic with vertical control handles → a gentle S between the two nodes.
    const d = `M ${a.cx} ${a.cy} C ${a.cx} ${midY}, ${b.cx} ${midY}, ${b.cx} ${b.cy}`;
    const via = steps[i].arrivedVia;
    segments.push({
      d,
      kind: via.type,
      label: via.type === "thread" ? via.label : undefined,
      threadKind: via.type === "thread" ? via.kind : undefined,
      crossRealm: cardSource(steps[i - 1].card) !== cardSource(steps[i].card),
    });
  }

  const height =
    nodes.length > 0
      ? nodes[nodes.length - 1].cy + nodeSize / 2 + padY
      : padY * 2;

  return { nodes, segments, stubs: stubsFor(steps, nodes, nodeSize), width, height, nodeSize };
}

/**
 * The short dashed spurs marking stops that left a door open (Phase 28).
 *
 * Drawn INWARD, toward the centre line the spine meanders around, because the
 * outer side of every node is where its title sits. Deliberately unlabelled and
 * short: the map's job is to show that a choice happened, and the list under it
 * says what the choice was. A road not taken drawn as loudly as the road taken
 * would be a map of regret.
 */
const STUB_LENGTH = 26;

function stubsFor(
  steps: TrailStep[],
  nodes: MeanderNode[],
  nodeSize: number,
): MeanderStub[] {
  const stubs: MeanderStub[] = [];
  steps.forEach((step, i) => {
    const count = step.doorsLeft?.length ?? 0;
    const node = nodes[i];
    if (count === 0 || !node) return;
    // Inward: a left-side node spurs right, a right-side node spurs left.
    const dir = node.side === "left" ? 1 : -1;
    const x0 = node.cx + dir * (nodeSize / 2 + 4);
    stubs.push({
      index: i,
      count,
      d: `M ${x0} ${node.cy} L ${x0 + dir * STUB_LENGTH} ${node.cy}`,
      x: x0 + dir * STUB_LENGTH,
      y: node.cy,
    });
  });
  return stubs;
}
