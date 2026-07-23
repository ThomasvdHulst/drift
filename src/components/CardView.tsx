"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ArrivedVia, Card, Thread } from "@/lib/types";
import type { Reaction } from "@/lib/interest";
import type { RealmId } from "@/lib/realms/types";
import { summaryUrl, getRealm } from "@/lib/realms";
import { proximityWord } from "@/lib/orbit";
import { freshnessWord } from "@/lib/current";
import { ThreadChips, KindIcon, KIND_META, DoorwayIcon } from "./ThreadChips";
import { ArtZoom } from "./ArtZoom";
import { PaperCover } from "./PaperCover";
import { MathText } from "./MathText";

// Quiet thumbs up / thumbs down that teach the interest model (M9). Sage when
// active, neutral otherwise — deliberately calm, never a red badge (§6, the
// opposite of a casino). "More/less like this" nudges which topics surface while
// drifting.
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
    <div data-tour="card-reactions" className="flex shrink-0 items-center gap-1.5">
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
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
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
        <svg width="15" height="15" viewBox="0 0 24 24" fill={reaction === "dislike" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 14V2" />
          <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
      </button>
    </div>
  );
}

// A quiet "send this card to a friend" action (Phase 10). Same calm register as
// the reaction buttons — a small paper-plane, never a loud call to share.
function ShareButton({ onShare }: { onShare: () => void }) {
  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Send to a friend"
      title="Send to a friend"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition hover:border-accent/40 hover:text-accent-strong"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    </button>
  );
}

// "Drift around this" (Phase 18): re-anchor the drift as an orbit of THIS page.
// Same calm register as the reaction / share buttons — a small orbit mark.
function OrbitButton({ onOrbit }: { onOrbit: () => void }) {
  return (
    <button
      type="button"
      onClick={onOrbit}
      aria-label="Drift around this page"
      title="Drift around this"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition hover:border-accent/40 hover:text-accent-strong"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
        <ellipse cx="12" cy="12" rx="10" ry="4.4" />
      </svg>
    </button>
  );
}

// The mode chip answers "where am I?" — drifting (casual wandering) vs being on a
// thread (a deliberate direction you pulled). Threads read prominent + sage;
// drifting reads quiet + neutral.
function ModeChip({ via, realmLabel }: { via: ArrivedVia; realmLabel: string }) {
  if (via.type === "thread") {
    // A cross-realm doorway (Phase 15) reads "Crossed to {realm} · …"; a
    // directional thread (Phase 6) names its move ("Go deeper · Octopus"); a
    // plain/legacy thread reads "On a thread · …".
    const crossed = via.crossedFrom !== undefined;
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-strong ring-1 ring-accent/30">
        {crossed ? (
          <DoorwayIcon size={12} />
        ) : via.kind ? (
          <KindIcon kind={via.kind} size={12} />
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="7" cy="7" r="3" />
            <path d="M9.2 9.2C13 13 15 15 21 21" />
          </svg>
        )}
        {crossed
          ? `Crossed to ${realmLabel} · ${via.label}`
          : via.kind
            ? `${KIND_META[via.kind].word} · ${via.label}`
            : `On a thread · ${via.label}`}
      </span>
    );
  }
  // Drift wording answers "why this card?" (transparency, §2.1): a liked-follow
  // names the card you liked; a personalized pick names the interest; a
  // serendipity pick is flagged as a wildcard; a realm-crossing wander reads
  // "Crossed to …"; a plain drift reads "Drifting".
  const crossedDrift = via.type === "drift" && via.crossedFrom !== undefined;
  let label = "Drifting";
  if (via.type === "seed") {
    label = "Starting point";
  } else if (via.type === "drift" && crossedDrift) {
    label = via.topic ? `Crossed to ${realmLabel} · ${via.topic.label}` : `Crossed to ${realmLabel}`;
  } else if (via.type === "drift" && via.current) {
    // "In the news" (Phase 23). The banner already names the section, so the
    // chip carries the part only it knows: how current this article actually is,
    // that the section's news pool ran out and we're wandering its neighbourhood,
    // or that you've read the section dry and this is one you've seen before.
    // Being honest about those second and third halves matters most.
    label = via.current.revisit
      ? "In the news · seen before"
      : via.current.widened
        ? "In the news · wandering wider"
        : `In the news · ${freshnessWord(via.current.daysAgo ?? 0)}`;
  } else if (via.type === "drift" && via.orbit) {
    label = `Orbiting ${via.orbit.seedLabel} · ${proximityWord(via.orbit.ring)}`;
  } else if (via.type === "drift" && via.fromLiked) {
    label = `More like ${via.fromLiked}`;
  } else if (via.type === "drift" && via.topic) {
    label =
      via.reason === "interest"
        ? `Because you like ${via.topic.label}`
        : `Drifting · ${via.topic.label}`;
  }
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
      {crossedDrift ? (
        <DoorwayIcon size={12} />
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12c2.5-4 5.5-4 8 0s5.5 4 8 0" />
        </svg>
      )}
      {label}
    </span>
  );
}

function ImagePanel({ card, onZoom }: { card: Card; onZoom?: () => void }) {
  // Blur-up: a tiny base64 placeholder (art: AIC `lqip`) sits behind the real
  // image and fades out once it loads — no layout shift, a calm reveal.
  const [loaded, setLoaded] = useState(false);
  const alt = card.imageAlt || card.displayTitle;
  // Papers have no image: render a generated, field-themed cover instead (Phase 17).
  if (card.source === "arxiv" && card.cover) {
    const fieldLabel = card.facts?.find((f) => f.label === "Field")?.value;
    return <PaperCover cover={card.cover} label={fieldLabel} />;
  }
  if (!card.imageUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-accent/10">
        <span className="font-serif text-7xl text-accent/40">
          {card.displayTitle.charAt(0)}
        </span>
      </div>
    );
  }
  const blur = card.blurDataUrl;
  // Art gets shown whole (never cropped) on a soft ground — a gallery wall, not a
  // full-bleed hero. Everything else fills the panel.
  const isArt = card.source === "artic";
  if (isArt) {
    const artInner = (
      <>
        {blur && (
          <img
            src={blur}
            alt=""
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-2xl transition-opacity duration-700 ${loaded ? "opacity-0" : "opacity-60"}`}
            draggable={false}
          />
        )}
        <img
          src={card.imageUrl}
          alt={alt}
          onLoad={() => setLoaded(true)}
          className="relative max-h-full max-w-full object-contain shadow-md"
          draggable={false}
        />
      </>
    );
    const groundCls =
      "relative flex h-full w-full items-center justify-center overflow-hidden bg-ink/[0.04] p-4 sm:p-6";
    // Tappable to open the deep-zoom lightbox (M-G2), with a quiet corner cue.
    if (onZoom) {
      return (
        <button
          type="button"
          onClick={onZoom}
          aria-label="Zoom into the artwork"
          className={`group cursor-zoom-in ${groundCls}`}
        >
          {artInner}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-paper/85 text-ink opacity-75 shadow ring-1 ring-line transition group-hover:opacity-100"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="6" />
              <path d="M14.5 14.5 20 20M10 7.5v5M7.5 10h5" />
            </svg>
          </span>
        </button>
      );
    }
    return <div className={groundCls}>{artInner}</div>;
  }
  return (
    <div className="relative h-full w-full overflow-hidden">
      {blur && (
        <img
          src={blur}
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-2xl transition-opacity duration-700 ${loaded ? "opacity-0" : "opacity-100"}`}
          draggable={false}
        />
      )}
      <img
        src={card.imageUrl}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className="relative h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}

// The "from the source" link label, per realm's content source.
function sourceLinkLabel(source?: string): string {
  if (source === "artic") return "View at the Art Institute ↗";
  if (source === "gutenberg") return "Read the full text ↗";
  if (source === "arxiv") return "Read the full paper ↗";
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
  onShare,
  onOrbit,
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
  onShare?: () => void;
  onOrbit?: () => void;
}) {
  // "Read more" reveals the first several BODY paragraphs (fetched lazily, once).
  // Local state resets per card because the parent re-keys CardView by pageTitle.
  const [open, setOpen] = useState(false);
  const [longText, setLongText] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // The "museum label" (Phase 14): structured metadata, disclosed on tap so it
  // never eats a small screen. Only art carries `card.facts`.
  const [showDetails, setShowDetails] = useState(false);
  // Deep-zoom lightbox (M-G2): only art with a hi-res `zoomUrl` is zoomable.
  const [zoomOpen, setZoomOpen] = useState(false);
  const canZoom = card.source === "artic" && !!card.zoomUrl;
  const onZoom = canZoom ? () => setZoomOpen(true) : undefined;

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
      {/* Desktop: a fixed image panel on the left. Hidden on phones, where the
          image instead lives inside the scroll flow below (so it scrolls away
          and the text gets the full height). */}
      <div className="relative hidden shrink-0 md:block md:h-full md:w-1/2 lg:w-[55%]">
        <ImagePanel card={card} onZoom={onZoom} />
      </div>

      {/* Reading side: one scroll region + a pinned threads bar. The whole
          reading side scrolls (image included on phones), and the feed's gesture
          handler reads this region's edges (via [data-drift-scroll]) to tell
          "scroll to read" from "overscroll to drift on" — see lib/gesture. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          data-drift-scroll
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-6 pb-4 pt-6 sm:px-8 sm:pt-8 md:px-10 md:pt-10 lg:px-12 lg:pt-12"
        >
          {/* Phone-only hero, full-bleed to the card's rounded top; it scrolls
              up out of the way as you read. */}
          <div className="relative -mx-6 -mt-6 h-[34dvh] shrink-0 overflow-hidden sm:-mx-8 sm:-mt-8 md:hidden">
            <ImagePanel card={card} onZoom={onZoom} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-paper-raised/70 to-transparent" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <ModeChip via={arrivedVia} realmLabel={getRealm(realm).label} />
            <div className="flex shrink-0 items-center gap-1.5">
              {onReact && <ReactionButtons reaction={reaction} onReact={onReact} />}
              {onOrbit && <OrbitButton onOrbit={onOrbit} />}
              {onShare && <ShareButton onShare={onShare} />}
            </div>
          </div>

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
                  <MathText text={para} />
                </p>
              ),
            )}
            {/* Soft fade at the truncation point — a quiet "there's more at the
                source" cue, not a tease to keep scrolling in-app. */}
            {open && hasMore && !loadingMore && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-paper-raised to-transparent" />
            )}
          </div>
          {open && loadingMore && (
            <p className="text-sm italic text-ink-soft">Fetching the rest…</p>
          )}
          {/* The museum label — a calm, tap-to-open "Details" block (art only).
              Inline scroll content, so it never overlays or eats the viewport on
              a phone; the two-column list wraps long values instead of overflowing. */}
          {card.facts && card.facts.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                aria-expanded={showDetails}
                className="flex w-fit items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-ink-soft transition hover:text-accent-strong"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`transition-transform ${showDetails ? "rotate-90" : ""}`}
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
                Details
              </button>
              {showDetails && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                  {card.facts.map((f) => (
                    <Fragment key={f.label}>
                      <dt className="pt-0.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
                        {f.label}
                      </dt>
                      <dd className="text-sm text-ink/85">{f.value}</dd>
                    </Fragment>
                  ))}
                </dl>
              )}
            </div>
          )}
          <div
            data-tour="card-readmore"
            className="flex flex-wrap items-center gap-4"
          >
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
          {/* A quiet, static wayfinding cue for the overscroll-to-advance
              gesture — not a tease (no autoplay/countdown); the bottom-nav
              Advance button stays the explicit control (§2.2). */}
          <p className="pt-1 text-center text-xs text-ink-soft/70">
            ⌄ keep scrolling to drift onward
          </p>
        </div>

        {/* Threads pinned below the scroll region — always reachable, and they
            don't eat into the reading height. */}
        <div
          data-tour="card-threads"
          className="flex shrink-0 flex-col gap-3 border-t border-line px-6 py-4 sm:px-8 md:px-10 lg:px-12"
        >
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

      {zoomOpen && card.zoomUrl && (
        <ArtZoom
          src={card.zoomUrl}
          alt={card.imageAlt || card.displayTitle}
          blurDataUrl={card.blurDataUrl}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </div>
  );
}
