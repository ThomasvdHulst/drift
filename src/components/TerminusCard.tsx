"use client";

import Link from "next/link";
import type { TerminusReason } from "@/lib/feedqueue";

// ---------------------------------------------------------------------------
// The end of the road, as a card you scroll into.
//
// WHY THIS IS A CARD AND NOT A TOAST. A pool running dry used to fire a
// transient message that appeared wherever the reader happened to be standing —
// which is the wrong place to answer "why did it stop?", because the question is
// asked at the bottom of the feed. Here the message IS the bottom of the feed:
// the scroller ends on it, so the answer sits exactly where the question is.
//
// It is also principle §2.3 made out of geometry rather than announced. A
// session is meant to have a shape, and the reward is meant to sit at the exit;
// a feed that simply stops has no exit, only an absence. This is the exit.
//
// Nothing here is a nag. Every ending offers a way onward AND a way out, and the
// way out is the trail — never "keep going" alone.
// ---------------------------------------------------------------------------

export function TerminusCard({
  reason,
  focusLabel,
  onDriftFreely,
  onRetry,
  onSeeTrail,
  stops,
}: {
  reason: TerminusReason;
  /** What the reader was inside, so the card can name it rather than saying
   *  "this area". Absent for a free drift. */
  focusLabel?: string;
  /** Let the focus go and wander freely. Absent when there is no focus to let go
   *  of. This is also what "go wider" would mean: the engine has already climbed
   *  every widening ladder it has before an ending is ever placed, so a second
   *  button offering it would be the same action under a different name, which
   *  is worse than no button (§2). */
  onDriftFreely?: () => void;
  /**
   * Ask the source again. Only ever passed for `source-quiet`, because it is the
   * only ending that might not be true a moment from now. The feed retries on
   * its own behind this card; the button is for the reader who does not want to
   * wait, and it is the only way out for someone standing ON the card (the feed
   * will not swap the thing under their eye).
   */
  onRetry?: () => void;
  onSeeTrail: () => void;
  stops: number;
}) {
  const copy = COPY[reason];
  return (
    <section
      data-terminus={reason}
      aria-label={copy.title}
      className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-paper-raised px-6 py-10 text-center shadow-[0_10px_40px_-12px_rgba(43,39,35,0.25)] ring-1 ring-line"
    >
      <div className="max-w-sm">
        <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
          {copy.eyebrow}
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight text-ink sm:text-4xl">
          {copy.title}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink/75">
          {focusLabel && reason === "pool-dry"
            ? copy.body.replace("this area", focusLabel)
            : copy.body}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {stops} {stops === 1 ? "stop" : "stops"} so far.
        </p>

        <div className="mt-7 flex flex-col items-stretch gap-2.5">
          {/* A quiet source is a pause, so the way ONWARD leads and the trail
              waits below it. Every other ending really is an ending, and there
              the trail leads. */}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
            >
              Try again
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSeeTrail}
            className={
              onRetry
                ? "focus-ring rounded-full border border-line-strong bg-paper-raised px-5 py-2.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
                : "focus-ring rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
            }
          >
            See where you wandered
          </button>
          {onDriftFreely && reason !== "day-done" && (
            <button
              type="button"
              onClick={onDriftFreely}
              className="focus-ring rounded-full border border-line-strong bg-paper-raised px-5 py-2.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
            >
              Drift freely
            </button>
          )}
          {reason === "day-done" && (
            <Link
              href="/"
              className="focus-ring rounded-full border border-line-strong bg-paper-raised px-5 py-2.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
            >
              Head home
            </Link>
          )}
        </div>

        {/* Scrolling back up is the obvious move here and it is worth saying
            once, because the feed has just moved on its own for the only time it
            ever will. */}
        <p className="mt-6 text-xs text-ink-soft">
          Scroll back up to read anything again.
        </p>
      </div>
    </section>
  );
}

// The wording, kept together so the four endings read as one family rather than
// as four separate voices. Same register as the rest of the app: quiet, honest,
// never urgent. `this area` is substituted for the focus's own name, and ONLY in
// `pool-dry`: it is the only ending that is actually a claim about the area.
const COPY: Record<
  TerminusReason,
  { eyebrow: string; title: string; body: string }
> = {
  "pool-dry": {
    eyebrow: "The end of this thread",
    title: "You have read this area dry",
    body: "There is nothing left in this area that you have not already seen. Pull a thread from any card above, or let it go and drift freely.",
  },
  "caught-up": {
    eyebrow: "Caught up",
    title: "You are up to date here",
    body: "You have read this story and everything around it. New ones surface over the next few days, so this is a good place to stop rather than a wall.",
  },
  // ⚠️ THIS WORDING IS THE POINT OF THE WHOLE ENDING. The feed used to show the
  // "read this area dry" card here, which told a reader that the whole of
  // Wikipedia was exhausted because one request had failed. Say what is actually
  // known: nobody answered, nothing is lost, and it will be asked again.
  "source-quiet": {
    eyebrow: "A pause, not an ending",
    title: "The source is catching its breath",
    body: "We could not reach it just now, so there is nothing new to show yet. Nothing you have read is lost. Try again in a moment, or scroll back up to anything above.",
  },
  "day-done": {
    // Same wording rule as components/DayDone.tsx and the exit screen: the day
    // ending is the point, and the supporter unlock is never sold as "pay to
    // keep scrolling".
    eyebrow: "That is a day’s wandering",
    title: "Today’s reading is done",
    body: "Here is where it went. The feed opens again tomorrow.",
  },
};
