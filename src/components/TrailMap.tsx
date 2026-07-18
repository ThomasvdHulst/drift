"use client";

import { useState } from "react";
import type { TrailStep } from "@/lib/types";
import { layoutMeander } from "@/lib/trailmap";
import { cardSource } from "@/lib/card";
import { realmOfSource } from "@/lib/crossrealm";
import { KindIcon, DoorwayIcon } from "./ThreadChips";

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
  // Fall back to the serif initial if the thumbnail fails to load (e.g. a rare
  // AIC image that doesn't send CORS headers — the crossOrigin is needed so PNG
  // export stays untainted).
  const [imgFailed, setImgFailed] = useState(false);
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
      {card.imageUrl && !imgFailed ? (
        <img
          src={card.imageUrl}
          alt={card.displayTitle}
          crossOrigin="anonymous"
          onError={() => setImgFailed(true)}
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
        No stops yet. Start drifting.
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
          {layout.segments.map((seg, i) => {
            // Each edge is tinted by the realm of the node it leads INTO (so a
            // trail that weaves realms shows sage + terracotta stretches). A
            // realm-crossing hop is drawn as a fine dashed "bridge".
            const destRealm = realmOfSource(cardSource(steps[i + 1].card));
            return (
              <g key={i} data-realm={destRealm}>
                <path
                  d={seg.d}
                  fill="none"
                  stroke={seg.kind === "drift" && !seg.crossRealm ? "var(--ink)" : "var(--accent)"}
                  strokeOpacity={seg.crossRealm ? 0.5 : seg.kind === "thread" ? 0.75 : 0.28}
                  strokeWidth={seg.kind === "thread" && !seg.crossRealm ? 2.5 : 2}
                  strokeDasharray={
                    seg.crossRealm ? "1 5" : seg.kind === "drift" ? "2 7" : undefined
                  }
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>

        {/* Edge badges: a thread label, or a doorway mark on a realm crossing. */}
        {layout.segments.map((seg, i) => {
          const isThread = seg.kind === "thread" && !!seg.label;
          if (!seg.crossRealm && !isThread) return null;
          const a = layout.nodes[i];
          const b = layout.nodes[i + 1];
          const midX = (a.cx + b.cx) / 2;
          const midY = (a.cy + b.cy) / 2;
          const destRealm = realmOfSource(cardSource(steps[i + 1].card));
          return (
            <span
              key={`lbl-${i}`}
              data-realm={destRealm}
              className="absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent-strong ring-1 ring-accent/25"
              style={{ left: midX, top: midY }}
            >
              {seg.crossRealm ? (
                <DoorwayIcon size={11} />
              ) : (
                seg.threadKind && <KindIcon kind={seg.threadKind} size={11} />
              )}
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
            <div key={`${step.card.pageTitle}-${i}`} data-realm={realmOfSource(cardSource(step.card))}>
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
