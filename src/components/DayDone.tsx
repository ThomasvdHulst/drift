"use client";

import Link from "next/link";

// ---------------------------------------------------------------------------
// "That is today's reading" — the screen a reader meets when they open the feed
// with the day's allowance already spent (Phase 32).
//
// WHY THIS IS NOT A PAYWALL SCREEN. The daily allowance exists because a day's
// reading should end, which is principle §2.3: a session has a beginning, a
// middle and an end, and the reward sits at the exit rather than at the next
// swipe. So this page is the exit. It points at what the reader made (their
// trails, their atlas), not at what they cannot have.
//
// The things deliberately absent, because each one is a casino fitting:
//   • no countdown to midnight (a timer turns waiting into anticipation)
//   • no "come back tomorrow" (that is a retention hook wearing a friendly face)
//   • no streak, no badge, no number that resets and must be defended
//   • nothing dimmed, blurred or teased behind the message
//
// The mid-session version of this moment is different and lives in the feed: it
// ends into the TRAIL MAP, because there the reader has just made something.
// Here they have not, so there is nothing to show and it says so plainly.
// ---------------------------------------------------------------------------

export function DayDone({ stops }: { stops: number }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Today
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-ink">
          That is a day&rsquo;s wandering
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink/75">
          {stops > 0
            ? `You made ${stops} ${stops === 1 ? "stop" : "stops"} today. The feed opens again tomorrow.`
            : "The feed opens again tomorrow."}{" "}
          Everything you have already read is still here.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/trails"
            className="focus-ring rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
          >
            Your trails
          </Link>
          <Link
            href="/atlas"
            className="focus-ring rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Your atlas
          </Link>
        </div>

        {/* The one mention of the unlock, and the wording is the whole point.
            It leads with supporting the project, because that is the honest
            reason to pay, and names the lifted limit second as a consequence.
            "Pay to keep reading" would be the casino's pitch: it would sell
            volume of consumption at the exact moment the app has just said a
            day of reading is enough. Quiet type, below the trails links, no
            button, no price shouted, and it appears once. */}
        <p className="mt-10 text-sm leading-relaxed text-ink-soft">
          Drift carries no advertising and takes nothing from you.{" "}
          <Link
            href="/supporter"
            className="focus-ring rounded underline decoration-line underline-offset-4 transition hover:text-accent-strong"
          >
            Supporting it
          </Link>{" "}
          keeps it running, and lifts this daily limit.
        </p>

        <p className="mt-6 text-sm text-ink-soft">
          <Link
            href="/"
            className="focus-ring rounded underline decoration-line underline-offset-4 transition hover:text-accent-strong"
          >
            Back to the start
          </Link>
        </p>
      </div>
    </div>
  );
}
