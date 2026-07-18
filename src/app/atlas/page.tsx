"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Trail } from "@/lib/types";
import { listTrails } from "@/lib/storage";
import {
  buildConstellation,
  layoutConstellation,
  type AtlasLayoutNode,
} from "@/lib/atlas";
import { Atlas, type AtlasHandle } from "@/components/Atlas";
import { realmOfSource } from "@/lib/crossrealm";

export default function AtlasPage() {
  const router = useRouter();
  const [trails, setTrails] = useState<Trail[] | null>(null);
  const atlasRef = useRef<AtlasHandle>(null);

  useEffect(() => {
    listTrails().then(setTrails);
  }, []);

  const built = useMemo(() => {
    if (!trails || trails.length === 0) return null;
    const graph = buildConstellation(trails);
    return { graph, layout: layoutConstellation(graph) };
  }, [trails]);

  function onRevisit(node: AtlasLayoutNode) {
    if (!trails) return;
    const containing = trails
      .filter((t) => node.trailIds.includes(t.id))
      .sort((a, b) => b.createdAt - a.createdAt);
    if (containing[0]) router.push(`/trails/${containing[0].id}`);
  }

  function onDriftFrom(node: AtlasLayoutNode) {
    const realm = realmOfSource(node.source);
    // node.id is a cardId ("source:pageTitle"); the native title is everything
    // after the first colon.
    const native = node.id.slice(node.id.indexOf(":") + 1);
    router.push(`/drift?realm=${realm}&title=${encodeURIComponent(native)}`);
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm text-ink-soft transition hover:text-accent-strong"
          >
            ← Drift
          </Link>
          <h1 className="mt-1 font-serif text-4xl text-ink">Your Atlas</h1>
          <p className="mt-1 max-w-lg text-sm text-ink-soft">
            Every trail you&apos;ve saved, drawn as one constellation: the places
            you&apos;ve wandered, clustered by topic. The shape of your curiosity.
          </p>
          {built && (
            <p className="mt-2 text-xs text-ink-soft">
              {built.graph.nodes.length}{" "}
              {built.graph.nodes.length === 1 ? "place" : "places"} ·{" "}
              {built.layout.clusters.length}{" "}
              {built.layout.clusters.length === 1 ? "cluster" : "clusters"} ·{" "}
              {trails?.length} {trails?.length === 1 ? "trail" : "trails"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/trails"
            className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            My Trails
          </Link>
          {built && (
            <button
              type="button"
              onClick={() => atlasRef.current?.exportPng("drift-atlas.png")}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
            >
              Export image
            </button>
          )}
        </div>
      </header>

      {trails === null ? (
        <p className="mt-16 text-center text-ink-soft">Building your atlas…</p>
      ) : built === null ? (
        <div className="mt-20 flex flex-col items-center gap-4 text-center">
          <p className="max-w-sm text-ink-soft">
            Your atlas fills in as you save trails. Wander a while, tap{" "}
            <span className="font-medium text-ink">End &amp; view trail</span>,
            and save one, then come back to see your constellation grow.
          </p>
          <Link
            href="/drift"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
          >
            Start drifting →
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <Atlas
            ref={atlasRef}
            layout={built.layout}
            onRevisit={onRevisit}
            onDriftFrom={onDriftFrom}
          />
          {/* Legend — quiet key to the constellation's language. */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" data-realm="encyclopedia" />
              Encyclopedia
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" data-realm="gallery" />
              Gallery
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke="currentColor" strokeWidth="1.4" /></svg>
              thread
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" /></svg>
              drift
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke="currentColor" strokeWidth="1.4" strokeDasharray="1 3" /></svg>
              realm crossing
            </span>
          </div>
          <p className="mt-2 text-center text-xs text-ink-soft">
            Drag to pan · scroll or use +/− to zoom · tap a star to revisit it or
            drift from there
          </p>
        </div>
      )}
    </main>
  );
}
