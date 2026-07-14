"use client";

import { useEffect, useRef, useState } from "react";
import type { ArrivedVia, Card, Thread } from "@/lib/types";
import type { Reaction } from "@/lib/interest";
import type { RealmId } from "@/lib/realms/types";
import { summaryUrl } from "@/lib/realms";
import { ThreadChips, KindIcon, KIND_META } from "./ThreadChips";

// Quiet ♥ / ✕ that teach the interest model (M9). Sage when active, neutral
// otherwise — deliberately calm, never a red badge (§6, the opposite of a
// casino). "More/less like this" nudges which topics surface while drifting.
function ReactionButtons({
  reaction,
  onReact,
}: {
  reaction?: Reaction;
  onReact: (signal: Reaction) => void;
}) {
  const base =
    "flex h-8 w-8 items-center justify-center rounded-full border transition";
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => onReact("like")}
        aria-label="More topics like this"
        aria-pressed={reaction === "like"}
        title="More like this"
        className={
          reaction === "like"
            ? `${base} border-accent/50 bg-accent/15 text-accent-strong`
            : `${base} border-line text-ink-soft hover:border-accent/40 hover:text-accent-strong`
        }
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={reaction === "like" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onReact("dislike")}
        aria-label="Fewer topics like this"
        aria-pressed={reaction === "dislike"}
        title="Less like this"
        className={
          reaction === "dislike"
            ? `${base} border-ink/30 bg-ink/10 text-ink`
            : `${base} border-line text-ink-soft hover:border-ink/30 hover:text-ink`
        }
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// The mode chip answers "where am I?" — drifting (casual wandering) vs being on a
// thread (a deliberate direction you pulled). Threads read prominent + sage;
// drifting reads quiet + neutral.
function ModeChip({ via }: { via: ArrivedVia }) {
  if (via.type === "thread") {
    // A directional thread (Phase 6) names its move ("Go deeper · Octopus");
    // a plain/legacy thread reads "On a thread · …".
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-strong ring-1 ring-accent/30">
        {via.kind ? (
          <KindIcon kind={via.kind} size={12} />
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="7" cy="7" r="3" />
            <path d="M9.2 9.2C13 13 15 15 21 21" />
          </svg>
        )}
        {via.kind ? `${KIND_META[via.kind].word} · ${via.label}` : `On a thread · ${via.label}`}
      </span>
    );
  }
  // Drift wording answers "why this card?" (transparency, §2.1): a personalized
  // pick names the interest; a serendipity pick is flagged as a wildcard; a
  // plain/legacy drift just reads "Drifting".
  let label = "Drifting";
  if (via.type === "seed") {
    label = "Starting point";
  } else if (via.type === "drift" && via.topic) {
    label =
      via.reason === "interest"
        ? `Because you like ${via.topic.label}`
        : `Drifting · ${via.topic.label}`;
  }
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12c2.5-4 5.5-4 8 0s5.5 4 8 0" />
      </svg>
      {label}
    </span>
  );
}

function ImagePanel({ card }: { card: Card }) {
  if (!card.imageUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-accent/10">
        <span className="font-serif text-7xl text-accent/40">
          {card.displayTitle.charAt(0)}
        </span>
      </div>
    );
  }
  // Art gets shown whole (never cropped) on a soft ground — a gallery wall, not a
  // full-bleed hero. Everything else fills the panel.
  const isArt = card.source === "artic";
  if (isArt) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-ink/[0.04] p-4 sm:p-6">
        <img
          src={card.imageUrl}
          alt={card.displayTitle}
          className="max-h-full max-w-full object-contain shadow-md"
          draggable={false}
        />
      </div>
    );
  }
  return (
    <img
      src={card.imageUrl}
      alt={card.displayTitle}
      className="h-full w-full object-cover"
      draggable={false}
    />
  );
}

// The "from the source" link label, per realm's content source.
function sourceLinkLabel(source?: string): string {
  if (source === "artic") return "View at the Art Institute ↗";
  if (source === "gutenberg") return "Read the full text ↗";
  return "From Wikipedia ↗";
}

export function CardView({
  card,
  realm,
  arrivedVia,
  threads,
  threadsLoading,
  onThread,
  onExpand,
  reaction,
  onReact,
}: {
  card: Card;
  realm: RealmId;
  arrivedVia: ArrivedVia;
  threads: Thread[];
  threadsLoading: boolean;
  onThread: (thread: Thread) => void;
  onExpand?: () => void;
  reaction?: Reaction;
  onReact?: (signal: Reaction) => void;
}) {
  // "Read more" reveals the first several BODY paragraphs (fetched lazily, once).
  // Local state resets per card because the parent re-keys CardView by pageTitle.
  const [open, setOpen] = useState(false);
  const [longText, setLongText] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function toggleReadMore() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    onExpand?.();
    if (longText === null) {
      setLoadingMore(true);
      try {
        const res = await fetch(
          summaryUrl(realm, card.pageTitle, { extended: true }),
        );
        if (res.ok) {
          const data = (await res.json()) as {
            extract?: string;
            hasMore?: boolean;
          };
          if (data?.extract) {
            setLongText(data.extract);
            setHasMore(!!data.hasMore);
          }
        }
      } catch {
        // keep the short extract on failure
      } finally {
        setLoadingMore(false);
      }
    }
  }

  // Keyboard shortcut: "r" toggles read-more for the current card (ignored while
  // typing in a field). Uses a ref so the mount-only listener sees the latest.
  const toggleRef = useRef(toggleReadMore);
  useEffect(() => {
    toggleRef.current = toggleReadMore;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "r" && e.key !== "R") return;
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA")
      )
        return;
      toggleRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-paper-raised shadow-[0_10px_40px_-12px_rgba(43,39,35,0.25)] ring-1 ring-line md:flex-row">
      {/* Image panel — left on wide screens, top on narrow. */}
      <div className="relative h-[34vh] w-full shrink-0 md:h-full md:w-1/2 lg:w-[55%]">
        <ImagePanel card={card} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-paper-raised/70 to-transparent md:hidden" />
      </div>

      {/* Reading column. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6 sm:p-8 md:p-10 lg:p-12">
        <div className="flex items-center justify-between gap-3">
          <ModeChip via={arrivedVia} />
          {onReact && <ReactionButtons reaction={reaction} onReact={onReact} />}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {card.description && (
            <p className="text-sm font-medium uppercase tracking-wide text-ink-soft">
              {card.description}
            </p>
          )}
          <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl lg:text-5xl">
            {card.displayTitle}
          </h1>
          <div className="relative flex flex-col gap-3">
            {(open && longText ? longText.split("\n\n") : [card.extract]).map(
              (para, i) => (
                <p
                  key={i}
                  className="text-base leading-relaxed text-ink/85 sm:text-lg"
                >
                  {para}
                </p>
              ),
            )}
            {/* Soft fade at the truncation point — a quiet "there's more on
                Wikipedia" cue, not a tease to keep scrolling in-app. */}
            {open && hasMore && !loadingMore && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-paper-raised to-transparent" />
            )}
          </div>
          {open && loadingMore && (
            <p className="text-sm italic text-ink-soft">Fetching the rest…</p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={toggleReadMore}
              className="text-sm font-medium text-accent-strong underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent"
            >
              {open ? "Show less" : "Read more"}
            </button>
            <a
              href={card.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-accent-strong underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent"
            >
              {sourceLinkLabel(card.source)}
            </a>
          </div>
        </div>

        {/* Threads pinned to the bottom of the reading column. */}
        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-5">
          <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
            Pull a thread
          </p>
          <ThreadChips
            threads={threads}
            loading={threadsLoading}
            onThread={onThread}
          />
        </div>
      </div>
    </div>
  );
}
