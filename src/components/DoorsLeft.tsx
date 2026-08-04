"use client";

import Link from "next/link";
import { useState } from "react";
import type { TrailStep } from "@/lib/types";
import { doorsOf, doorHref, doorBranchHref, type OpenDoor } from "@/lib/doors";
import { KindIcon } from "./ThreadChips";

// ---------------------------------------------------------------------------
// "The doors you left open" (Phase 28) — the exit screen's account of the roads
// not taken.
//
// Placed AFTER the map on purpose. The map is the reward for stopping (§2.3);
// this is the quiet PS. Opening a door is the only kind of "come back" Drift is
// willing to offer: something you chose, waiting where you left it, with no
// badge, no count and nobody sending you anything (§2.4).
//
// Phase 29: a door CONTINUES the trail. It used to start a fresh drift, which
// silently abandoned the trail it came from — the reader lost the session they
// were in the middle of, and the connection between the stop that offered the
// door and where the door led was recorded nowhere. It now forks from that stop.
// Three ways in, in order of how much the caller can do:
//
//   • `onOpen` — the live exit screen: branch in place, no navigation at all.
//   • `trailId` — a saved trail: reopen it and branch (`?continue=…&door=…`).
//   • neither — a trail that is not yours to continue (someone else's share):
//     the door still opens, as its own drift.
// ---------------------------------------------------------------------------

export function DoorsLeft({
  steps,
  max = 5,
  trailId,
  onOpen,
}: {
  steps: TrailStep[];
  max?: number;
  trailId?: string;
  onOpen?: (door: OpenDoor) => void;
}) {
  const doors = doorsOf(steps, { max });
  // Which door is being fetched, so the row can say it heard you. Keyed by page
  // title (unique in this list by construction — `doorsOf` dedupes).
  const [opening, setOpening] = useState<string | null>(null);
  if (doors.length === 0) return null;

  const body = (od: OpenDoor) => (
    <>
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
        {od.door.kind && <KindIcon kind={od.door.kind} size={11} />}
        from {od.from}
      </span>
      <span className="font-serif text-base leading-snug text-ink transition group-hover:text-accent-strong">
        {od.door.displayTitle}
      </span>
      {od.door.bridge && (
        <span className="line-clamp-2 text-xs leading-snug text-ink/75">
          <span aria-hidden="true">“</span>
          {od.door.bridge}
          <span aria-hidden="true">”</span>
        </span>
      )}
      {opening === od.door.pageTitle && (
        <span className="text-[11px] text-ink-soft">Opening…</span>
      )}
    </>
  );

  const face =
    "group flex w-full flex-col gap-0.5 rounded-xl border border-line px-3.5 py-2.5 text-left transition hover:border-accent/50 focus-ring";

  return (
    <section aria-label="Doors you left open">
      <h3 className="text-xs font-medium uppercase tracking-widest text-ink-soft">
        Doors you left open
      </h3>
      <ul className="mt-3 space-y-2">
        {doors.map((od) => (
          <li key={od.door.pageTitle}>
            {onOpen ? (
              <button
                type="button"
                disabled={opening !== null}
                onClick={() => {
                  setOpening(od.door.pageTitle);
                  onOpen(od);
                }}
                className={`${face} disabled:opacity-70`}
              >
                {body(od)}
              </button>
            ) : (
              <Link
                href={trailId ? doorBranchHref(trailId, od) : doorHref(od.door)}
                className={face}
              >
                {body(od)}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
