"use client";

// The feed route.
//
// There used to be two shells here and a flag between them — the card-at-a-time
// feed Drift shipped with, and the continuous scroller. The scroller is now the
// only feed, so this file is just the Suspense boundary that `useDriftSession`'s
// `useSearchParams` needs, and the "Finding a starting point…" state the feed
// reuses while a session loads.

import { Suspense } from "react";
import { ContinuousFeed } from "./ContinuousFeed";

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
      <ContinuousFeed />
    </Suspense>
  );
}
