"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-level error boundary (App Router). Catches render/runtime errors in the
// app subtree and shows a calm, on-brand fallback instead of a white crash — the
// gentle-awareness ethos (§2) even in failure. The error is logged so it surfaces
// in Vercel's Function/Client logs; wire a reporter here (e.g. Sentry) later if
// you want aggregation + alerts (see docs/beta-readiness.md Q4).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[drift] unhandled error", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-paper px-6 text-center">
      <div className="max-w-sm space-y-3">
        <h1 className="font-serif text-3xl text-ink">Something drifted off course</h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          A small hiccup, not your fault. Your saved trails are safe. You can try
          again, or head back home and pick up where you left off.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-line px-5 py-2.5 text-sm text-ink transition hover:border-accent/50 hover:text-accent-strong"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
