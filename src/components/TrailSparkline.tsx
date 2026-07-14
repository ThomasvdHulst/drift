import type { TrailStep } from "@/lib/types";

// A tiny preview of a trail for the My Trails grid: a compact left→right zig-zag
// (echoing the meandering spine), dots for stops, solid/sage segments where a
// thread was pulled and dotted where the reader drifted. No images — pure SVG.

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
  const n = steps.length;
  if (n === 0) return null;

  const stepX = n > 1 ? (w - padX * 2) / (n - 1) : 0;
  const topY = padY;
  const botY = h - padY;
  const pts = steps.map((s, i) => ({
    x: padX + i * stepX,
    y: i % 2 === 0 ? topY : botY,
    kind: s.arrivedVia.type,
  }));

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label={`Trail with ${n} ${n === 1 ? "stop" : "stops"}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {pts.slice(1).map((p, i) => {
        const prev = pts[i];
        const thread = steps[i + 1].arrivedVia.type === "thread";
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
