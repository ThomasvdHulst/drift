"use client";

import type { Thread, ThreadKind } from "@/lib/types";

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

// Display metadata for each thread direction (Phase 6). Shared with the mode chip
// + trail map so the vocabulary stays consistent everywhere.
export const KIND_META: Record<ThreadKind, { word: string }> = {
  deeper: { word: "Go deeper" },
  zoomout: { word: "Zoom out" },
  nearby: { word: "Nearby" },
  tangent: { word: "Tangent" },
};

// The direction glyph: magnifier-plus (deeper) / magnifier-minus (zoom out) /
// diverging arrow (tangent) / soft wave (nearby). Calm line icons, no casino.
export function KindIcon({ kind, size = 13 }: { kind: ThreadKind; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "shrink-0",
  };
  switch (kind) {
    case "deeper":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="6" />
          <path d="M14.5 14.5 20 20" />
          <path d="M10 7.5v5M7.5 10h5" />
        </svg>
      );
    case "zoomout":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="6" />
          <path d="M14.5 14.5 20 20" />
          <path d="M7.5 10h5" />
        </svg>
      );
    case "tangent":
      return (
        <svg {...common}>
          <path d="M5 19 19 5" />
          <path d="M12 5h7v7" />
        </svg>
      );
    case "nearby":
    default:
      return (
        <svg {...common}>
          <path d="M3 9c2-2.4 4-2.4 6 0s4 2.4 6 0" />
          <path d="M3 14c2-2.4 4-2.4 6 0s4 2.4 6 0" />
        </svg>
      );
  }
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
        No threads here. Drift onward ↓
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {threads.map((thread) => {
        const kind = thread.kind;
        return (
          <button
            key={thread.candidate.pageTitle}
            type="button"
            disabled={disabled}
            onClick={() => onThread(thread)}
            title={thread.candidate.description || thread.candidate.displayTitle}
            aria-label={
              kind ? `${KIND_META[kind].word}: ${thread.label}` : thread.label
            }
            className={
              kind
                ? "group inline-flex max-w-full flex-col items-start gap-0.5 rounded-2xl border border-accent/35 bg-accent/10 px-3.5 py-1.5 text-left text-sm font-medium text-accent-strong transition-colors hover:border-accent/60 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
                : "group inline-flex max-w-full items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-left text-sm font-medium text-accent-strong transition-colors hover:border-accent/60 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
            }
          >
            {kind ? (
              <>
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent-strong/80">
                  <KindIcon kind={kind} size={11} />
                  {KIND_META[kind].word}
                </span>
                <span className="max-w-[42vw] truncate sm:max-w-[16rem]">
                  {thread.label}
                </span>
              </>
            ) : (
              <>
                <ThreadIcon />
                <span className="truncate">{thread.label}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
