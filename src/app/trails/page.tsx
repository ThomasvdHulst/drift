"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Trail } from "@/lib/types";
import {
  listTrails,
  deleteTrail,
  listSessions,
  subscribeStore,
} from "@/lib/storage";
import { getRealm } from "@/lib/realms";
import type { RealmId } from "@/lib/realms/types";
import { TrailSparkline } from "@/components/TrailSparkline";

type Filter = "all" | "liked";
type Weekly = { sessions: number; avgMin: number };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MyTrailsPage() {
  const [trails, setTrails] = useState<Trail[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [realmFilter, setRealmFilter] = useState<RealmId | "all">("all");
  const [weekly, setWeekly] = useState<Weekly | null>(null);

  useEffect(() => {
    listTrails().then(setTrails);
    // Personal stats: sessions in the last 7 days (Date.now() in an effect is fine).
    listSessions().then((ss) => {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent = ss.filter((s) => s.startedAt >= weekAgo);
      if (recent.length === 0) return;
      const avgMs =
        recent.reduce((n, s) => n + (s.durationMs ?? 0), 0) / recent.length;
      setWeekly({
        sessions: recent.length,
        avgMin: Math.max(1, Math.round(avgMs / 60000)),
      });
    });
    // Refresh when the cloud replicator merges in trails from another device.
    return subscribeStore((e) => {
      if (e.store === "trails") listTrails().then(setTrails);
    });
  }, []);

  async function handleDelete(id: string) {
    await deleteTrail(id);
    setTrails((ts) => (ts ? ts.filter((t) => t.id !== id) : ts));
  }

  const shown =
    trails?.filter(
      (t) =>
        (filter === "liked" ? t.liked : true) &&
        (realmFilter === "all" ? true : getRealm(t.realm).id === realmFilter),
    ) ?? [];
  const likedCount = trails?.filter((t) => t.liked).length ?? 0;
  // Realms that actually have saved trails (drives the optional realm chips).
  const realmsPresent = Array.from(
    new Set((trails ?? []).map((t) => getRealm(t.realm).id)),
  ).map((id) => getRealm(id));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm text-ink-soft transition hover:text-accent-strong"
          >
            ← Drift
          </Link>
          <h1 className="mt-1 font-serif text-4xl text-ink">My Trails</h1>
          {weekly && (
            <p className="mt-1 text-sm text-ink-soft">
              This week: {weekly.sessions}{" "}
              {weekly.sessions === 1 ? "session" : "sessions"} · avg{" "}
              {weekly.avgMin} min
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/atlas"
            className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Atlas
          </Link>
          <Link
            href="/interests"
            className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Interests
          </Link>
          <Link
            href="/drift"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
          >
            Start drifting →
          </Link>
        </div>
      </header>

      {trails && trails.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(["all", "liked"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition ${
                filter === f
                  ? "bg-ink text-paper"
                  : "border border-line text-ink-soft hover:border-accent/50 hover:text-ink"
              }`}
            >
              {f === "liked" ? `Liked (${likedCount})` : "All"}
            </button>
          ))}
          {/* Realm chips — only when trails span more than one realm. Clicking an
              active realm clears back to all. Each chip glows in its own accent. */}
          {realmsPresent.length > 1 && (
            <>
              <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
              {realmsPresent.map((r) => {
                const on = realmFilter === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    data-realm={r.id}
                    onClick={() => setRealmFilter(on ? "all" : r.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      on
                        ? "bg-accent/15 text-accent-strong ring-1 ring-accent/30"
                        : "border border-line text-ink-soft hover:border-accent/50 hover:text-ink"
                    }`}
                  >
                    <span aria-hidden="true">{r.glyph}</span>
                    {r.label}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {trails === null ? (
        <p className="mt-16 text-center text-ink-soft">Loading your trails…</p>
      ) : trails.length === 0 ? (
        <div className="mt-20 flex flex-col items-center gap-4 text-center">
          <p className="max-w-sm text-ink-soft">
            No saved trails yet. Wander a while, then tap{" "}
            <span className="font-medium text-ink">End &amp; view trail</span> to
            keep one.
          </p>
          <Link
            href="/drift"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
          >
            Start drifting →
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="mt-16 text-center text-ink-soft">
          No liked trails yet.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => {
            const realm = getRealm(t.realm);
            return (
            <li
              key={t.id}
              data-realm={realm.id}
              className="group relative flex flex-col rounded-2xl bg-paper-raised p-5 shadow-sm ring-1 ring-line transition hover:shadow-md"
            >
              <Link href={`/trails/${t.id}`} className="flex flex-1 flex-col">
                <TrailSparkline steps={t.steps} className="h-11 w-full" />
                <span className="mt-3 inline-flex w-fit items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-accent-strong">
                  <span aria-hidden="true">{realm.glyph}</span>
                  {realm.label}
                </span>
                <h2 className="mt-1.5 line-clamp-2 font-serif text-lg leading-snug text-ink">
                  {t.name}
                </h2>
                <p className="mt-1 text-xs text-ink-soft">
                  {formatDate(t.createdAt)} · {t.steps.length}{" "}
                  {t.steps.length === 1 ? "stop" : "stops"}
                </p>
              </Link>
              <div className="mt-3 flex items-center justify-between">
                {t.liked ? (
                  <span className="text-accent-strong" aria-label="Liked">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
                    </svg>
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  className="text-xs text-ink-soft opacity-0 transition hover:text-accent-strong group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
