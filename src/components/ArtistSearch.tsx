"use client";

import { useEffect, useRef, useState } from "react";

// The "drift an artist" search bar (Phase 24, Gallery homepage). Type a name,
// pick the artist, and the session wanders their work. Closely mirrors
// OrbitSearch (debounced, aborting, keyboard-navigable) so the two realms' search
// bars feel like the same object.
//
// The one real difference is honesty about coverage. The Art Institute's
// public-domain collection is deep in some artists and shallow in others
// (Hokusai 447 works, Van Gogh 18), and holds nothing at all by anyone still in
// copyright. So every suggestion carries its true count, and "no match" is shown
// as a plain sentence rather than silently leaving the last results up: a search
// for Picasso must not look like it worked (§2.1).
export interface ArtistSuggestion {
  id: number;
  name: string;
  works: number;
  thumbnail?: string;
}

export function ArtistSearch({
  onPick,
}: {
  onPick: (artist: ArtistSuggestion) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ArtistSuggestion[]>([]);
  const [empty, setEmpty] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced lookup; aborts a superseded request. All setState runs inside the
  // (deferred) timer, never synchronously in the effect body (React 19
  // render-purity rule). A failed fetch keeps the previous results rather than
  // erroring — but a successful EMPTY answer is shown, because that is the
  // meaningful "we hold nothing by them" case.
  useEffect(() => {
    const query = q.trim();
    const ctrl = new AbortController();
    const t = window.setTimeout(
      async () => {
        if (query.length < 2) {
          setResults([]);
          setEmpty(false);
          setOpen(false);
          return;
        }
        try {
          const res = await fetch(
            `/api/realm/gallery/artists?q=${encodeURIComponent(query)}`,
            { signal: ctrl.signal },
          );
          const data = (await res.json()) as ArtistSuggestion[];
          if (Array.isArray(data)) {
            setResults(data);
            setEmpty(data.length === 0);
            setActive(0);
            setOpen(true);
          }
        } catch {
          /* aborted / offline — keep prior results */
        }
      },
      query.length < 2 ? 0 : 260,
    );
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(artist: ArtistSuggestion) {
    setOpen(false);
    setQ("");
    setResults([]);
    setEmpty(false);
    onPick(artist);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[active];
      if (pick) choose(pick);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => (results.length > 0 || empty) && setOpen(true)}
          placeholder="Drift an artist…"
          aria-label="Search for an artist to drift"
          className="w-full rounded-full border border-line-strong bg-paper-raised py-3 pl-11 pr-5 text-base text-ink shadow-sm transition placeholder:text-ink-soft focus-ring"
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-line bg-paper-raised p-1.5 text-left shadow-xl">
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                  i === active ? "bg-accent/10" : "hover:bg-accent/5"
                }`}
              >
                {r.thumbnail ? (
                  <img
                    src={r.thumbnail}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink/5 font-serif text-ink-soft">
                    {r.name.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{r.name}</span>
                  {/* The real depth, before you commit: 18 works is a short
                      wander, 447 is an afternoon. */}
                  <span className="block truncate text-xs text-ink-soft">
                    {r.works.toLocaleString()}{" "}
                    {r.works === 1 ? "work here" : "works here"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && empty && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-line bg-paper-raised p-4 text-left text-sm leading-relaxed text-ink-soft shadow-xl">
          No public-domain works by that artist at the Art Institute. The
          collection is strongest in prints, drawings, and Impressionism, and
          artists still in copyright are not in it.
        </div>
      )}
    </div>
  );
}
