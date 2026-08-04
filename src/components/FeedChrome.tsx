"use client";

import Link from "next/link";
import type { TrailStep } from "@/lib/types";
import type { RealmId } from "@/lib/realms/types";
import { Monogram } from "@/components/BrandLogo";
import { DoorwayIcon } from "@/components/ThreadChips";

// Quiet, persistent UI chrome. No red badges, no streaks — a home link, the
// trail rail (where am I?), a soft stop counter, and gentle nav controls.

// The trail rail: every stop as a marker, drift edges dashed/grey and thread
// edges solid/sage, the current stop ringed. Click a marker to jump to it.
//
// It draws the branch you are currently ON (Phase 29), which is the only line
// that reads as a rail; the whole tree is the trail map's job. A hop that LEFT
// another line is drawn as a step down rather than a straight link, so the rail
// never implies you simply carried on.
function TrailRail({
  steps,
  pos,
  branchAt,
  onJump,
}: {
  steps: TrailStep[];
  pos: number;
  /** Positions along this rail where the reader forked off another line. */
  branchAt?: Set<number>;
  onJump: (index: number) => void;
}) {
  if (steps.length < 2) return null;
  return (
    <div className="hidden max-w-[42vw] items-center overflow-x-auto sm:flex">
      {steps.map((s, i) => {
        const isThread = s.arrivedVia.type === "thread";
        const active = i === pos;
        const forked = !!branchAt?.has(i);
        const viaDoor = s.arrivedVia.type === "thread" && s.arrivedVia.viaDoor;
        return (
          <div key={`${s.card.pageTitle}-${i}`} className="flex items-center">
            {i > 0 &&
              (forked ? (
                <svg
                  width="16"
                  height="12"
                  viewBox="0 0 16 12"
                  className="mx-0.5 shrink-0 text-accent"
                  aria-hidden="true"
                >
                  <path
                    d="M0 2h5c3 0 3 8 6 8h5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeOpacity="0.7"
                    strokeLinecap="round"
                  />
                </svg>
              ) : isThread ? (
                <span className="mx-0.5 h-px w-4 shrink-0 bg-accent/70" />
              ) : (
                <span className="mx-0.5 h-0 w-4 shrink-0 border-t border-dashed border-ink/30" />
              ))}
            <button
              type="button"
              onClick={() => onJump(i)}
              title={`${s.card.displayTitle}${isThread && s.arrivedVia.type === "thread" ? ` · ${viaDoor ? "came back for " : ""}${s.arrivedVia.label}` : ""}`}
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
  branchAt,
  stops,
  realm,
  otherRealm,
  onCrossRealm,
  endless,
  onJump,
  onEnd,
}: {
  // The branch being read, root → tip (Phase 29), with `pos` a position along
  // it. `stops` is the whole trail, which is what the counter should say.
  steps: TrailStep[];
  pos: number;
  branchAt?: Set<number>;
  stops: number;
  realm: { label: string; glyph: string };
  // The realm you can cross INTO (Phase 15) + the handler; the quiet control is a
  // discoverable + desktop-friendly complement to the horizontal swipe.
  otherRealm?: { id: RealmId; label: string; glyph: string };
  onCrossRealm?: () => void;
  // "Just drift" mode (no trail framing): hide the breadcrumb rail and soften
  // the end action to a quiet, optional "Keep this trail" escape hatch.
  endless?: boolean;
  onJump: (index: number) => void;
  onEnd: () => void;
}) {
  // Widths here have to survive more than a narrow phone: a reader who has turned
  // Chrome's page-text scaling up (or Android's display size) grows every label,
  // and with every child `shrink-0` the row simply outgrew the viewport. The feed
  // shell is `overflow-hidden`, so the surplus was invisibly clipped, and once a
  // control at the far end took focus the browser scrolled that hidden box
  // sideways, sliding the monogram off the left edge too. So: tighter gaps and
  // padding on a phone, a short label under `sm`, and the End button is the one
  // child allowed to shrink, so the row can always fit.
  // pt keeps the bar clear of a notch when Drift is installed standalone
  // (viewportFit: "cover"); the inset is 0 in an ordinary browser tab.
  return (
    <header className="flex items-center justify-between gap-2 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:gap-3 sm:px-6">
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/"
          aria-label="Drift home"
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

      {!endless && (
        <TrailRail steps={steps} pos={pos} branchAt={branchAt} onJump={onJump} />
      )}

      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {onCrossRealm && otherRealm && (
          <button
            type="button"
            data-tour="cross-realm"
            onClick={onCrossRealm}
            data-realm={otherRealm.id}
            aria-label={`Cross to the ${otherRealm.label}`}
            title={`Cross to the ${otherRealm.label} (or swipe sideways)`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-accent/50 px-2.5 py-1 text-xs font-medium text-accent-strong transition hover:bg-accent/10"
          >
            <DoorwayIcon size={12} />
            <span aria-hidden="true">{otherRealm.glyph}</span>
            <span className="hidden sm:inline">{otherRealm.label}</span>
          </button>
        )}
        <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-ink-soft">
          {stops} {stops === 1 ? "stop" : "stops"}
        </span>
        <button
          type="button"
          data-tour="end-trail"
          onClick={onEnd}
          className="min-w-0 truncate rounded-full border border-line bg-paper-raised px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
        >
          {/* A phone gets the short label. `display: none` keeps the wide one out
              of the accessible name, so the button is announced as it reads. */}
          <span className="sm:hidden">{endless ? "Keep trail" : "End trail"}</span>
          <span className="hidden sm:inline">
            {endless ? "Keep this trail" : "End & view trail"}
          </span>
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
        className="flex h-10 w-10 items-center justify-center rounded-full focus-ring border border-line-strong bg-paper-raised text-ink transition hover:border-accent/50 hover:text-accent-strong disabled:cursor-default disabled:opacity-30"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>

      <button
        type="button"
        data-tour="advance"
        onClick={onAdvance}
        disabled={busy}
        // Match the visible label (WCAG "Label in Name") so voice control can
        // act on what the button actually says. While busy the label is the only
        // accessible name, since the text is swapped for a spinner.
        aria-label={busy ? "Loading" : viewingBack ? "Return" : "Drift onward"}
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
