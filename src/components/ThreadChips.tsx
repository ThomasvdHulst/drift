"use client";

import type { Thread } from "@/lib/types";

function ThreadIcon() {
  // A small "thread being pulled" mark: a knot with a trailing curve.
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="7" cy="7" r="3" />
      <path d="M9.2 9.2C13 13 15 15 21 21" />
    </svg>
  );
}

export function ThreadChips({
  threads,
  loading,
  disabled,
  onThread,
}: {
  threads: Thread[];
  loading: boolean;
  disabled?: boolean;
  onThread: (thread: Thread) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2" aria-label="Loading threads">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-9 w-32 animate-pulse rounded-full bg-accent/10"
          />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <p className="text-sm italic text-ink-soft">
        No threads here — drift onward ↓
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {threads.map((thread) => (
        <button
          key={thread.candidate.pageTitle}
          type="button"
          disabled={disabled}
          onClick={() => onThread(thread)}
          title={thread.candidate.displayTitle}
          className="group inline-flex max-w-full items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-left text-sm font-medium text-accent-strong transition-colors hover:border-accent/60 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
        >
          <ThreadIcon />
          <span className="truncate">{thread.label}</span>
        </button>
      ))}
    </div>
  );
}
