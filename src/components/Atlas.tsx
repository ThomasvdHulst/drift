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

export interface AtlasHandle {
  exportPng: (filename: string) => Promise<void>;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// The Atlas — "clustered galaxies" constellation of every saved trail. Geometry
// comes from the pure layoutConstellation; this only paints + handles calm
// pan (drag / native scroll) and zoom (buttons). Read-only.
export const Atlas = forwardRef<
  AtlasHandle,
  { layout: AtlasLayout; onNodeClick?: (node: AtlasLayoutNode) => void }
>(function Atlas({ layout, onNodeClick }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null); // export target (holds the SVG)
  const [zoom, setZoom] = useState(1);

  const posById = useMemo(
    () => new Map(layout.nodes.map((n) => [n.id, n])),
    [layout],
  );

  // Fit the whole atlas to the container width on first render / layout change.
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
        try {
          await exportTrailPng(canvasRef.current, filename);
        } finally {
          setZoom(prev);
        }
      },
    }),
    [zoom],
  );

  // Drag-to-pan by nudging the scroll container (works alongside trackpad/scrollbars).
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
            aria-label={b.k === "+" ? "Zoom in" : b.k === "−" ? "Zoom out" : "Fit"}
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
        <div ref={canvasRef} style={{ width: w, height: h }} className="bg-paper-raised">
          <svg
            width={w}
            height={h}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label="Atlas of your trails"
          >
            {/* Edges (neutral / calm — realm colour lives on the nodes). */}
            <g>
              {layout.edges.map((e, i) => {
                const a = posById.get(e.fromId);
                const b = posById.get(e.toId);
                if (!a || !b) return null;
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--ink)"
                    strokeOpacity={e.kind === "thread" ? 0.28 : 0.12}
                    strokeWidth={e.kind === "thread" ? 1.3 : 1}
                    strokeDasharray={e.kind === "drift" ? "2 6" : undefined}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>

            {/* Clusters (halo + label + their nodes), each tinted by its realm. */}
            {layout.clusters.map((c) => {
              const nodes = layout.nodes.filter((n) => n.cluster === c.key);
              return (
                <g key={c.key} data-realm={c.realm}>
                  <circle
                    cx={c.cx}
                    cy={c.cy}
                    r={c.radius}
                    fill="var(--accent)"
                    fillOpacity={0.05}
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
                  {nodes.map((n) => (
                    <circle
                      key={n.id}
                      cx={n.x}
                      cy={n.y}
                      r={n.r}
                      fill="var(--accent)"
                      fillOpacity={0.6}
                      stroke="var(--paper-raised)"
                      strokeWidth={1}
                      onClick={() => onNodeClick?.(n)}
                      style={{ cursor: "pointer" }}
                    >
                      <title>
                        {n.title} · in {n.visits} {n.visits === 1 ? "trail" : "trails"}
                      </title>
                    </circle>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
});
