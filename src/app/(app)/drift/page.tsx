"use client";

// The feed route. Two shells render the same `useDriftSession` engine — the
// card-at-a-time feed Drift has always had, and the continuous scroller behind
// NEXT_PUBLIC_FEED_CONTINUOUS — and this file is only the switch between them.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { continuousEnabled, feedMode } from "@/lib/feedmode";
import { DiscreteFeed } from "./DiscreteFeed";
import { ContinuousFeed } from "./ContinuousFeed";

// Read once, at module scope: Next only inlines NEXT_PUBLIC_* on a static member
// access, and the answer cannot change while the page is open.
const CONTINUOUS = continuousEnabled();

// `useSearchParams` needs a Suspense boundary above it, and the feed already has
// a "Finding a starting point…" state, so the boundary reuses it.
export default function DriftPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-paper">
          <p className="animate-pulse font-serif text-xl text-ink-soft">
            Finding a starting point…
          </p>
        </div>
      }
    >
      <FeedShell />
    </Suspense>
  );
}

function FeedShell() {
  // `?feed=classic` sends a reader back to the card-at-a-time feed, so the two
  // can be compared on ONE build without rebuilding and losing your place. It
  // only works while the flag is on, and only in that direction — see
  // lib/feedmode.ts for why a URL may never switch the new feed ON.
  const mode = feedMode({
    enabled: CONTINUOUS,
    param: useSearchParams().get("feed"),
  });
  return mode === "continuous" ? <ContinuousFeed /> : <DiscreteFeed />;
}
