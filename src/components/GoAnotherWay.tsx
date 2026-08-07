"use client";

import Link from "next/link";
import { useState } from "react";
import type { TrailStep } from "@/lib/types";
import { childrenOf, readingOrder } from "@/lib/branch";
import { stopBranchHref } from "@/lib/doors";
import { countWord } from "@/lib/text";

// ---------------------------------------------------------------------------
// "Go another way" (Phase 30) — a saved trail is a tree you can come back and
// grow, not a closed artifact.
//
// Until now an old trail could be rejoined in exactly two places: at its tip
// ("Continue this trail"), or through a door it happened to RECORD at the
// moment you walked past. A door is the special case; this is the general one.
// Stand on any stop, pull whatever it offers today, and the trail forks there.
//
// Collapsed by default, and that is the point rather than a compromise. A list
// of twenty stops sitting open under the map turns a finished thing into a
// to-do list, which is the register Drift exists to avoid (§2.4). It is here
// when it is wanted and silent when it is not.
//
// The stops are listed in READING ORDER and indented by lane, so the list is
// the same journey the map above it draws. Running the stored array straight
// down would put a branch's first stop directly under the trunk's last.
// ---------------------------------------------------------------------------

export function GoAnotherWay({
  steps,
  trailId,
}: {
  steps: TrailStep[];
  trailId: string;
}) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  const kids = childrenOf(steps);
  const places = readingOrder(steps);

  return (
    <section aria-label="Go another way">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-ink-soft transition hover:text-accent-strong focus-ring rounded"
      >
        Go another way
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-ink/75">
            Pick a stop and carry on from there. The trail keeps everything it
            already holds and grows a new branch from where you stood.
          </p>
          <ul className="mt-3 space-y-1">
            {places.map((place) => {
              const step = steps[place.index];
              const ways = kids[place.index].length;
              return (
                <li
                  key={`${step.card.pageTitle}-${place.index}`}
                  // Indented by lane, so a branch reads as an aside here exactly
                  // as it does in the story column. Inline, because the depth is
                  // data rather than one of a fixed set of classes.
                  style={{ marginLeft: place.lane * 14 }}
                >
                  <Link
                    href={stopBranchHref(trailId, place.index)}
                    className="group flex items-baseline justify-between gap-3 rounded-lg border border-line px-3.5 py-2 transition hover:border-accent/50 focus-ring"
                  >
                    <span className="min-w-0 truncate font-serif text-base leading-snug text-ink transition group-hover:text-accent-strong">
                      {step.card.displayTitle}
                    </span>
                    {/* Only where the trail ALREADY forked. Saying "one way" at
                        every other stop would be nineteen labels carrying no
                        information. */}
                    {ways > 1 && (
                      <span className="shrink-0 text-[11px] uppercase tracking-wide text-ink-soft">
                        {countWord(ways)} ways
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
