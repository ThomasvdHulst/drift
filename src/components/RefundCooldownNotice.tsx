"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  assessCooldown,
  countdownTickMs,
  formatRemaining,
  type BlockedCooldown,
  type CooldownRow,
  type RefundCooldown,
} from "@/lib/billing/cooldown";

// ---------------------------------------------------------------------------
// "You cannot buy this again yet", said once, kindly (Phase 32B).
//
// This is what stands where the buy button stands, for an account that refunded
// its purchase inside the last seven days. Three things it has to get right:
//
//   1. SAY WHY. §2.1 is about the feed, but the same rule holds everywhere: a
//      control that has quietly stopped working is worse than one that explains
//      itself. The reason is a payment fee, so the copy says that, rather than
//      "for security reasons", which is what an app says when it does not want
//      to tell you.
//   2. NOT ACCUSE. A refund is a right, exercised, and most people who hit this
//      will have used it exactly once and honestly. Nothing here calls it abuse
//      or fraud, and the way out is a sentence away.
//   3. COUNT DOWN, NOT UP. The reader is told the moment it lifts and watches it
//      approach. A wait with no visible end is the thing that makes people write
//      angry emails.
//
// The clock is the reader's own, and so is spoofable. It does not matter: this
// only decides what the page SAYS. `/api/billing/checkout` runs the same
// `assessCooldown` against the database before it creates anything, so a moved
// device clock buys nothing but a button that fails.
// ---------------------------------------------------------------------------

/**
 * The verdict, recomputed as the clock moves, so the notice can hand the page
 * back to the buy button the moment the wait is over without a reload.
 *
 * The interval follows `countdownTickMs`: once a second only while seconds are
 * actually on screen, once a minute above that. Changing the number changes the
 * interval, because `tick` is the dependency.
 */
export function useRefundCooldown(row: CooldownRow | null): RefundCooldown {
  const [now, setNow] = useState(() => new Date());
  const verdict = assessCooldown(row, now);
  const tick = verdict.kind === "blocked" ? countdownTickMs(verdict.msLeft) : 0;

  useEffect(() => {
    if (!tick) return;
    const id = window.setInterval(() => setNow(new Date()), tick);
    return () => window.clearInterval(id);
  }, [tick]);

  return verdict;
}

export function RefundCooldownNotice({ cooldown }: { cooldown: BlockedCooldown }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="text-sm font-medium text-ink">Buying again is on hold</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/75">
        Your last purchase was refunded, so this account can buy the unlock again
        in{" "}
        {/* Deliberately no aria-live. A countdown that announced itself every
            second would make this the loudest thing on the page, and nothing
            here is urgent. A screen reader reads it on arrival like any text. */}
        <span className="font-medium text-ink">
          {formatRemaining(cooldown.msLeft)}
        </span>
        . Every refund costs a payment fee that is not given back, and a short
        wait after one is what keeps that from being repeatable.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink/75">
        Nothing else changes. Drift is free to read every day, and your trails
        and settings are untouched. If you would rather not wait,{" "}
        <Link
          href="/contact?topic=account"
          className="focus-ring rounded underline decoration-line underline-offset-2 transition hover:text-accent-strong"
        >
          get in touch
        </Link>{" "}
        and it can be lifted by hand.
      </p>
    </div>
  );
}
