"use client";

import { useEffect, useState } from "react";
import { TileGrid, type Tile } from "./TileGrid";

// A foldable band of start cards on the homepage: a quiet uppercase label with a
// chevron, and a `TileGrid` underneath. Used by both Encyclopedia sections ("Or
// drift within a field", "Or drift what's in the news").
//
// It opens by default on desktop and stays folded on phones: a wide screen shows
// the cards as a warm, browsable sheet, while on a phone 28 of them are just a
// long scroll past. The first paint is closed on the server AND the client, so
// hydration always matches; the width is read once afterwards, which also means
// opening or closing it by hand always wins from then on.
export function TileDisclosure({
  label,
  tiles,
  onPick,
  tourId,
  className = "",
}: {
  label: string;
  tiles: Tile[];
  onPick: (id: string) => void;
  /** `data-tour` key, placed on the summary so the tour spotlight hugs the label
   *  rather than the whole grid (the overlay opens the details behind it). */
  tourId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        // Tailwind's `sm` breakpoint: where the grid stops being a long scroll.
        setOpen(!!window.matchMedia?.("(min-width: 640px)")?.matches);
      } catch {
        // no matchMedia: leave it folded
      }
    });
  }, []);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className={`group w-full ${className}`}
    >
      <summary
        data-tour={tourId}
        className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-ink-soft transition hover:text-accent-strong"
      >
        {label}
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
      <TileGrid className="mt-4" tiles={tiles} onPick={onPick} />
    </details>
  );
}
