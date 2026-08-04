"use client";

import type { TrailStep } from "@/lib/types";

// ---------------------------------------------------------------------------
// "How you got here" (Phase 28) — the trail read as prose rather than drawn as
// a map.
//
// The map answers "where did I go?". This answers "why did one thing lead to
// another?", which is a question the app could not answer at all until threads
// started carrying the sentence that justified them (lib/bridge.ts). Chained
// down the page, those sentences are the closest thing Drift has to something
// written: every line is quoted from the encyclopedia, and the ORDER is the
// reader's. Nobody else has the second half of that.
//
// It appears only when the trail can actually tell a story (at least one hop
// carries a quote). Without that it would be a list of titles the map already
// draws better.
// ---------------------------------------------------------------------------

export function hasStory(steps: TrailStep[]): boolean {
  return steps.some((s) => s.arrivedVia.type === "thread" && !!s.arrivedVia.bridge);
}

export function TrailStory({ steps }: { steps: TrailStep[] }) {
  if (!hasStory(steps)) return null;
  return (
    <section aria-label="How you got here">
      <h3 className="text-xs font-medium uppercase tracking-widest text-ink-soft">
        How you got here
      </h3>
      <ol className="mt-3 space-y-1">
        {steps.map((step, i) => {
          const via = step.arrivedVia;
          return (
            <li key={`${step.card.pageTitle}-${i}`}>
              {/* The hop that brought you TO this stop, above its title, so the
                  column reads title → reason → title straight down. */}
              {via.type === "thread" && via.bridge ? (
                <p className="border-l-2 border-accent/30 py-1 pl-3 font-serif text-sm italic leading-relaxed text-ink/75">
                  <span aria-hidden="true">“</span>
                  {via.bridge}
                  <span aria-hidden="true">”</span>
                </p>
              ) : i > 0 ? (
                <p className="py-1 pl-3 text-xs text-ink-soft">
                  {via.type === "thread" ? `you pulled ${via.label}` : "you drifted on"}
                </p>
              ) : null}
              <p className="font-serif text-base leading-snug text-ink">
                {step.card.displayTitle}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
