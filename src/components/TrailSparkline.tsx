import type { TrailStep } from "@/lib/types";
import { childrenOf, mainLine } from "@/lib/branch";

// A tiny preview of a trail for the My Trails grid: a compact left→right zig-zag
// (echoing the meandering spine), dots for stops, solid/sage segments where a
// thread was pulled and dotted where the reader drifted. No images — pure SVG.
//
// It draws the MAIN LINE (Phase 29), with a short tick wherever the trail forked
// off it. Running the stored order straight across would draw a line between the
// end of a trunk and the start of a branch, which is a hop nobody made. At
// 148×44 a tick is the right amount of detail — the whole tree is the trail
// map's job — so a branch off a branch is counted in the label rather than
// drawn.

export function TrailSparkline({
  steps,
  className,
}: {
  steps: TrailStep[];
  className?: string;
}) {
  const w = 148;
  const h = 44;
  const padX = 8;
  const padY = 9;
  if (steps.length === 0) return null;

  const line = mainLine(steps);
  const kids = childrenOf(steps);
  const n = line.length;
  const stepX = n > 1 ? (w - padX * 2) / (n - 1) : 0;
  const topY = padY;
  const botY = h - padY;
  const pts = line.map((idx, i) => ({
    x: padX + i * stepX,
    y: i % 2 === 0 ? topY : botY,
    kind: steps[idx].arrivedVia.type,
  }));

  // One tick per fork, leaning away from the spine so it never sits on a dot.
  const spurs = line.flatMap((idx, i) =>
    kids[idx].slice(1).map((_, k) => {
      const from = pts[i];
      const dy = from.y === topY ? 9 : -9;
      return {
        key: `${i}-${k}`,
        x1: from.x,
        y1: from.y,
        x2: from.x + Math.max(6, stepX * 0.5),
        y2: from.y + dy,
      };
    }),
  );

  const forks = childrenOf(steps).reduce(
    (sum, k) => sum + Math.max(0, k.length - 1),
    0,
  );
  const label =
    `Trail with ${steps.length} ${steps.length === 1 ? "stop" : "stops"}` +
    (forks > 0 ? ` and ${forks} ${forks === 1 ? "branch" : "branches"}` : "");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      {pts.slice(1).map((p, i) => {
        const prev = pts[i];
        const thread = steps[line[i + 1]].arrivedVia.type === "thread";
        return (
          <line
            key={i}
            x1={prev.x}
            y1={prev.y}
            x2={p.x}
            y2={p.y}
            stroke={thread ? "var(--accent)" : "var(--ink)"}
            strokeOpacity={thread ? 0.7 : 0.28}
            strokeWidth={1.5}
            strokeDasharray={thread ? undefined : "1.5 4"}
            strokeLinecap="round"
          />
        );
      })}
      {spurs.map((s) => (
        <line
          key={`spur-${s.key}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="var(--accent)"
          strokeOpacity={0.5}
          strokeWidth={1.2}
          strokeDasharray="1.5 2.5"
          strokeLinecap="round"
        />
      ))}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === 0 || i === n - 1 ? 3 : 2.2}
          fill={p.kind === "thread" ? "var(--accent)" : "var(--ink)"}
          fillOpacity={p.kind === "thread" ? 0.85 : 0.4}
        />
      ))}
    </svg>
  );
}
