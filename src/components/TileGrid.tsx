"use client";

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
  className = "",
  ...rest
}: {
  tiles: Tile[];
  onPick: (id: string) => void;
} & React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      {...rest}
      className={`grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${className}`}
    >
      {tiles.map((tile) => (
        <li key={tile.id}>
          <button
            type="button"
            onClick={() => onPick(tile.id)}
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
  );
}
