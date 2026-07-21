"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AtlasLayout, AtlasLayoutNode } from "@/lib/atlas";
import { exportTrailPng } from "@/lib/export-image";
import { realmOfSource } from "@/lib/crossrealm";
import { getRealm } from "@/lib/realms";
import { DoorwayIcon } from "./ThreadChips";

export interface AtlasHandle {
  exportPng: (filename: string) => Promise<void>;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// The Atlas — a living "clustered galaxies" constellation of every saved trail.
// Geometry comes from the pure layoutConstellation; this paints it, tints each
// star by its OWN realm (so a trail that weaves realms shows both colours), draws
// realm-crossings as bridges, and opens a calm detail card when you tap a star.
export const Atlas = forwardRef<
  AtlasHandle,
  {
    layout: AtlasLayout;
    onRevisit?: (node: AtlasLayoutNode) => void;
    onDriftFrom?: (node: AtlasLayoutNode) => void;
  }
>(function Atlas({ layout, onRevisit, onDriftFrom }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null); // export target (holds the SVG)
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<AtlasLayoutNode | null>(null);

  const posById = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setZoom(clamp(el.clientWidth / layout.width, 0.3, 1));
  }, [layout]);

  useImperativeHandle(
    ref,
    () => ({
      exportPng: async (filename: string) => {
        if (!canvasRef.current) return;
        const prev = zoom;
        setZoom(1); // export at natural scale, whole atlas
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r(null))),
        );
        // Bake a calm title + date into the exported image only.
        const cap = document.createElement("div");
        cap.textContent = `Your Atlas · ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`;
        cap.style.cssText =
          "position:absolute;top:14px;left:18px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:var(--ink);opacity:.5;z-index:5;pointer-events:none;";
        canvasRef.current.appendChild(cap);
        try {
          await exportTrailPng(canvasRef.current, filename);
        } finally {
          cap.remove();
          setZoom(prev);
        }
      },
    }),
    [zoom],
  );

  // Drag-to-pan by nudging the scroll container.
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    const el = scrollRef.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = scrollRef.current;
    if (!drag.current || !el) return;
    el.scrollLeft = drag.current.sl - (e.clientX - drag.current.x);
    el.scrollTop = drag.current.st - (e.clientY - drag.current.y);
  }
  function endDrag() {
    drag.current = null;
  }

  const w = layout.width * zoom;
  const h = layout.height * zoom;

  return (
    <div className="relative">
      {/* Zoom controls (calm, no labels shouting). */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
        {[
          { k: "+", f: () => setZoom((z) => clamp(z * 1.2, 0.3, 2.5)) },
          { k: "−", f: () => setZoom((z) => clamp(z / 1.2, 0.3, 2.5)) },
          {
            k: "⤢",
            f: () => {
              const el = scrollRef.current;
              if (el) setZoom(clamp(el.clientWidth / layout.width, 0.3, 1));
            },
          },
        ].map((b) => (
          <button
            key={b.k}
            type="button"
            onClick={b.f}
            aria-label={
              b.k === "+" ? "Zoom in" : b.k === "−" ? "Zoom out" : "Fit to screen"
            }
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft shadow-sm transition hover:border-accent/50 hover:text-accent-strong"
          >
            {b.k}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="h-[70vh] cursor-grab touch-none overflow-auto rounded-2xl bg-paper-raised ring-1 ring-line active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div ref={canvasRef} style={{ width: w, height: h }} className="relative bg-paper-raised">
          <svg
            width={w}
            height={h}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label="Atlas of your trails"
          >
            {/* Edges. A realm-crossing hop is drawn as a fine dashed "bridge". */}
            <g>
              {layout.edges.map((e, i) => {
                const a = posById.get(e.fromId);
                const b = posById.get(e.toId);
                if (!a || !b) return null;
                const cross =
                  realmOfSource(a.source) !== realmOfSource(b.source);
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--ink)"
                    strokeOpacity={cross ? 0.34 : e.kind === "thread" ? 0.26 : 0.12}
                    strokeWidth={cross ? 1.4 : e.kind === "thread" ? 1.3 : 1}
                    strokeDasharray={
                      cross ? "1 4" : e.kind === "drift" ? "2 6" : undefined
                    }
                    strokeLinecap="round"
                  />
                );
              })}
            </g>

            {/* Cluster nebula halos + labels, each tinted by its realm. */}
            {layout.clusters.map((c) => (
              <g key={c.key} data-realm={c.realm}>
                <circle
                  cx={c.cx}
                  cy={c.cy}
                  r={c.radius}
                  fill="var(--accent)"
                  fillOpacity={0.06}
                  stroke="var(--accent)"
                  strokeOpacity={0.16}
                />
                <text
                  x={c.cx}
                  y={c.cy - c.radius - 8}
                  textAnchor="middle"
                  fill="var(--accent-strong)"
                  className="text-[13px] font-medium"
                >
                  {c.label}
                </text>
              </g>
            ))}

            {/* Stars — each tinted by its OWN realm, with a soft glow. */}
            {layout.nodes.map((n) => {
              const isSel = selected?.id === n.id;
              return (
                <g
                  key={n.id}
                  data-realm={realmOfSource(n.source)}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(n)}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.r * 2.1}
                    fill="var(--accent)"
                    fillOpacity={isSel ? 0.3 : 0.14}
                  />
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.r}
                    fill="var(--accent)"
                    fillOpacity={0.85}
                    stroke={isSel ? "var(--accent-strong)" : "var(--paper-raised)"}
                    strokeWidth={isSel ? 2 : 1}
                  >
                    <title>
                      {n.title} · in {n.visits} {n.visits === 1 ? "trail" : "trails"}
                    </title>
                  </circle>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* A calm detail card for the tapped star: bottom-sheet on phones, centred
          card on desktop. */}
      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/30 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            data-realm={realmOfSource(selected.source)}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto w-full max-w-sm rounded-t-2xl bg-paper-raised p-5 shadow-xl ring-1 ring-line pb-safe sm:rounded-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-accent/10 ring-1 ring-line">
                {selected.imageUrl ? (
                  <img
                    src={selected.imageUrl}
                    alt={selected.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-serif text-2xl text-accent/50">
                    {selected.title.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-accent-strong">
                  {getRealm(realmOfSource(selected.source)).label} · in {selected.visits}{" "}
                  {selected.visits === 1 ? "trail" : "trails"}
                </p>
                <h3 className="mt-0.5 font-serif text-lg leading-snug text-ink">
                  {selected.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="shrink-0 text-ink-soft transition hover:text-ink"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {onRevisit && (
                <button
                  type="button"
                  onClick={() => onRevisit(selected)}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
                >
                  Revisit trail
                </button>
              )}
              {onDriftFrom && (
                <button
                  type="button"
                  onClick={() => onDriftFrom(selected)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 px-4 py-2 text-sm font-medium text-accent-strong transition hover:bg-accent/10"
                >
                  <DoorwayIcon size={13} />
                  Drift from here
                </button>
              )}
              <a
                href={selected.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft underline decoration-line underline-offset-4 transition hover:text-accent-strong"
              >
                Source ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
