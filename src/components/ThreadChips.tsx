"use client";

import type { Thread, ThreadKind } from "@/lib/types";

// A cross-realm "doorway" mark (Phase 15): an arrow leaving a frame — you step
// through into the other realm.
export function DoorwayIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M9 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

function ThreadIcon({ size = 14 }: { size?: number }) {
  // A small "thread being pulled" mark: a knot with a trailing curve.
  return (
    <svg
      width={size}
      height={size}
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

/**
 * "The bridge" (Phase 28): the sentence in which the card you are reading links
 * to this one, quoted from that article. It is the difference between a chip
 * that suggests and a chip that cites, and it is why a thread can now answer
 * the question §2.1 promises the reader always sees an answer to.
 *
 * Quiet on purpose: ink rather than accent, one step down in size, clamped to
 * two lines so three chips still fit a phone. Absent whenever the lead did not
 * link here or did so in a sentence too long to quote whole (lib/bridge.ts), in
 * which case the chip reads exactly as it did before bridges existed — which is
 * itself honest, since an unexplained thread should not look explained.
 */
function Bridge({ sentence }: { sentence?: string }) {
  if (!sentence) return null;
  return (
    <span className="mt-0.5 line-clamp-3 text-[11px] font-normal not-italic leading-snug text-ink/75">
      <span aria-hidden="true">“</span>
      {sentence}
      <span aria-hidden="true">”</span>
    </span>
  );
}

/** How wide a chip's text column may run. A chip that quotes needs a paragraph's
 *  width or the sentence arrives in slivers; an unexplained chip stays compact so
 *  two still sit side by side. The wrapper's flex-wrap does the rest: a bridged
 *  chip simply takes its own row. */
const textWidth = (bridged: boolean) =>
  bridged ? "max-w-[74vw] sm:max-w-[24rem]" : "max-w-[42vw] sm:max-w-[16rem]";

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
      <div
        className="flex flex-wrap gap-2"
        role="status"
        aria-label="Loading threads"
      >
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
        const eyebrow = thread.eyebrow;
        const doorway = thread.doorway;
        // Directional (Encyclopedia `kind`), facet (Gallery `eyebrow`), and
        // cross-realm doorway chips all use the two-line layout: a small character
        // word over the label. A doorway is tinted by its DESTINATION realm (via
        // data-realm) + a dashed border, so it visibly "leads elsewhere".
        const twoLine = !!kind || !!eyebrow;
        return (
          <button
            key={thread.candidate.pageTitle}
            type="button"
            disabled={disabled}
            onClick={() => onThread(thread)}
            data-realm={doorway}
            title={thread.candidate.description || thread.candidate.displayTitle}
            aria-label={
              // The bridge rides along, because a label overrides the content it
              // labels: without this the one chip that explains itself would be
              // the one chip a screen reader hears least about.
              (kind
                ? `${KIND_META[kind].word}: ${thread.label}`
                : eyebrow
                  ? `${eyebrow}: ${thread.label}`
                  : thread.label) +
              (thread.bridge ? `. ${thread.bridge.sentence}` : "")
            }
            className={
              twoLine
                ? `group inline-flex max-w-full flex-col items-start gap-0.5 rounded-2xl border bg-accent/10 px-3.5 py-1.5 text-left text-sm font-medium text-accent-strong transition-colors hover:border-accent/60 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40 ${doorway ? "border-dashed border-accent/60" : "border-accent/35"}`
                : "group inline-flex max-w-full items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-left text-sm font-medium text-accent-strong transition-colors hover:border-accent/60 hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
            }
          >
            {kind || eyebrow ? (
              <>
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent-strong">
                  {kind ? (
                    <KindIcon kind={kind} size={11} />
                  ) : doorway ? (
                    <DoorwayIcon size={11} />
                  ) : (
                    <ThreadIcon size={11} />
                  )}
                  {kind ? KIND_META[kind].word : eyebrow}
                </span>
                <span className={`truncate ${textWidth(!!thread.bridge)}`}>
                  {thread.label}
                </span>
                <Bridge sentence={thread.bridge?.sentence} />
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
