"use client";

import type { Focus } from "@/lib/focus";
import { describeFocus } from "@/lib/focus";

// The persistent, transparent marker for a focused drift (Phase 18). A calm sage
// pill under the top bar: it names the field/seed you're confined to (and, for an
// orbit, how far out you've wandered) and offers the one-tap release, "Drift
// freely". Dismissing it = releasing the focus (§2.1 transparency, §2.2 agency).
export function FocusBanner({
  focus,
  proximity,
  onRelease,
}: {
  focus: Focus;
  // Orbit-only: a "how far from the seed" word ("nearby" … "far out"). Absent for
  // a field focus (a field has no distance).
  proximity?: string;
  onRelease: () => void;
}) {
  return (
    <div className="pointer-events-none flex justify-center px-4 pt-1.5">
      <div className="pointer-events-auto inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-accent/12 py-1 pl-3 pr-1.5 text-xs font-medium text-accent-strong ring-1 ring-accent/25">
        <FocusIcon kind={focus.kind} />
        <span className="truncate">{describeFocus(focus)}</span>
        {proximity && (
          <span className="text-accent-strong/70">· {proximity}</span>
        )}
        <button
          type="button"
          onClick={onRelease}
          className="ml-0.5 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 font-semibold transition hover:bg-accent/20"
        >
          Drift freely
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// A field reads as a filled center held inside a ring ("you're within this");
// an orbit reads as concentric rings with a travelling dot ("circling this"); a
// current-events drift reads as a broadcast, waves going out from a point.
function FocusIcon({ kind }: { kind: Focus["kind"] }) {
  if (kind === "current") {
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="17" r="1.8" fill="currentColor" stroke="none" />
        <path d="M8.5 13.5a5 5 0 0 1 7 0" />
        <path d="M5.5 10a9.5 9.5 0 0 1 13 0" />
      </svg>
    );
  }
  if (kind === "orbit") {
    return (
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="9" />
        <circle cx="21" cy="12" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
