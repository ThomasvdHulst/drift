"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { listTrails, getSettings, setSettings } from "@/lib/storage";
import { pickRandom } from "@/lib/pick";
import { listRealms, getRealm } from "@/lib/realms";
import type { RealmId, SeedTile } from "@/lib/realms/types";
import { RealmTabs } from "@/components/RealmTabs";
import { useAuth } from "@/components/AuthProvider";
import { Wordmark } from "@/components/BrandLogo";

export default function Home() {
  const router = useRouter();
  const { cloudConfigured } = useAuth();
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
          A calm feed of knowledge cards where <em>you</em> are the algorithm —
          no autoplay, no hidden ranking. Pick a realm, pick a direction, or let
          curiosity surprise you.
        </p>

        <div className="mt-7">
          <RealmTabs realms={realms} active={active} onSelect={selectRealm} />
        </div>
      </header>

      {/* Active realm panel — data-realm scopes the accent to this realm. */}
      <section data-realm={active} className="mt-8 flex flex-col items-center">
        <p className="max-w-md text-center text-sm text-ink-soft">{realm.blurb}</p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
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
              : "Just drift — read freely, nothing saved. You can still send single cards, or keep a trail anytime."}
          </p>
        </div>

        <h2 className="mb-4 mt-10 text-center text-xs font-medium uppercase tracking-widest text-ink-soft">
          Or start somewhere
        </h2>
        <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
      </footer>
    </main>
  );
}
