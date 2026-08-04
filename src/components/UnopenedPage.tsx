"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Card, TrailStep } from "@/lib/types";
import { commonPages, stopsToProbe, type CommonPage } from "@/lib/common";
import { summaryUrl } from "@/lib/realms";
import { loadSeen } from "@/lib/storage";

// ---------------------------------------------------------------------------
// "One you never opened" (Phase 28) — the exit screen's single question.
//
// Several of your stops point at the same page, and you never went there. That
// sentence is only sayable by something that knows the whole path, which is the
// one thing Drift has and a feed of borrowed articles does not.
//
// It is a QUESTION FIRST, answer on request. Showing the answer immediately
// would make it a fact; making the reader ask for it makes it a small act of
// curiosity, which is the entire product. And it is scored, streaked and
// counted nowhere: there is no right answer to get, only a page to open or not
// (§2.4).
//
// Everything about it is optional. It is fetched in the background as the end
// screen opens, it never blocks the map, and when the intersection says nothing
// worth saying the section does not exist — an app that claims to have noticed
// something about your reading when it has noticed nothing is worse than a
// quiet one.
// ---------------------------------------------------------------------------

/** Null until there is something worth saying, which is most of the time: the
 *  section renders nothing rather than announcing that it found nothing. */
type Answer = { page: CommonPage; card: Card | null };

export function UnopenedPage({ steps }: { steps: TrailStep[] }) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Keyed on the titles themselves, as strings: the arrays are rebuilt every
  // render (renaming the trail, saving it), and depending on their identity
  // would refetch the whole intersection each time. A MediaWiki title cannot
  // contain "|", which is what makes this safe to split back apart.
  const probeKey = stopsToProbe(steps).join("|");
  const visitedKey = steps.map((s) => s.card.pageTitle).join("|");

  useEffect(() => {
    // Fewer than three stops cannot make the claim this section makes, so there
    // is nothing to ask and nothing to render.
    const probe = probeKey ? probeKey.split("|") : [];
    if (probe.length < 3) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/wiki/links?titles=${encodeURIComponent(probe.join("|"))}`,
          { signal: AbortSignal.timeout(15000) },
        );
        const data = (await res.json()) as { links?: Record<string, string[]> };
        if (cancelled) return;
        // Never offer a page the reader has already read, in this trail or in
        // any earlier one: "you never opened this" has to be true.
        let seen: string[] = [];
        try {
          seen = (await loadSeen()).map((id) => id.replace(/^wikipedia:/, ""));
        } catch {
          /* no persistent seen list: the trail's own stops still apply */
        }
        if (cancelled) return;
        const best = commonPages(data?.links ?? {}, {
          visited: [...visitedKey.split("|"), ...seen],
          max: 1,
        })[0];
        if (!best) return;
        setAnswer({ page: best, card: null });
        // The card is a nicety: the answer is the title, and it stands without
        // an extract if the summary is slow or unavailable.
        try {
          const cres = await fetch(summaryUrl("encyclopedia", best.title), {
            signal: AbortSignal.timeout(6000),
          });
          const card = (await cres.json()) as Card;
          if (!cancelled && card?.pageTitle) setAnswer({ page: best, card });
        } catch {
          /* keep the title-only answer */
        }
      } catch {
        /* no answer: the section stays absent, which is the honest default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [probeKey, visitedKey]);

  if (!answer) return null;
  const { page, card } = answer;

  return (
    <section aria-label="One you never opened">
      <h3 className="text-xs font-medium uppercase tracking-widest text-ink-soft">
        One you never opened
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/75">
        {joinTitles(page.from)} all point at the same page. You never went there.
      </p>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-3 rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong focus-ring"
        >
          Show me
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-line px-4 py-3">
          <p className="font-serif text-lg leading-snug text-ink">{page.title}</p>
          {card?.extract && (
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink/75">
              {card.extract}
            </p>
          )}
          <Link
            href={`/drift?realm=encyclopedia&title=${encodeURIComponent(page.title)}&seed=${encodeURIComponent(page.title)}`}
            className="mt-3 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong focus-ring"
          >
            Start a drift here
          </Link>
        </div>
      )}
    </section>
  );
}

/** "A, B and C" — the stops the question is about, read as a sentence. */
function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}
