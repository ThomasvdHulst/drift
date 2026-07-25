"use client";

import { useEffect, useRef, useState } from "react";

// The homepage's grid of start cards: a typographic glyph, a serif name, and one
// line of "what you'd find in here" on a pale tint blended over paper (§6).
//
// Two callers render through it so they can't visually drift apart: Encyclopedia's
// "Or drift within a field" (one card per topic, each starting a focused drift)
// and Gallery/Papers' "Or start somewhere" (one card per seed bucket).
export interface Tile {
  id: string;
  label: string;
  glyph: string;
  blurb: string;
  tint: string;
}

export function TileGrid({
  tiles,
  onPick,
  selectedId,
  panel,
  className = "",
  ...rest
}: {
  tiles: Tile[];
  onPick: (id: string) => void;
  /** Marks a tile as chosen, so a two-step pick shows what you picked. */
  selectedId?: string | null;
  /** Content revealed by that choice (the Gallery's period chips). Placed as a
   *  full-width row directly BELOW the selected tile's row — see below. */
  panel?: React.ReactNode;
} & React.HTMLAttributes<HTMLUListElement>) {
  const ref = useRef<HTMLUListElement>(null);
  // How many columns the grid is actually rendering right now (2 on a phone, 3
  // at `sm`, 4 at `lg`). Read from the resolved template rather than duplicating
  // the breakpoints in JS, so the two can never disagree.
  const [columns, setColumns] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setColumns(
        getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean)
          .length,
      );
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Where the panel goes: the end of the row holding the selected tile.
  //
  // Appending it after the whole grid (the obvious thing) pushes it off the
  // bottom of a phone — ten tiles in two columns is five rows tall, so choosing
  // "Coins" revealed its periods somewhere below the fold and a first-time user
  // had no reason to think anything had happened. Slotting it into the grid
  // means the choice always appears directly under what you just tapped, with no
  // scrolling and no lost context.
  const selectedIndex = selectedId
    ? tiles.findIndex((t) => t.id === selectedId)
    : -1;
  const panelIndex =
    panel && selectedIndex >= 0 && columns > 0
      ? Math.min(selectedIndex + (columns - (selectedIndex % columns)), tiles.length)
      : -1;

  const items: React.ReactNode[] = [];
  tiles.forEach((tile, i) => {
    if (i === panelIndex) {
      items.push(
        <li key="__panel" className="col-span-full">
          {panel}
        </li>,
      );
    }
    const selected = tile.id === selectedId;
    items.push(
      <li key={tile.id}>
        <button
          type="button"
          onClick={() => onPick(tile.id)}
          aria-pressed={selectedId !== undefined ? selected : undefined}
          style={{
            backgroundColor: `color-mix(in srgb, ${tile.tint} 45%, var(--paper-raised))`,
          }}
          className={`group flex h-full w-full flex-col rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            selected
              ? "shadow-md ring-2 ring-accent"
              : "ring-1 ring-line"
          }`}
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
      </li>,
    );
  });
  // A selection in the last row puts the panel past the final tile.
  if (panelIndex === tiles.length) {
    items.push(
      <li key="__panel" className="col-span-full">
        {panel}
      </li>,
    );
  }

  return (
    <ul
      {...rest}
      ref={ref}
      className={`grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${className}`}
    >
      {items}
    </ul>
  );
}
