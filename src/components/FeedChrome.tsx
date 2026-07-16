"use client";

import Link from "next/link";
import type { TrailStep } from "@/lib/types";
import { Monogram } from "@/components/BrandLogo";

// Quiet, persistent UI chrome. No red badges, no streaks — a home link, the
// trail rail (where am I?), a soft stop counter, and gentle nav controls.

// The trail rail: every stop as a marker, drift edges dashed/grey and thread
// edges solid/sage, the current stop ringed. Click a marker to jump to it.
export function TrailRail({
  steps,
  pos,
  onJump,
}: {
  steps: TrailStep[];
  pos: number;
  onJump: (index: number) => void;
}) {
  if (steps.length < 2) return null;
  return (
    <div className="hidden max-w-[42vw] items-center overflow-x-auto sm:flex">
      {steps.map((s, i) => {
        const isThread = s.arrivedVia.type === "thread";
        const active = i === pos;
        return (
          <div key={`${s.card.pageTitle}-${i}`} className="flex items-center">
            {i > 0 &&
              (isThread ? (
                <span className="mx-0.5 h-px w-4 shrink-0 bg-accent/70" />
              ) : (
                <span className="mx-0.5 h-0 w-4 shrink-0 border-t border-dashed border-ink/30" />
              ))}
            <button
              type="button"
              onClick={() => onJump(i)}
              title={`${s.card.displayTitle}${isThread ? ` · ${s.arrivedVia.type === "thread" ? s.arrivedVia.label : ""}` : ""}`}
              aria-label={s.card.displayTitle}
              className="flex h-5 w-3 items-center justify-center"
            >
              <span
                className={`block rounded-full transition-all ${
                  isThread
                    ? active
                      ? "h-3 w-3 bg-accent ring-2 ring-accent/35"
                      : "h-2.5 w-2.5 bg-accent/70 hover:bg-accent"
                    : active
                      ? "h-2.5 w-2.5 bg-ink ring-2 ring-ink/20"
                      : "h-2 w-2 bg-ink/30 hover:bg-ink/50"
                }`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function FeedTopBar({
  steps,
  pos,
  stops,
  realm,
  onJump,
  onEnd,
}: {
  steps: TrailStep[];
  pos: number;
  stops: number;
  realm: { label: string; glyph: string };
  onJump: (index: number) => void;
  onEnd: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/"
          aria-label="Drift — home"
          className="opacity-90 transition hover:opacity-100"
        >
          <Monogram className="h-7" />
        </Link>
        {/* Which "room" you're in — a quiet realm marker, accent-tinted via the
            feed's data-realm scope. */}
        <span className="hidden items-center gap-1 text-sm text-accent-strong sm:inline-flex">
          <span aria-hidden="true">·</span>
          <span aria-hidden="true">{realm.glyph}</span>
          <span>{realm.label}</span>
        </span>
      </div>

      <TrailRail steps={steps} pos={pos} onJump={onJump} />

      <div className="flex shrink-0 items-center gap-4">
        <span className="text-sm tabular-nums text-ink-soft">
          {stops} {stops === 1 ? "stop" : "stops"}
        </span>
        <button
          type="button"
          onClick={onEnd}
          className="rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
        >
          End &amp; view trail
        </button>
      </div>
    </header>
  );
}

export function FeedBottomNav({
  canGoBack,
  viewingBack,
  busy,
  onBack,
  onAdvance,
}: {
  canGoBack: boolean;
  viewingBack: boolean;
  busy: boolean;
  onBack: () => void;
  onAdvance: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Previous stop"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper-raised text-ink transition hover:border-accent/50 hover:text-accent-strong disabled:cursor-default disabled:opacity-30"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onAdvance}
        disabled={busy}
        aria-label="Advance"
        className="inline-flex min-w-[9.5rem] items-center justify-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong disabled:opacity-70"
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper-raised/40 border-t-paper-raised" />
        ) : (
          <>
            {viewingBack ? "Return" : "Drift onward"}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
