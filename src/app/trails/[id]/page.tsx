"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Trail } from "@/lib/types";
import {
  getTrail,
  deleteTrail,
  renameTrail,
  setTrailLiked,
} from "@/lib/storage";
import { computeTrailStats, formatDuration } from "@/lib/stats";
import { trailToText } from "@/lib/export";
import { exportTrailPng } from "@/lib/export-image";
import { getRealm } from "@/lib/realms";
import { trailRealms } from "@/lib/crossrealm";
import { TrailMap } from "@/components/TrailMap";
import { useAuth } from "@/components/AuthProvider";
import { ShareToFriend } from "@/components/ShareToFriend";
import { trailToSharePayload } from "@/lib/social/share";

export default function TrailDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const { user, cloudConfigured } = useAuth();
  const [trail, setTrail] = useState<Trail | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  async function handleExport() {
    if (!mapRef.current) return;
    const fname = (name.trim() || "drift-trail").slice(0, 48);
    try {
      await exportTrailPng(mapRef.current, `${fname}.png`);
    } catch {
      /* non-fatal */
    }
  }

  async function handleCopy() {
    if (!trail) return;
    try {
      await navigator.clipboard.writeText(
        trailToText({ ...trail, name: name.trim() || trail.name }),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* non-fatal */
    }
  }

  useEffect(() => {
    getTrail(id).then((t) => {
      setTrail(t);
      if (t) {
        setName(t.name);
        setLiked(t.liked);
      }
    });
  }, [id]);

  function commitRename() {
    const finalName = name.trim() || (trail ? trail.name : "Untitled trail");
    setName(finalName);
    renameTrail(id, finalName);
  }

  function toggleLike() {
    const next = !liked;
    setLiked(next);
    setTrailLiked(id, next);
  }

  async function handleDelete() {
    await deleteTrail(id);
    router.push("/trails");
  }

  if (trail === undefined) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-ink-soft">Loading trail…</p>
      </main>
    );
  }

  if (trail === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <p className="text-ink-soft">That trail could not be found.</p>
        <Link
          href="/trails"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
        >
          ← My Trails
        </Link>
      </main>
    );
  }

  const stats = computeTrailStats(trail.steps);
  // A trail can span both realms (Phase 15); the page tints by its starting realm
  // (the map itself tints per-node), and the label names every realm it weaves.
  const realms = trailRealms(trail).map((id) => getRealm(id));
  const realm = realms[0];
  const statLine = [
    `${stats.stops} ${stats.stops === 1 ? "stop" : "stops"}`,
    formatDuration(stats.durationMs),
    `${stats.threadsPulled} ${stats.threadsPulled === 1 ? "thread" : "threads"} pulled`,
  ].join(" · ");

  return (
    // data-realm tints the trail-map edges + accents to the realm this trail was
    // drifted in (sage for Encyclopedia, terracotta for Gallery).
    <main
      data-realm={realm.id}
      className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-8"
    >
      <Link
        href="/trails"
        className="text-sm text-ink-soft transition hover:text-accent-strong"
      >
        ← My Trails
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="mb-1 inline-flex w-fit items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-accent-strong">
            <span aria-hidden="true">{realms.map((r) => r.glyph).join(" ")}</span>
            {realms.map((r) => r.label).join(" + ")}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            aria-label="Trail name"
            className="w-full rounded-lg bg-transparent font-serif text-3xl leading-tight text-ink outline-none transition focus:bg-paper-raised focus:ring-1 focus:ring-accent/40"
          />
          <p className="mt-1 text-sm text-ink-soft">{statLine}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/drift?continue=${trail.id}`}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
        >
          Continue this trail →
        </Link>
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? "var(--accent-strong)" : "none"} stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
          </svg>
          {liked ? "Liked" : "Like"}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50"
        >
          Export image
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50"
        >
          {copied ? "Copied ✓" : "Copy as text"}
        </button>
        {cloudConfigured && user && (
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Send to a friend
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className="ml-auto text-sm text-ink-soft transition hover:text-accent-strong"
        >
          Delete
        </button>
      </div>

      {sharing && trail && (
        <ShareToFriend
          kind="trail"
          payload={trailToSharePayload(trail)}
          label={trail.name}
          onClose={() => setSharing(false)}
        />
      )}

      <div className="mt-8 rounded-2xl bg-paper-raised p-4 shadow-sm ring-1 ring-line">
        <TrailMap steps={trail.steps} mapRef={mapRef} />
      </div>
    </main>
  );
}
