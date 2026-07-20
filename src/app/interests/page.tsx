"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TOPICS } from "@/lib/topics";
import {
  applyFeedback,
  isLiked,
  type Interest,
  BASE,
  WEIGHT_CEIL,
} from "@/lib/interest";
import {
  getInterest,
  setInterest as persistInterest,
  getSettings,
  setSettings,
} from "@/lib/storage";

// The interest profile — the transparent, editable face of the drift algorithm
// (§2.1). Nothing here is hidden: you can see every topic's weight, nudge it up
// or down by hand, reset the whole thing, or switch personalization off.
export default function InterestsPage() {
  const [interest, setInterest] = useState<Interest | null>(null);
  const [personalize, setPersonalize] = useState(true);

  useEffect(() => {
    getInterest().then(setInterest);
    getSettings().then((s) => setPersonalize(s.personalize !== false));
  }, []);

  function nudge(id: string, signal: "like" | "dislike") {
    setInterest((cur) => {
      const next = applyFeedback(cur ?? {}, [id], signal);
      persistInterest(next);
      return next;
    });
  }

  function reset() {
    setInterest({});
    persistInterest({});
  }

  function togglePersonalize() {
    const next = !personalize;
    setPersonalize(next);
    setSettings({ personalize: next });
  }

  // Sort: most-liked first, most-disliked last, neutral in the middle.
  const rows = interest
    ? [...TOPICS].sort(
        (a, b) => (interest[b.id] ?? BASE) - (interest[a.id] ?? BASE),
      )
    : [];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm text-ink-soft transition hover:text-accent-strong"
          >
            ← Drift
          </Link>
          <h1 className="mt-1 font-serif text-4xl text-ink">Your interests</h1>
          <p className="mt-1 max-w-md text-sm text-ink-soft">
            A thumbs up or down on{" "}
            <span className="font-medium text-ink">Encyclopedia</span> cards
            gently shapes which topics surface while you drift there, never which
            threads you can pull. (Gallery isn&apos;t personalized.) Here&apos;s
            the whole picture, and you can edit it.
          </p>
        </div>
        <Link
          href="/drift"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
        >
          Start drifting →
        </Link>
      </header>

      <div
        data-tour="interests-list"
        className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper-raised p-4 ring-1 ring-line"
      >
        <div>
          <p className="text-sm font-medium text-ink">Personalize my drift</p>
          <p className="text-xs text-ink-soft">
            {personalize
              ? "On. ~30% of drifts still wander freely, and no topic is ever excluded."
              : "Off. Drifting picks topics at random (still interesting, not personalized)."}
          </p>
        </div>
        <button
          type="button"
          onClick={togglePersonalize}
          role="switch"
          aria-checked={personalize}
          aria-label="Toggle personalization"
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            personalize ? "bg-accent" : "bg-ink/20"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper-raised shadow transition-all ${
              personalize ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {interest === null ? (
        <p className="mt-16 text-center text-ink-soft">Loading…</p>
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-2.5">
            {rows.map((t) => {
              const w = interest[t.id] ?? BASE;
              const liked = isLiked(interest, t.id);
              const disliked = w < BASE;
              return (
                <li key={t.id} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-ink">
                    {t.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        liked
                          ? "bg-accent"
                          : disliked
                            ? "bg-ink/25"
                            : "bg-ink/15"
                      }`}
                      style={{ width: `${Math.round((w / WEIGHT_CEIL) * 100)}%` }}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => nudge(t.id, "dislike")}
                      aria-label={`Less ${t.label}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-ink-soft transition hover:border-ink/30 hover:text-ink"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => nudge(t.id, "like")}
                      aria-label={`More ${t.label}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-ink-soft transition hover:border-accent/40 hover:text-accent-strong"
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-accent/50 hover:text-accent-strong"
            >
              Reset interests
            </button>
          </div>
        </>
      )}
    </main>
  );
}
