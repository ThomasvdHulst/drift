"use client";

import { useState } from "react";
import type { TrailStep } from "@/lib/types";
import { layoutMeander } from "@/lib/trailmap";
import { cardSource } from "@/lib/card";
import { realmOfSource } from "@/lib/crossrealm";
import { KindIcon, DoorwayIcon } from "./ThreadChips";
import { CC_BY_SA_4, CC0_1 } from "@/lib/licenses";

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
  // The monogram sits UNDERNEATH the thumbnail rather than instead of it, so it
  // is already there when the image is not. Two cases need that: the image failing
  // to load, and the PNG export, which strips every <img> from its clone (see
  // lib/export-image.ts for why). Rendering only one branch would have left the
  // exported map with a row of empty circles.
  const showImage = card.imageUrl && !imgFailed;
  return (
    <div
      className={`relative h-14 w-14 overflow-hidden rounded-full bg-accent/10 ${ring}`}
      title={card.displayTitle}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Decorative monogram. The title is rendered as real text beside it, so
            this carries no information; hidden from AT, which also makes it
            exempt from 1.4.3. */}
        <span className="font-serif text-2xl text-accent/50" aria-hidden="true">
          {card.displayTitle.charAt(0)}
        </span>
      </div>
      {showImage && (
        <img
          src={card.imageUrl}
          alt={card.displayTitle}
          crossOrigin="anonymous"
          onError={() => setImgFailed(true)}
          className="relative h-full w-full object-cover"
          draggable={false}
        />
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
  // The title columns are geometry once a trail forks (they have to stop before
  // the next lane), so the padding and gap go INTO the layout rather than being
  // applied on top of it here.
  const layout = layoutMeander(steps, {
    width: WIDTH,
    padX: PAD_X,
    titleGap: GAP,
  });

  if (steps.length === 0) {
    return (
      <p className="py-8 text-center text-sm italic text-ink-soft">
        No stops yet. Start drifting.
      </p>
    );
  }

  // `mapRef` wraps the map AND the credit line, because that ref is what the PNG
  // export rasterizes: the notice has to be inside the exported pixels, not beside
  // them. It shows on screen too, which is correct — displaying a trail is itself
  // a Share, and the notice belongs wherever the extracts are seen.
  return (
    <div className="mx-auto overflow-x-auto">
      <div ref={mapRef} style={{ width: layout.width }}>
      <div
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
          {layout.segments.map((seg) => {
            // Each edge is tinted by the realm of the node it leads INTO (so a
            // trail that weaves realms shows sage + terracotta stretches). A
            // realm-crossing hop is drawn as a fine dashed "bridge".
            const destRealm = realmOfSource(cardSource(steps[seg.to].card));
            return (
              <g key={seg.to} data-realm={destRealm}>
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

          {/* Doors left open (Phase 28): a short dashed spur inward from the
              node, ending in a small open ring. Unlabelled by design — the list
              below the map says what they were. */}
          {layout.stubs.map((stub) => (
            <g key={`stub-${stub.index}`} opacity={0.55}>
              <path
                d={stub.d}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray="2 4"
                strokeLinecap="round"
              />
              <circle
                cx={stub.x}
                cy={stub.y}
                r={3}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.5}
              />
            </g>
          ))}
        </svg>

        {/* Edge badges: a thread label, or a doorway mark on a realm crossing. */}
        {layout.segments.map((seg) => {
          const isThread = seg.kind === "thread" && !!seg.label;
          if (!seg.crossRealm && !isThread) return null;
          const destRealm = realmOfSource(cardSource(steps[seg.to].card));
          return (
            <span
              key={`lbl-${seg.to}`}
              data-realm={destRealm}
              className="absolute inline-flex max-w-[15rem] -translate-x-1/2 -translate-y-1/2 items-center gap-1 truncate rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent-strong ring-1 ring-accent/25"
              style={{ left: seg.labelX, top: seg.labelY }}
            >
              {seg.crossRealm ? (
                <DoorwayIcon size={11} />
              ) : (
                seg.threadKind && <KindIcon kind={seg.threadKind} size={11} />
              )}
              {/* A fork says WHEN you took it, because that is the only thing
                  separating a door you came back for from a chip you pulled at
                  the time — and the map would otherwise imply the latter. The
                  badge sits just left of the node it leads to, so it reads
                  straight into that node's title and needs no name of its own. */}
              {seg.viaDoor ? "came back for" : seg.label}
            </span>
          );
        })}

        {/* Nodes + titles. */}
        {layout.nodes.map((n, i) => {
          const step = steps[i];
          const isEndpoint = i === 0 || i === steps.length - 1;

          // Title column hugs the node on its outer side — which is the side the
          // layout picked, not the side the node sits on: once the trail forks,
          // "outer" has to mean "away from the next lane".
          const titleStyle: React.CSSProperties = {
            top: n.cy,
            left: n.titleX,
            width: n.titleW,
            textAlign: n.titleSide === "left" ? "right" : "left",
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
        <TrailMapCredit steps={steps} />
      </div>
    </div>
  );
}

/**
 * The licence line burned into the map, and therefore into the exported PNG.
 *
 * The export is the one artefact built to leave Drift, so it has to be
 * self-describing: source named, licence named and linked, and the fact that the
 * text was modified (CC BY-SA 4.0 §3(a), and §3(a)(1)(B) for the modification).
 * Images are excluded from the export entirely, which is why this can be one
 * short line rather than a per-image credit block — see lib/export-image.ts.
 *
 * The realms actually present decide the wording, so a Gallery-only trail does not
 * claim Wikipedia and vice versa.
 */
function TrailMapCredit({ steps }: { steps: TrailStep[] }) {
  const sources = new Set(steps.map((s) => cardSource(s.card)));
  const parts: React.ReactNode[] = [];
  if (sources.has("wikipedia")) {
    parts.push(
      <span key="wp">
        Titles from Wikipedia ·{" "}
        <a
          href={CC_BY_SA_4.url}
          target="_blank"
          rel="license noopener noreferrer"
          className="underline decoration-ink/30 underline-offset-2"
        >
          {CC_BY_SA_4.label}
        </a>
      </span>,
    );
  }
  if (sources.has("artic")) {
    parts.push(
      <span key="aic">
        Artworks from The Art Institute of Chicago ·{" "}
        <a
          href={CC0_1.url}
          target="_blank"
          rel="license noopener noreferrer"
          className="underline decoration-ink/30 underline-offset-2"
        >
          {CC0_1.label}
        </a>
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return (
    <p className="mt-3 px-2 text-center text-[11px] leading-relaxed text-ink-soft">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {p}
        </span>
      ))}
      <span aria-hidden="true"> · </span>
      <span>excerpted · mapped with Drift</span>
    </p>
  );
}
