import type { TrailStep, ThreadKind } from "./types";
import { cardSource } from "./card";
import { readingOrder, parentOf } from "./branch";
import { openDoorCounts } from "./doors";

// ---------------------------------------------------------------------------
// Pure geometry for the trail map — a gently meandering vertical spine. Nodes
// step down a centre line at a fixed row pitch, offset left/right by a small
// amplitude (a soft S-curve). Each segment connects a step to the one it
// CONTINUES FROM, carrying how the reader travelled (seed/thread/drift) so the
// component can style + label edges without re-deriving anything. Keeping the
// maths here (not in the component) makes it unit-testable. See CLAUDE.md §6.
//
// Phase 29 made a trail a tree, so the spine can fork. A branch runs in a
// PARALLEL LANE beside the trunk, starting one row below the stop it left, which
// keeps the vertical axis meaning time: the map still reads downward, and the
// fork reads as what it is — one stop, two ways out. A trail that never forks
// lays out exactly as it did before (one lane, alternating titles); the wider,
// fixed-side arrangement only appears when there is something to make room for.
// ---------------------------------------------------------------------------

export type MeanderSide = "left" | "right";

export interface MeanderNode {
  index: number;
  cx: number;
  cy: number;
  side: MeanderSide;
  /** Column: 0 is the main line, each branch opens the next one. */
  lane: number;
  /** Row down the page (not the step index once a trail forks). */
  row: number;
  /** Which side the title column sits on. Equal to `side` on an unbranched
   *  trail; pinned per-lane once a neighbouring lane is in the way. */
  titleSide: MeanderSide;
  /** The title column's left edge and width. Computed here rather than in the
   *  component because with lanes it is no longer "everything to that side":
   *  the column has to stop before the next lane's nodes. */
  titleX: number;
  titleW: number;
}

export interface MeanderSegment {
  d: string; // SVG path data connecting `from` → `to`
  from: number; // step index this edge leaves
  to: number; // step index it arrives at
  kind: "seed" | "thread" | "drift";
  label?: string; // thread label, when kind === "thread"
  threadKind?: ThreadKind; // the thread's direction (Phase 6), for the edge glyph
  crossRealm?: boolean; // this hop crossed realms (Phase 15) — a "bridge" edge
  fork?: boolean; // this hop left the lane it came from (Phase 29)
  viaDoor?: boolean; // …because you came back for a door you had left open
  /** Where to hang this edge's badge. The midpoint for an ordinary hop; further
   *  along a fork, because a fork leaves the same node as the hop below it and
   *  two badges at two midpoints half a row apart land on top of each other. */
  labelX: number;
  labelY: number;
}

/** A stop that left a door open (Phase 28): a short dashed spur off its node,
 *  with the point to hang the marker on. */
export interface MeanderStub {
  index: number;
  /** How many doors this stop left that are STILL open. */
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
  /** How many columns the trail needed. 1 ⇒ it never forked. */
  lanes: number;
}

export interface MeanderOptions {
  width?: number; // canvas width of a SINGLE lane; the spine is centred within it
  row?: number; // vertical distance between consecutive rows
  amplitude?: number; // horizontal offset of nodes from the centre line
  nodeSize?: number; // node (thumbnail) diameter
  padY?: number; // top/bottom padding
  lanePitch?: number; // horizontal distance between lane centres
  padX?: number; // outer horizontal padding for title columns
  titleGap?: number; // space between a node and its title column
}

// Far enough apart that a lane's nodes, its title column and the next lane's
// nodes never touch: 2·amp + nodeSize of lane body, plus a title column, plus
// air. Anything tighter and a branch title lands on top of the trunk.
const LANE_PITCH = 340;

// …except between the main line and the FIRST branch, where nothing goes: the
// main line reads its titles leftward and every branch reads its own rightward,
// so that one gap needs only air. Worth the special case — it is by far the
// commonest shape (one trunk, one branch), and it is 140px of canvas that would
// otherwise push the branch off the side of the exit screen.
const FIRST_LANE_PITCH = 200;

export function layoutMeander(
  steps: TrailStep[],
  opts: MeanderOptions = {},
): MeanderLayout {
  const laneWidth = opts.width ?? 520;
  const row = opts.row ?? 108;
  const amp = opts.amplitude ?? 44;
  const nodeSize = opts.nodeSize ?? 56;
  const padY = opts.padY ?? 44;
  const lanePitch = opts.lanePitch ?? LANE_PITCH;
  const firstPitch = Math.min(opts.lanePitch ?? FIRST_LANE_PITCH, lanePitch);
  const padX = opts.padX ?? 16;
  const titleGap = opts.titleGap ?? 14;
  const centerX = laneWidth / 2;
  // A title column, sized from the gutter lane 0 already has to its left, so
  // every lane's titles get the same room the spine has always given them.
  const titleW = Math.max(0, centerX - amp - nodeSize / 2 - titleGap - padX);

  const places = readingOrder(steps);
  const laneCount = places.reduce((m, p) => Math.max(m, p.lane + 1), 1);
  const laneX = (k: number) =>
    laneWidth / 2 +
    (k === 0 ? 0 : firstPitch + (k - 1) * lanePitch);
  // Room for the last lane's own title column on the right; lane 0's gutter on
  // the left is already inside `laneWidth`.
  const width =
    laneCount === 1
      ? laneWidth
      : laneX(laneCount - 1) + amp + nodeSize / 2 + titleGap + titleW + padX;

  // Nodes stay parallel to `steps` (nodes[i] draws steps[i]), which is what lets
  // every caller keep indexing by step.
  const nodes: MeanderNode[] = new Array(places.length);
  for (const p of places) {
    // The side still alternates by ROW, so on an unbranched trail (row === index)
    // the spine is the exact S-curve it has always been.
    const side: MeanderSide = p.row % 2 === 0 ? "left" : "right";
    const laneCenter = laneX(p.lane);
    const cx = side === "left" ? laneCenter - amp : laneCenter + amp;
    // With a lane to the right, an alternating title would be thrown across the
    // gap and land on the branch. So each lane commits: the main line reads
    // outward to the left, every branch outward to the right.
    const titleSide: MeanderSide =
      laneCount === 1 ? side : p.lane === 0 ? "left" : "right";
    // A right-hand column runs to the canvas edge only in the LAST lane;
    // otherwise it stops short of the next lane's leftmost node.
    const rightBound =
      p.lane === laneCount - 1
        ? width - padX
        : laneX(p.lane + 1) - amp - nodeSize / 2 - titleGap;
    const titleX =
      titleSide === "left" ? padX : cx + nodeSize / 2 + titleGap;
    nodes[p.index] = {
      index: p.index,
      cx,
      cy: padY + nodeSize / 2 + p.row * row,
      side,
      lane: p.lane,
      row: p.row,
      titleSide,
      titleX,
      titleW: Math.max(
        0,
        (titleSide === "left" ? cx - nodeSize / 2 - titleGap : rightBound) -
          titleX,
      ),
    };
  }

  const segments: MeanderSegment[] = [];
  for (let i = 1; i < steps.length; i++) {
    const from = parentOf(steps, i);
    if (from === null) continue;
    const a = nodes[from];
    const b = nodes[i];
    if (!a || !b) continue;
    const via = steps[i].arrivedVia;
    const fork = a.lane !== b.lane;
    const midY = (a.cy + b.cy) / 2;
    const midX = (a.cx + b.cx) / 2;
    // A fork's badge rides three-quarters of the way out, over the lane gap the
    // branch is heading into, where the trunk's own badge cannot reach.
    const t = fork ? 0.75 : 0.5;
    segments.push({
      labelX: a.cx + (b.cx - a.cx) * t,
      labelY: a.cy + (b.cy - a.cy) * t,
      // A fork leaves and arrives HORIZONTALLY (control handles on the x axis),
      // so it reads as a branch coming off a stem rather than as one more hop
      // down the spine. An ordinary edge keeps its vertical handles.
      d: fork
        ? `M ${a.cx} ${a.cy} C ${midX} ${a.cy}, ${midX} ${b.cy}, ${b.cx} ${b.cy}`
        : `M ${a.cx} ${a.cy} C ${a.cx} ${midY}, ${b.cx} ${midY}, ${b.cx} ${b.cy}`,
      from,
      to: i,
      kind: via.type,
      label: via.type === "thread" ? via.label : undefined,
      threadKind: via.type === "thread" ? via.kind : undefined,
      crossRealm: cardSource(steps[from].card) !== cardSource(steps[i].card),
      ...(fork ? { fork: true } : {}),
      ...(via.type === "thread" && via.viaDoor ? { viaDoor: true } : {}),
    });
  }

  const maxRow = places.reduce((m, p) => Math.max(m, p.row), 0);
  const height =
    places.length > 0
      ? padY + nodeSize / 2 + maxRow * row + nodeSize / 2 + padY
      : padY * 2;

  return {
    nodes,
    segments,
    stubs: stubsFor(steps, nodes, nodeSize),
    width,
    height,
    nodeSize,
    lanes: laneCount,
  };
}

/**
 * The short dashed spurs marking stops that left a door open (Phase 28).
 *
 * Drawn AWAY FROM THE TITLE COLUMN, which on an unbranched trail means inward,
 * toward the lane centre — the spine's titles sit on the outer side. Once a
 * trail forks the titles pin per-lane, and a spur that still went "inward" would
 * run straight through the title of a node on the far side of its lane, so the
 * rule has to be stated as what it always meant. Deliberately unlabelled and
 * short: the map's job is to show that a choice happened, and the list under it
 * says what the choice was. A road not taken drawn as loudly as the road taken
 * would be a map of regret.
 *
 * It counts only doors that are STILL open, from the same filter the list uses,
 * so a door you came back and walked through (Phase 29) turns into the branch it
 * became instead of also keeping the spur that said you never went.
 */
const STUB_LENGTH = 26;

function stubsFor(
  steps: TrailStep[],
  nodes: MeanderNode[],
  nodeSize: number,
): MeanderStub[] {
  const counts = openDoorCounts(steps);
  const stubs: MeanderStub[] = [];
  counts.forEach((count, i) => {
    const node = nodes[i];
    if (count === 0 || !node) return;
    // Away from the title: a node titled on its left spurs right, and vice versa.
    const dir = node.titleSide === "left" ? 1 : -1;
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
