"use client";

import { useEffect, useRef, useState } from "react";
import type { CardTableData } from "@/lib/wikihtml";
import { MathText } from "./MathText";

// A Wikipedia data table, inside a card (Phase 26).
//
// It is rendered from DATA, never from Wikipedia's HTML: `lib/wikihtml.ts` turns
// the markup into rows of text, and this draws them. So there is no injected
// markup to sanitize, and the table can be styled to look like it belongs in the
// reading room rather than like a page from another website.
//
// Two things it must not do:
//
//  • Scroll the PAGE sideways. A wide table scrolls inside its own box.
//  • Steal the feed's gestures. A sideways drag over a *scrollable* table belongs
//    to the table, so those touches stop there (otherwise the drag reads as a
//    cross-realm swipe, `resolveHorizontalSwipe` in lib/gesture.ts). Over a table
//    that is NOT scrollable, gestures pass through untouched, so crossing realms
//    still works everywhere else on the card. Wheel events are never intercepted,
//    so vertical reading and overscroll-to-advance behave exactly as before.

export function CardTable({
  data,
  sourceUrl,
}: {
  data: CardTableData;
  /** The article this table came from: where the full one lives. */
  sourceUrl: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollable, setScrollable] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  // Is the table actually wider than its box, and has it been scrolled to the end?
  // The first decides whether it owns sideways drags; the second whether the "more
  // this way" fade shows. Re-measured on resize and when the rows change.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      setScrollable(el.scrollWidth > el.clientWidth + 1);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [data]);

  const shownRows = data.rows.length - (data.headerRow ? 1 : 0);
  const shownCols = data.rows.reduce((n, r) => Math.max(n, r.length), 0);
  const cutRows = data.totalRows > shownRows;
  const cutCols = data.totalCols > shownCols;

  const stop = scrollable
    ? (e: { stopPropagation: () => void }) => e.stopPropagation()
    : undefined;

  // `w-full min-w-0` keeps the figure itself exactly as wide as the column it sits
  // in, however wide the table inside it turns out to be. The scroller below is
  // the ONLY thing allowed to exceed the card.
  return (
    <figure className="my-1 w-full min-w-0 overflow-hidden rounded-xl ring-1 ring-line">
      {data.caption && (
        <figcaption className="border-b border-line bg-ink/5 px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
          {data.caption}
        </figcaption>
      )}
      <div className="relative">
        <div
          ref={scrollerRef}
          // `pan-x pan-y` keeps the browser's own horizontal panning available here,
          // where the card's reading region is otherwise locked to `pan-y`.
          style={{ touchAction: "pan-x pan-y" }}
          onTouchStart={stop}
          onTouchMove={stop}
          onTouchEnd={stop}
          // A scrollable region has to be reachable without a pointer (2.1.1), and
          // a tab stop needs a visible focus indicator (2.4.7) — the app's shared
          // ring. A table that fits takes no focus and adds no tab stop.
          {...(scrollable
            ? {
                tabIndex: 0,
                role: "group" as const,
                "aria-label": data.caption
                  ? `${data.caption} table, scrolls sideways`
                  : "Table, scrolls sideways",
              }
            : {})}
          className="focus-ring overflow-x-auto"
        >
          {/* `min-w-max` + a floor on every cell (below) is what keeps a wide table
              readable on a phone. Left to itself, a 6-column table in a 310px box
              squeezes each column to ~50px and a prose cell becomes a ten-line
              tower; with a floor it wraps at a sane width and the table scrolls
              sideways instead, which is what the fade cues. */}
          <table className="w-full min-w-max border-collapse text-left text-sm">
            {data.headerRow && (
              <thead>
                <tr>
                  {data.rows[0].map((cell, i) => (
                    <th
                      key={i}
                      scope="col"
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      className="min-w-[7rem] max-w-[16rem] border-b border-line bg-ink/5 px-3 py-2 align-bottom text-xs font-semibold uppercase tracking-wide text-ink-soft"
                    >
                      <MathText text={cell.text} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {(data.headerRow ? data.rows.slice(1) : data.rows).map(
                (row, r) => (
                  <tr
                    key={r}
                    className={r % 2 === 1 ? "bg-ink/[0.03]" : undefined}
                  >
                    {row.map((cell, c) =>
                      cell.header ? (
                        <th
                          key={c}
                          scope="row"
                          colSpan={cell.colSpan}
                          rowSpan={cell.rowSpan}
                          className="min-w-[7rem] max-w-[16rem] px-3 py-2 align-top text-sm font-medium text-ink"
                        >
                          <MathText text={cell.text} />
                        </th>
                      ) : (
                        <td
                          key={c}
                          colSpan={cell.colSpan}
                          rowSpan={cell.rowSpan}
                          className="min-w-[7rem] max-w-[16rem] px-3 py-2 align-top text-ink/85"
                        >
                          <MathText text={cell.text} />
                        </td>
                      ),
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        {/* "There is more this way." The same soft-fade language the card already
            uses at the bottom of a truncated read, turned sideways. Only while
            there is actually something further right. */}
        {scrollable && !atEnd && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-paper-raised to-transparent"
          />
        )}
      </div>
      {/* Only ever shown when something really was left out, and it says what
          (§2.1: the reader is never quietly given a partial answer). */}
      {(cutRows || cutCols || data.imagesOmitted) && (
        <div className="border-t border-line px-3 py-2 text-xs text-ink-soft">
          {cutRows || cutCols ? (
            <>
              Showing{" "}
              {cutRows ? `${shownRows} of ${data.totalRows} rows` : null}
              {cutRows && cutCols ? " and " : null}
              {cutCols ? `${shownCols} of ${data.totalCols} columns` : null}
              .{" "}
            </>
          ) : null}
          {/* A table can introduce itself with "…with images in the rightmost
              column". Those images are not ours to reuse, so say so rather than
              leave a reader hunting for a column that is not there. */}
          {data.imagesOmitted ? <>Images are not shown here. </> : null}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent-strong underline decoration-accent/40 underline-offset-2 transition hover:decoration-accent"
          >
            Full table on Wikipedia ↗
          </a>
        </div>
      )}
    </figure>
  );
}
