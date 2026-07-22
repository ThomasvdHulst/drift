"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { listTrails, getSettings, setSettings } from "@/lib/storage";
import { pickRandom } from "@/lib/pick";
import { TOPICS, type Topic } from "@/lib/topics";
import { CURRENT_SECTIONS } from "@/lib/current";
import { focusToParams, type Focus } from "@/lib/focus";
import { listRealms, getRealm } from "@/lib/realms";
import type { RealmId, SeedTile } from "@/lib/realms/types";
import { RealmTabs } from "@/components/RealmTabs";
import { OrbitSearch } from "@/components/OrbitSearch";
import { TileGrid } from "@/components/TileGrid";
import { TileDisclosure } from "@/components/TileDisclosure";
import { useAuth } from "@/components/AuthProvider";
import { useTour } from "@/components/tour/TourProvider";
import { Wordmark } from "@/components/BrandLogo";

export default function Home() {
  const router = useRouter();
  const { cloudConfigured } = useAuth();
  const { start: startTour } = useTour();
  const [stats, setStats] = useState<{ trails: number; stops: number } | null>(
    null,
  );
  const [active, setActive] = useState<RealmId>("encyclopedia");
  // Whether new drift sessions build a saveable trail (default) or are a
  // lightweight "just drift" with the trail framing removed. Remembered in
  // settings; toggled below the "Surprise me" button.
  const [keepTrail, setKeepTrail] = useState(true);
  const realms = useMemo(() => listRealms(), []);
  const realm = getRealm(active);
  const fieldTiles = useMemo(
    () =>
      TOPICS.map((t) => ({
        id: t.id,
        label: t.label,
        glyph: t.glyph,
        blurb: t.blurb,
        tint: t.tint,
      })),
    [],
  );
  const newsTiles = useMemo(
    () =>
      CURRENT_SECTIONS.map((s) => ({
        id: s.id,
        label: s.label,
        glyph: s.glyph,
        blurb: s.blurb,
        tint: s.tint,
      })),
    [],
  );

  useEffect(() => {
    listTrails().then((ts) => {
      if (ts.length === 0) return setStats(null);
      setStats({
        trails: ts.length,
        stops: ts.reduce((n, t) => n + t.steps.length, 0),
      });
    });
    getSettings().then((s) => {
      if (s.lastRealm && getRealm(s.lastRealm).id === s.lastRealm)
        setActive(s.lastRealm);
      setKeepTrail(s.sessionMode !== "endless");
    });
  }, []);

  function selectRealm(id: RealmId) {
    setActive(id);
    setSettings({ lastRealm: id });
  }

  function toggleKeepTrail() {
    const next = !keepTrail;
    setKeepTrail(next);
    setSettings({ sessionMode: next ? "trail" : "endless" });
  }

  function openSeed(tile: SeedTile) {
    const params = new URLSearchParams({ realm: active, seed: tile.label });
    if (tile.titles && tile.titles.length > 0) {
      params.set("title", pickRandom(tile.titles) ?? tile.titles[0]);
    } else if (tile.bucket) {
      params.set("bucket", tile.bucket);
    }
    if (!keepTrail) params.set("mode", "endless");
    router.push(`/drift?${params.toString()}`);
  }

  // Start a "focused drift" confined to one field (Phase 18, Encyclopedia only):
  // drift stays within this ORES topic instead of wandering the whole encyclopedia.
  function openField(topic: Topic) {
    startFocusedDrift({
      kind: "field",
      bucket: topic.keyword,
      label: topic.label,
    });
  }

  // Start a page orbit (Phase 18, Encyclopedia only): begin at this page and
  // drift in its widening neighbourhood.
  function openOrbit(title: string) {
    startFocusedDrift({ kind: "orbit", seedTitle: title, seedLabel: title });
  }

  // Start an "in the news" drift (Phase 23, Encyclopedia only): the Wikipedia
  // articles behind this month's stories in one subject.
  function openCurrent(sectionId: string) {
    const section = CURRENT_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;
    startFocusedDrift({
      kind: "current",
      section: section.id,
      label: section.label,
    });
  }

  // Both focused-drift entry points share one encoding — `focusToParams` in
  // lib/focus.ts, the same module /drift parses with. Hand-rolling the params
  // here (as this page used to) meant the writer and the reader could silently
  // drift apart.
  function startFocusedDrift(focus: Focus) {
    const params = new URLSearchParams({
      realm: "encyclopedia",
      ...focusToParams(focus),
    });
    if (!keepTrail) params.set("mode", "endless");
    router.push(`/drift?${params.toString()}`);
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-6 py-12 sm:py-16">
      <header className="flex flex-col items-center text-center">
        <h1>
          <Wordmark className="h-24 sm:h-28" />
        </h1>
        <p className="-mt-1 text-lg text-ink-soft sm:text-xl">
          Pull a thread. See where it goes.
        </p>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink/75">
          A calm feed of knowledge cards where <em>you</em> are the algorithm.
          No autoplay, no hidden ranking. Pick a realm, pick a direction, or let
          curiosity surprise you.
        </p>

        <div className="mt-7" data-tour="realm-tabs">
          <RealmTabs realms={realms} active={active} onSelect={selectRealm} />
        </div>
      </header>

      {/* Active realm panel — data-realm scopes the accent to this realm. */}
      <section data-realm={active} className="mt-8 flex flex-col items-center">
        <p className="max-w-md text-center text-sm text-ink-soft">{realm.blurb}</p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            data-tour="drift-cta"
            onClick={() =>
              router.push(
                `/drift?realm=${active}${keepTrail ? "" : "&mode=endless"}`,
              )
            }
            className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong"
          >
            Surprise me in {realm.label}
            <span aria-hidden="true">→</span>
          </button>
        </div>

        {/* Session mode: a calm toggle. On = build a saveable trail (Drift's
            default shape); off = "just drift" — read freely, nothing saved. */}
        <div className="mt-5 flex flex-col items-center gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={keepTrail}
            onClick={toggleKeepTrail}
            className="inline-flex items-center gap-2.5 text-sm text-ink-soft transition hover:text-ink"
          >
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                keepTrail ? "bg-accent" : "bg-ink/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper-raised shadow transition-all ${
                  keepTrail ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </span>
            <span className="font-medium">Keep a trail of this session</span>
          </button>
          <p className="max-w-xs text-center text-xs leading-snug text-ink/55">
            {keepTrail
              ? "Your wander is mapped into a trail you can save and share."
              : "Just drift. Read freely, nothing saved. You can still send single cards, or keep a trail anytime."}
          </p>
        </div>

        {/* Directed drift (Phase 18): start a page orbit. A search bar to begin
            at any page and spiral outward from it. Encyclopedia only. */}
        {active === "encyclopedia" && (
          <div
            data-tour="orbit-search"
            className="mt-9 flex w-full flex-col items-center gap-2"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
              Or drift around a page
            </p>
            <OrbitSearch onPick={openOrbit} />
          </div>
        )}

        {/* Focused drift (Phase 18): confine drift to one broad field. One card
            per field, in the same shape as the seed cards below, inside a calm
            disclosure so 28 of them never crowd the default "surprise me" flow.
            Encyclopedia only (fields are Wikipedia's ORES topics). */}
        {active === "encyclopedia" ? (
          <>
            <TileDisclosure
              className="mt-9"
              label="Or drift within a field"
              tourId="field-focus"
              tiles={fieldTiles}
              onPick={(id) => {
                const topic = TOPICS.find((t) => t.id === id);
                if (topic) openField(topic);
              }}
            />
            {/* "In the news" (Phase 23): the Wikipedia articles behind this
                month's stories, by subject. Never the news itself — the source is
                Wikipedia's own Portal:Current events (see lib/current.ts). */}
            <TileDisclosure
              className="mt-9"
              label="Or drift what's in the news"
              tourId="news-focus"
              tiles={newsTiles}
              onPick={openCurrent}
            />
          </>
        ) : (
          <>
            <h2 className="mb-4 mt-10 text-center text-xs font-medium uppercase tracking-widest text-ink-soft">
              Or start somewhere
            </h2>
            <TileGrid
              data-tour="start-options"
              tiles={realm.seeds.map((s) => ({ ...s, id: s.label }))}
              onPick={(id) => {
                const tile = realm.seeds.find((s) => s.label === id);
                if (tile) openSeed(tile);
              }}
            />
          </>
        )}
      </section>

      <footer className="mt-12 flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/trails"
            className="rounded-full border border-line bg-paper-raised px-6 py-2.5 text-base font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            My Trails
          </Link>
          <Link
            href="/atlas"
            className="rounded-full border border-line bg-paper-raised px-6 py-2.5 text-base font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Atlas
          </Link>
          <Link
            href="/interests"
            className="rounded-full border border-line bg-paper-raised px-6 py-2.5 text-base font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Interests
          </Link>
          <button
            type="button"
            onClick={startTour}
            className="rounded-full border border-line bg-paper-raised px-6 py-2.5 text-base font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Take a tour
          </button>
          {cloudConfigured && (
            <>
              <Link
                href="/friends"
                className="rounded-full border border-line bg-paper-raised px-6 py-2.5 text-base font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
              >
                Friends
              </Link>
              <Link
                href="/inbox"
                className="rounded-full border border-line bg-paper-raised px-6 py-2.5 text-base font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
              >
                Inbox
              </Link>
            </>
          )}
        </div>
        {stats && (
          <p className="text-sm text-ink-soft">
            You&apos;ve saved {stats.trails}{" "}
            {stats.trails === 1 ? "trail" : "trails"} · {stats.stops}{" "}
            {stats.stops === 1 ? "stop" : "stops"} mapped.
          </p>
        )}
        <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-ink-soft">
          <Link
            href="/install"
            className="underline-offset-2 transition hover:text-accent-strong hover:underline"
          >
            On your phone? Add Drift to your home screen
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/contact"
            className="underline-offset-2 transition hover:text-accent-strong hover:underline"
          >
            Get in touch
          </Link>
        </p>
      </footer>
    </main>
  );
}
