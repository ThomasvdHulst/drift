"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { listTrails, getSettings, setSettings } from "@/lib/storage";
import { pickRandom } from "@/lib/pick";
import { TOPICS, type Topic } from "@/lib/topics";
import { listRealms, getRealm } from "@/lib/realms";
import type { RealmId, SeedTile } from "@/lib/realms/types";
import { RealmTabs } from "@/components/RealmTabs";
import { OrbitSearch } from "@/components/OrbitSearch";
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
    const params = new URLSearchParams({
      realm: "encyclopedia",
      focus: "field",
      bucket: topic.keyword,
      seed: topic.label,
    });
    if (!keepTrail) params.set("mode", "endless");
    router.push(`/drift?${params.toString()}`);
  }

  // Start a page orbit (Phase 18, Encyclopedia only): begin at this page and
  // drift in its widening neighbourhood.
  function openOrbit(title: string) {
    const params = new URLSearchParams({
      realm: "encyclopedia",
      focus: "orbit",
      title,
      seed: title,
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

        {/* Focused drift (Phase 18): confine drift to one broad field. A calm
            disclosure so it doesn't crowd the default "surprise me" flow.
            Encyclopedia only (fields are Wikipedia's ORES topics). */}
        {active === "encyclopedia" && (
          <details data-tour="field-focus" className="group mt-9 w-full">
            <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-ink-soft transition hover:text-accent-strong">
              Or drift within a field
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="transition-transform group-open:rotate-180"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <ul className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
              {TOPICS.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openField(t)}
                    className="rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-sm text-ink transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent-strong"
                  >
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        <h2 className="mb-4 mt-10 text-center text-xs font-medium uppercase tracking-widest text-ink-soft">
          Or start somewhere
        </h2>
        <ul
          data-tour="start-options"
          className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {realm.seeds.map((tile) => (
            <li key={tile.label}>
              <button
                type="button"
                onClick={() => openSeed(tile)}
                style={{
                  backgroundColor: `color-mix(in srgb, ${tile.tint} 45%, var(--paper-raised))`,
                }}
                className="group flex h-full w-full flex-col rounded-2xl p-5 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="font-serif text-2xl text-ink/70" aria-hidden="true">
                  {tile.glyph}
                </span>
                <span className="mt-3 font-serif text-xl leading-tight text-ink">
                  {tile.label}
                </span>
                <span className="mt-1 text-xs leading-snug text-ink/60">
                  {tile.blurb}
                </span>
              </button>
            </li>
          ))}
        </ul>
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
            {stats.trails === 1 ? "trail" : "trails"} · {stats.stops} stops
            mapped.
          </p>
        )}
        <Link
          href="/install"
          className="text-xs text-ink-soft underline-offset-2 transition hover:text-accent-strong hover:underline"
        >
          On your phone? Add Drift to your home screen
        </Link>
      </footer>
    </main>
  );
}
