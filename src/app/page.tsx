"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import seedsData from "@/data/seeds.json";
import { listTrails } from "@/lib/storage";
import { pickRandom } from "@/lib/pick";

type Seed = {
  name: string;
  glyph: string;
  tint: string;
  blurb: string;
  titles: string[];
};

const seeds = seedsData as Seed[];

// Deterministic during render; the actual random pick happens in the click
// handler (below), so no impurity here.
export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<{ trails: number; stops: number } | null>(
    null,
  );

  useEffect(() => {
    listTrails().then((ts) => {
      if (ts.length === 0) return setStats(null);
      setStats({
        trails: ts.length,
        stops: ts.reduce((n, t) => n + t.steps.length, 0),
      });
    });
  }, []);

  function openSeed(seed: Seed) {
    const title = pickRandom(seed.titles) ?? seed.titles[0];
    router.push(
      `/drift?title=${encodeURIComponent(title)}&seed=${encodeURIComponent(seed.name)}`,
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-6 py-12 sm:py-16">
      <header className="flex flex-col items-center text-center">
        <h1 className="font-serif text-6xl text-ink sm:text-7xl">Drift</h1>
        <p className="mt-3 text-lg text-ink-soft sm:text-xl">
          Pull a thread. See where it goes.
        </p>
        <p className="mt-4 max-w-md text-base leading-relaxed text-ink/75">
          A calm feed of Wikipedia knowledge cards where <em>you</em> are the
          algorithm — no autoplay, no hidden ranking. Pick a direction, or let
          curiosity surprise you.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/drift")}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-base font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong"
          >
            Surprise me
            <span aria-hidden="true">→</span>
          </button>
          <Link
            href="/trails"
            className="rounded-full border border-line bg-paper-raised px-6 py-3 text-base font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            My Trails
          </Link>
          <Link
            href="/interests"
            className="rounded-full border border-line bg-paper-raised px-6 py-3 text-base font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Interests
          </Link>
        </div>

        {stats && (
          <p className="mt-4 text-sm text-ink-soft">
            You&apos;ve saved {stats.trails}{" "}
            {stats.trails === 1 ? "trail" : "trails"} · {stats.stops} stops
            mapped.
          </p>
        )}
      </header>

      <section className="mt-12">
        <h2 className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-ink-soft">
          Or start somewhere
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {seeds.map((seed) => (
            <li key={seed.name}>
              <button
                type="button"
                onClick={() => openSeed(seed)}
                style={{
                  // Blend the seed's tint into the current surface so tiles read
                  // correctly in both light and dark ("night library") themes.
                  backgroundColor: `color-mix(in srgb, ${seed.tint} 45%, var(--paper-raised))`,
                }}
                className="group flex h-full w-full flex-col rounded-2xl p-5 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span
                  className="font-serif text-2xl text-ink/70"
                  aria-hidden="true"
                >
                  {seed.glyph}
                </span>
                <span className="mt-3 font-serif text-xl leading-tight text-ink">
                  {seed.name}
                </span>
                <span className="mt-1 text-xs leading-snug text-ink/60">
                  {seed.blurb}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
