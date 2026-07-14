"use client";

import type { TrailStep } from "@/lib/types";
import { layoutMeander } from "@/lib/trailmap";

// The trail map: a gently meandering vertical spine (see CLAUDE.md §6 + the
// drift-spec trail-map section). Geometry comes from the pure `layoutMeander`;
// this component only paints it. Edges show *how* you travelled — solid/sage for
// a thread you pulled, dotted/grey for a drift — matching the top-bar TrailRail
// language. Reused unchanged by the in-session end screen and (later) My Trails.

const WIDTH = 540;
const GAP = 14; // space between a node and its title column
const PAD_X = 16; // outer horizontal padding for title columns

function NodeThumb({ step, isEndpoint }: { step: TrailStep; isEndpoint: boolean }) {
  const { card } = step;
  const ring = step.expanded
    ? "ring-2 ring-accent shadow-[0_0_0_4px_rgba(111,143,116,0.18)]" // read-more glow (dormant until M5)
    : isEndpoint
      ? "ring-2 ring-accent/50"
      : "ring-1 ring-line";
  return (
    <div
      className={`h-14 w-14 overflow-hidden rounded-full bg-accent/10 ${ring}`}
      title={card.displayTitle}
    >
      {card.imageUrl ? (
        <img
          src={card.imageUrl}
          alt={card.displayTitle}
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="font-serif text-2xl text-accent/50">
            {card.displayTitle.charAt(0)}
          </span>
        </div>
      )}
    </div>
  );
}

export function TrailMap({
  steps,
  mapRef,
}: {
  steps: TrailStep[];
  mapRef?: React.Ref<HTMLDivElement>;
}) {
  const layout = layoutMeander(steps, { width: WIDTH });

  if (steps.length === 0) {
    return (
      <p className="py-8 text-center text-sm italic text-ink-soft">
        No stops yet — start drifting.
      </p>
    );
  }

  return (
    <div className="mx-auto overflow-x-auto">
      <div
        ref={mapRef}
        className="relative"
        style={{ width: layout.width, height: layout.height }}
      >
        {/* Connector layer. */}
        <svg
          width={layout.width}
          height={layout.height}
          className="absolute inset-0"
          aria-hidden="true"
        >
          {layout.segments.map((seg, i) => (
            <path
              key={i}
              d={seg.d}
              fill="none"
              stroke={seg.kind === "thread" ? "var(--accent)" : "var(--ink)"}
              strokeOpacity={seg.kind === "thread" ? 0.75 : 0.28}
              strokeWidth={seg.kind === "thread" ? 2.5 : 2}
              strokeDasharray={seg.kind === "drift" ? "2 7" : undefined}
              strokeLinecap="round"
            />
          ))}
        </svg>

        {/* Edge labels (thread labels sit at the segment midpoint). */}
        {layout.segments.map((seg, i) => {
          if (seg.kind !== "thread" || !seg.label) return null;
          const a = layout.nodes[i];
          const b = layout.nodes[i + 1];
          const midX = (a.cx + b.cx) / 2;
          const midY = (a.cy + b.cy) / 2;
          return (
            <span
              key={`lbl-${i}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent-strong ring-1 ring-accent/25"
              style={{ left: midX, top: midY }}
            >
              {seg.label}
            </span>
          );
        })}

        {/* Nodes + titles. */}
        {layout.nodes.map((n, i) => {
          const step = steps[i];
          const isEndpoint = i === 0 || i === steps.length - 1;
          const isLeft = n.side === "left";

          // Title column hugs the node on its outer side.
          const titleStyle: React.CSSProperties = isLeft
            ? {
                top: n.cy,
                right: layout.width - (n.cx - layout.nodeSize / 2 - GAP),
                width: n.cx - layout.nodeSize / 2 - GAP - PAD_X,
                textAlign: "right",
              }
            : {
                top: n.cy,
                left: n.cx + layout.nodeSize / 2 + GAP,
                width:
                  layout.width - PAD_X - (n.cx + layout.nodeSize / 2 + GAP),
                textAlign: "left",
              };

          return (
            <div key={`${step.card.pageTitle}-${i}`}>
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: n.cx, top: n.cy }}
              >
                <NodeThumb step={step} isEndpoint={isEndpoint} />
              </div>

              <div
                className="absolute -translate-y-1/2"
                style={titleStyle}
              >
                <p className="truncate font-serif text-sm leading-snug text-ink">
                  {step.card.displayTitle}
                </p>
                {i === 0 && (
                  <p className="text-[11px] uppercase tracking-wide text-ink-soft">
                    Started here
                  </p>
                )}
                {i === steps.length - 1 && i !== 0 && (
                  <p className="text-[11px] uppercase tracking-wide text-accent-strong">
                    You are here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
