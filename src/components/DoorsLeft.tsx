"use client";

import Link from "next/link";
import type { TrailStep } from "@/lib/types";
import { doorsOf, doorHref } from "@/lib/doors";
import { KindIcon } from "./ThreadChips";

// ---------------------------------------------------------------------------
// "The doors you left open" (Phase 28) — the exit screen's account of the roads
// not taken.
//
// Placed AFTER the map on purpose. The map is the reward for stopping (§2.3);
// this is the quiet PS. Each door reopens as a fresh drift, which is the only
// kind of "come back" Drift is willing to offer: something you chose, waiting
// where you left it, with no badge, no count and nobody sending you anything
// (§2.4).
// ---------------------------------------------------------------------------

export function DoorsLeft({ steps, max = 5 }: { steps: TrailStep[]; max?: number }) {
  const doors = doorsOf(steps, { max });
  if (doors.length === 0) return null;
  return (
    <section aria-label="Doors you left open">
      <h3 className="text-xs font-medium uppercase tracking-widest text-ink-soft">
        Doors you left open
      </h3>
      <ul className="mt-3 space-y-2">
        {doors.map(({ door, from }) => (
          <li key={door.pageTitle}>
            <Link
              href={doorHref(door)}
              className="group flex flex-col gap-0.5 rounded-xl border border-line px-3.5 py-2.5 transition hover:border-accent/50 focus-ring"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                {door.kind && <KindIcon kind={door.kind} size={11} />}
                from {from}
              </span>
              <span className="font-serif text-base leading-snug text-ink transition group-hover:text-accent-strong">
                {door.displayTitle}
              </span>
              {door.bridge && (
                <span className="line-clamp-2 text-xs leading-snug text-ink/75">
                  <span aria-hidden="true">“</span>
                  {door.bridge}
                  <span aria-hidden="true">”</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
