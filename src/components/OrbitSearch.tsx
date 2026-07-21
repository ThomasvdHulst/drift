"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchSuggestion } from "@/lib/wiki";

// The "drift around a page" search bar (Phase 18, Encyclopedia homepage). Type a
// page, pick it, and start a focused orbit anchored to it. Calm + quiet (a
// reading room, not a search engine): debounced suggestions, no ranking noise.
export function OrbitSearch({ onPick }: { onPick: (title: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced suggestion fetch; aborts a superseded request. All setState runs
  // inside the (deferred) timer, never synchronously in the effect body (React 19
  // render-purity rule). Graceful: failure leaves the last results (never errors).
  useEffect(() => {
    const query = q.trim();
    const ctrl = new AbortController();
    const t = window.setTimeout(
      async () => {
        if (query.length < 2) {
          setResults([]);
          setOpen(false);
          return;
        }
        try {
          const res = await fetch(
            `/api/wiki/search?q=${encodeURIComponent(query)}`,
            { signal: ctrl.signal },
          );
          const data = (await res.json()) as SearchSuggestion[];
          if (Array.isArray(data)) {
            setResults(data);
            setActive(0);
            setOpen(true);
          }
        } catch {
          /* aborted / offline — keep prior results */
        }
      },
      query.length < 2 ? 0 : 220,
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

  function choose(title: string) {
    setOpen(false);
    setQ("");
    setResults([]);
    onPick(title);
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
      if (pick) choose(pick.title);
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
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Drift around a page…"
          aria-label="Search for a page to drift around"
          className="w-full rounded-full border border-line bg-paper-raised py-3 pl-11 pr-5 text-base text-ink shadow-sm outline-none transition placeholder:text-ink-soft focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-line bg-paper-raised p-1.5 text-left shadow-xl">
          {results.map((r, i) => (
            <li key={r.title}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r.title)}
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
                    {r.title.slice(0, 1)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{r.title}</span>
                  {r.description && (
                    <span className="block truncate text-xs text-ink-soft">
                      {r.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
