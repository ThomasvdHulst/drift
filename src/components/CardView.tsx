"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ArrivedVia, Card, Thread } from "@/lib/types";
import type { Reaction } from "@/lib/interest";
import type { RealmId } from "@/lib/realms/types";
import { summaryUrl, getRealm } from "@/lib/realms";
import { proximityWord } from "@/lib/orbit";
import { freshnessWord } from "@/lib/current";
import { countWord } from "@/lib/text";
import {
  licenseFor,
  MODIFICATION_CARD,
  MODIFICATION_FULL,
} from "@/lib/licenses";
import {
  mayDisplayImage,
  creditLine,
  type ImageCredit,
} from "@/lib/imagecredit";
import type { Block, Fact } from "@/lib/wikihtml";
import type { ExtendedBody } from "@/lib/types";
import { CardTable } from "./CardTable";
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
    "flex h-8 w-8 items-center justify-center rounded-full border transition focus-ring";
  return (
    <div
      data-tour="card-reactions"
      className="flex shrink-0 items-center gap-1.5"
    >
      <button
        type="button"
        onClick={() => onReact("like")}
        aria-label="More topics like this"
        aria-pressed={reaction === "like"}
        title="More like this"
        className={
          reaction === "like"
            ? `${base} border-accent bg-accent/15 text-accent-strong`
            : `${base} border-line-strong text-ink-soft hover:border-accent hover:text-accent-strong`
        }
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={reaction === "like" ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
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
            ? `${base} border-ink bg-ink/10 text-ink`
            : `${base} border-line-strong text-ink-soft hover:border-ink hover:text-ink`
        }
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill={reaction === "dislike" ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 14V2" />
          <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
      </button>
    </div>
  );
}

// A quiet "share this card" action. Same calm register as the reaction buttons:
// a small paper-plane, never a loud call to share, and nothing anywhere counts
// or reports what happens to it (§2).
//
// It used to say "Send to a friend", from Phase 10 when that was all it did.
// It now opens ShareSheet, which offers a public link first and the friend graph
// only if that layer is switched on, so the label had to stop naming the rarer
// of the two.
function ShareButton({ onShare }: { onShare: () => void }) {
  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Share this card"
      title="Share this card"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus-ring border border-line-strong text-ink-soft transition hover:border-accent/40 hover:text-accent-strong"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    </button>
  );
}

// "Drift around this" (Phase 18): re-anchor the drift as an orbit of THIS page.
// Same calm register as the reaction / share buttons — a small orbit mark.
//
// It is a TOGGLE, and it shows its state the way the reaction buttons do: sage
// and filled while the session is orbiting, plain otherwise. Before this the only
// sign anything had happened was the focus banner above the card, so the control
// read as inert and people did not realise they had switched modes.
function OrbitButton({
  onOrbit,
  active,
}: {
  onOrbit: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOrbit}
      data-tour="card-orbit"
      aria-label={
        active ? "Stop drifting around this page" : "Drift around this page"
      }
      aria-pressed={active}
      title={
        active ? "Drifting around this. Tap to stop." : "Drift around this"
      }
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition focus-ring ${
        active
          ? "border-accent bg-accent/15 text-accent-strong"
          : "border-line-strong text-ink-soft hover:border-accent hover:text-accent-strong"
      }`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
        <ellipse cx="12" cy="12" rx="10" ry="4.4" />
      </svg>
    </button>
  );
}

// The mode chip answers "where am I?" — drifting (casual wandering) vs being on a
// thread (a deliberate direction you pulled). Threads read prominent + sage;
// drifting reads quiet + neutral.
function ModeChip({
  via,
  realmLabel,
}: {
  via: ArrivedVia;
  realmLabel: string;
}) {
  if (via.type === "thread") {
    // A cross-realm doorway (Phase 15) reads "Crossed to {realm} · …"; a
    // directional thread (Phase 6) names its move ("Go deeper · Octopus"); a
    // plain/legacy thread reads "On a thread · …".
    const crossed = via.crossedFrom !== undefined;
    return (
      <span className="inline-flex w-fit min-w-0 items-center gap-1.5 break-words rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-strong ring-1 ring-accent/30">
        {crossed ? (
          <DoorwayIcon size={12} />
        ) : via.kind ? (
          <KindIcon kind={via.kind} size={12} />
        ) : (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
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
    label = via.topic
      ? `Crossed to ${realmLabel} · ${via.topic.label}`
      : `Crossed to ${realmLabel}`;
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
    <span className="inline-flex w-fit min-w-0 items-center gap-1.5 break-words rounded-full bg-ink/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
      {crossedDrift ? (
        <DoorwayIcon size={12} />
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
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
  // A Wikipedia image is a SEPARATE work from the article, with its own creator
  // and its own licence, and it may only be shown if we can credit it properly.
  // `mayDisplayImage` fails closed: unknown provenance, a licence needing a credit
  // we do not have, or a file flagged with trademark / personality-rights
  // restrictions all mean no picture (compliance audit B-4). Cards saved before
  // this shipped have no credit, so they land here too, and the card falls back to
  // the monogram below. A card without a picture is a small loss; an uncredited
  // CC BY-SA photograph terminates our licence under §6(a).
  const wikiImageBlocked =
    (card.source ?? "wikipedia") === "wikipedia" &&
    !!card.imageUrl &&
    !mayDisplayImage(card.imageCredit);

  if (!card.imageUrl || wikiImageBlocked) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-accent/10">
        {/* Decorative monogram standing in for a missing image. The card title
            is rendered as real text below, so this carries no information;
            hidden from AT, which also makes it exempt from 1.4.3. */}
        <span className="font-serif text-7xl text-accent/40" aria-hidden="true">
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
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
      <ImageCreditChip credit={card.imageCredit} />
    </div>
  );
}

/**
 * The image's own credit, on the image.
 *
 * CC BY-SA 4.0 §3(a)(1) wants the creator identified and the licence named AND
 * linked; §3(a)(2) accepts a link to "a resource that includes the required
 * information", which for a file is its description page, not the article. So the
 * chip carries all three: who, the licence as a hyperlink, and the file page.
 *
 * A solid paper ground rather than text straight over the photograph: an overlay
 * on an arbitrary image is exactly the unmeasurable composite the contrast work
 * warned about (§10), whereas paper-on-ink is a pair the audit already covers.
 */
function ImageCreditChip({ credit }: { credit?: ImageCredit }) {
  if (!credit) return null;
  const who = creditLine({ ...credit, licenseShortName: undefined });
  if (!who && !credit.licenseShortName) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-2">
      <p className="pointer-events-auto max-w-full truncate rounded-full bg-paper/90 px-2.5 py-1 text-[11px] leading-none text-ink-soft shadow-sm ring-1 ring-line">
        {who && <span>{who}</span>}
        {who && credit.licenseShortName && <span aria-hidden="true"> · </span>}
        {credit.licenseShortName &&
          (credit.licenseUrl ? (
            <a
              href={credit.licenseUrl}
              target="_blank"
              rel="license noopener noreferrer"
              className="underline decoration-ink/30 underline-offset-2 transition hover:text-accent-strong"
            >
              {credit.licenseShortName}
            </a>
          ) : (
            <span>{credit.licenseShortName}</span>
          ))}
        {credit.fileUrl && (
          <>
            <span aria-hidden="true"> · </span>
            <a
              href={credit.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-ink/30 underline-offset-2 transition hover:text-accent-strong"
            >
              file
            </a>
          </>
        )}
      </p>
    </div>
  );
}

// The "Pull a thread" block. Rendered TWICE, in two places, because the right
// place for it genuinely differs by screen:
//
//   • Desktop keeps it pinned under the reading column. There is height to spare,
//     and a permanently visible set of directions is the clearest expression of
//     "you are the algorithm".
//   • Phones inline it at the END of the reading flow. Pinned, it cost 172px in
//     the Gallery and 232px in the Encyclopedia (whose chips are two-line and
//     wrap to three rows) out of a ~700px card, which left about ONE line of
//     prose visible before you had to scroll. Beta feedback was that while
//     scrolling you want the image, title and text, and you only want the threads
//     once you have read enough to go deeper. Inline, they arrive exactly then.
//
// Only one copy is ever visible, so `data-tour` sits on both and the tour picks
// whichever is on screen.
/** One of the ways a stop was left, for the switch below (Phase 30). */
export interface Way {
  /** Index into the trail's steps — what `onWay` is called with. */
  index: number;
  title: string;
  /** Is this the line currently being read? */
  onPath: boolean;
}

/**
 * "Two ways from here" (Phase 30) — the switch at a stop the trail forked at.
 *
 * Without it a branch was a one-way door: `tip` moved onto the new line and the
 * one you left had no route back, so cards you had actually read became
 * unreachable for the rest of the session. That is the opposite of agency
 * (§2.2), and it is why this is navigation rather than a feature.
 *
 * Deliberately quieter than the thread chips beside it: an outline, not a fill.
 * These lead somewhere you have already been, and they must not compete with
 * the chips, which are the ways ONWARD.
 */
function WaysFromHere({
  ways,
  onWay,
}: {
  ways: Way[];
  onWay: (index: number) => void;
}) {
  // One way out is just the trail carrying on; the forward control already says
  // that. This only has something to say at a genuine fork.
  if (ways.length < 2) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
        {countWord(ways.length)} ways from here
      </p>
      <div className="flex flex-wrap gap-2">
        {ways.map((w) => (
          <button
            key={w.index}
            type="button"
            onClick={() => onWay(w.index)}
            // "Which of these am I on" is the question the control exists to
            // answer, so the answer is in the accessible tree, not only in a dot.
            aria-current={w.onPath ? "true" : undefined}
            className={`inline-flex max-w-full items-center gap-2 rounded-full border bg-paper-raised px-3.5 py-1.5 text-sm text-ink transition hover:border-accent/50 hover:text-accent-strong focus-ring ${
              w.onPath ? "border-accent/50" : "border-line"
            }`}
          >
            {w.onPath && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
            <span className="truncate max-w-[42vw] sm:max-w-[14rem]">
              {w.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ThreadsSection({
  threads,
  threadsLoading,
  onThread,
  variant,
  innerRef,
  revisiting,
  ways,
  onWay,
}: {
  threads: Thread[];
  threadsLoading: boolean;
  onThread: (thread: Thread) => void;
  /** `pinned` is the desktop bar below the feed card's scroll region, `inline`
   *  its phone counterpart at the end of the read, and `flow` the one copy a
   *  page-flow card renders at every width (see CardView's `flow` prop). */
  variant: "pinned" | "inline" | "flow";
  innerRef?: React.Ref<HTMLDivElement>;
  revisiting?: boolean;
  ways?: Way[];
  onWay?: (index: number) => void;
}) {
  const CLASSES = {
    pinned:
      "hidden shrink-0 flex-col gap-3 border-t border-line px-6 py-4 sm:px-8 md:flex md:px-10 lg:px-12",
    inline: "flex flex-col gap-3 border-t border-line pt-4 md:hidden",
    // Same as inline, minus the `md:hidden`: in flow mode there is no pinned
    // copy to defer to, so this one shows at every width.
    flow: "flex flex-col gap-3 border-t border-line pt-4",
  } as const;
  return (
    <div ref={innerRef} className={CLASSES[variant]}>
      {/* Outside `data-tour="card-threads"` on purpose. That marker means "a
          thread chip" to the tour and to every script that drives the feed, and
          a way-switch button answering to it would be read as a direction
          onward, which is the one thing it is not. */}
      {ways && onWay && <WaysFromHere ways={ways} onWay={onWay} />}
      <div data-tour="card-threads" className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
          {/* Standing on a stop you already left, a chip does not continue the
              line, it starts a new one. Phase 29 made that true and nothing said
              so, which left the reader to discover the fork at the exit screen
              (§2.1). Naming it here is the whole fix. */}
          {revisiting ? "Another way from here" : "Pull a thread"}
        </p>
        <ThreadChips
          threads={threads}
          loading={threadsLoading}
          onThread={onThread}
        />
      </div>
    </div>
  );
}

// The "from the source" link label, per realm's content source.
function sourceLinkLabel(source?: string): string {
  // The museum's full name, not a short form: AIC REQUESTS the caption "Artist.
  // Title, Date. The Art Institute of Chicago." The card already carries the
  // artist, title and date (title + description), so naming the institution in
  // full here completes it (compliance audit Mi-1). CC0 imposes no attribution
  // condition, so this is courtesy rather than obligation.
  if (source === "artic") return "The Art Institute of Chicago ↗";
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
  orbiting = false,
  flow = false,
  revisiting = false,
  ways,
  onWay,
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
  /** True while the session is orbiting THIS card's page, so the control can
   *  show it (see OrbitButton). */
  orbiting?: boolean;
  /**
   * Render as part of a scrolling PAGE rather than as a fixed-height card that
   * scrolls inside itself.
   *
   * The default shape belongs to the feed, where the card owns the whole
   * viewport and the page behind it does not scroll: one scroll region, marked
   * `[data-drift-scroll]`, whose edges the drift gesture reads to tell "scrolling
   * to read" from "overscrolling to drift onward".
   *
   * Dropped into an ordinary page (the public share page, /s/<token>), that
   * shape is actively wrong. You get two nested scrollers, and on a phone they
   * fight: a drag over the prose either moves the page and carries the card out
   * of view, or moves the card and feels stuck. Reported as "I cannot scroll on
   * that post", which was accurate.
   *
   * In flow mode the card grows to its content and the PAGE scrolls, which is
   * what a reader who arrived from a chat message expects. Everything that only
   * makes sense inside the feed goes quiet with it: the scroll region, the
   * "threads below" hint (they are simply further down the page now), the
   * overscroll-to-advance cue (there is nothing to advance to), and the pinned
   * desktop thread bar (nothing to pin against).
   */
  flow?: boolean;
  /** The reader is on a stop they already left (Phase 30), so pulling a thread
   *  branches rather than continues. Feeds the heading above the chips. */
  revisiting?: boolean;
  /** The ways this stop was left, when it was left more than once, plus the
   *  handler that steps onto one. Both absent outside the feed (a share page
   *  and the landing demo have no trail to navigate). */
  ways?: Way[];
  onWay?: (index: number) => void;
}) {
  // "Read more" reveals the first several BODY paragraphs (fetched lazily, once).
  // Local state resets per card because the parent re-keys CardView by pageTitle.
  const [open, setOpen] = useState(false);
  const [longText, setLongText] = useState<string | null>(null);
  // The same body WITH its tables, in reading order (Phase 26). Encyclopedia only;
  // `longText` stays the fallback for every other realm and for any page whose
  // HTML we could not parse, so this can only ever add to the read.
  const [longBlocks, setLongBlocks] = useState<Block[] | null>(null);
  // The page's infobox, as rows for the Details disclosure below.
  const [longFacts, setLongFacts] = useState<Fact[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // The "museum label" (Phase 14): structured metadata, disclosed on tap so it
  // never eats a small screen. Only art carries `card.facts`.
  const [showDetails, setShowDetails] = useState(false);
  // Deep-zoom lightbox (M-G2): only art with a hi-res `zoomUrl` is zoomable.
  const [zoomOpen, setZoomOpen] = useState(false);
  const canZoom = card.source === "artic" && !!card.zoomUrl;
  const onZoom = canZoom ? () => setZoomOpen(true) : undefined;
  // The licence this card's text is under, named and linked beside the source
  // link below (see lib/licenses.ts for the two separate obligations).
  const license = licenseFor(card.source);
  // Does the expanded body finish with a table? (Drives the fade below.)
  const endsOnTable = longBlocks?.[longBlocks.length - 1]?.kind === "table";
  // The Details rows: art and papers carry their own; a Wikipedia card gains its
  // infobox once the reader expands it, which is when we fetch the page's HTML.
  const facts = card.facts ?? longFacts ?? undefined;

  // Phones inline the threads at the end of the reading flow (see
  // ThreadsSection), which buys back a lot of reading height but puts the
  // directions below the fold. So while they are off screen we float a small,
  // honest count above the fold: you always know the threads are there and how
  // many, and one tap takes you to them. It costs ~30px instead of ~200px, and
  // it disappears the moment they are actually in view (no permanent nag, §2.4).
  const inlineThreadsRef = useRef<HTMLDivElement | null>(null);
  const [threadsInView, setThreadsInView] = useState(false);
  useEffect(() => {
    const el = inlineThreadsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setThreadsInView(entry.isIntersecting),
      // A sliver counts as "you can see them", so the hint clears early rather
      // than hovering over the chips it points at.
      { root: el.closest("[data-drift-scroll]"), threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [card.pageTitle]);
  // No hint in flow mode: the chips are in the page's own scroll, so they are
  // reachable the same way everything else on the page is.
  const showThreadHint =
    !flow && !threadsInView && !threadsLoading && threads.length > 0;

  function scrollToThreads() {
    inlineThreadsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }

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
          const data = (await res.json()) as Partial<ExtendedBody>;
          if (data?.extract) {
            setLongText(data.extract);
            setHasMore(!!data.hasMore);
            // Both optional: a realm without them (or a page whose HTML did not
            // parse) simply renders the paragraphs, exactly as before.
            if (data.blocks?.length) setLongBlocks(data.blocks);
            if (data.facts?.length) setLongFacts(data.facts);
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
    <div
      className={`flex w-full flex-col overflow-hidden rounded-2xl bg-paper-raised shadow-[0_10px_40px_-12px_rgba(43,39,35,0.25)] ring-1 ring-line md:flex-row ${
        flow ? "" : "h-full"
      }`}
    >
      {/* Desktop: a fixed image panel on the left. Hidden on phones, where the
          image instead lives inside the scroll flow below (so it scrolls away
          and the text gets the full height).

          `md:h-full` only works against a parent with a definite height, which
          in flow mode there is not. `md:self-stretch` gets the same result from
          the flex row itself, and the panel ends up as tall as the text beside
          it. */}
      <div
        className={`relative hidden shrink-0 md:block md:w-1/2 lg:w-[55%] ${
          flow ? "md:self-stretch md:min-h-[26rem]" : "md:h-full"
        }`}
      >
        <ImagePanel card={card} onZoom={onZoom} />
      </div>

      {/* Reading side: one scroll region + a pinned threads bar. The whole
          reading side scrolls (image included on phones), and the feed's gesture
          handler reads this region's edges (via [data-drift-scroll]) to tell
          "scroll to read" from "overscroll to drift on" — see lib/gesture. */}
      {/* `min-w-0` matters as much as `min-h-0` here, and for the mirror-image
          reason. A flex item defaults to `min-width: auto`, i.e. "never narrower
          than my content", so ONE wide child sizes this whole column: with a wide
          table in the body, the reading side grew from 554px to 976px and pushed
          the prose off the screen (the table was fine — it was the article that
          got too wide). Zero lets the column keep the width the card gives it, and
          the table scrolls inside its own box instead. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* `touch-pan-y`: this region pans VERTICALLY only. Without it the
            browser treats a sideways drag over scrollable prose as a possible
            vertical scroll, claims the gesture, and fires `touchcancel` — so the
            cross-realm swipe silently vanished and the gesture felt like it "got
            stuck in the text". Reading scroll stays native and fast; horizontal
            drags are left to the feed's own handler, which is the only thing
            that wants them (there is nothing to scroll sideways). Most visible
            during the guided tour, where the coach card pushes your thumb into
            the middle of the prose. drift/page.tsx also handles `touchcancel`,
            as a fallback for a genuinely diagonal drag. */}
        <div
          // Only the feed's card owns a scroll region. In flow mode the marker
          // is absent too, deliberately: `lib/gesture` and the tour both look it
          // up to find "the thing that scrolls", and pointing them at a div that
          // does not scroll would be worse than finding nothing.
          {...(flow ? {} : { "data-drift-scroll": true })}
          className={`flex min-w-0 flex-col gap-3 px-6 pb-4 pt-6 sm:px-8 sm:pt-8 md:px-10 md:pt-10 lg:px-12 lg:pt-12 ${
            flow
              ? ""
              : "min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain"
          }`}
        >
          {/* Phone-only hero, full-bleed to the card's rounded top; it scrolls
              up out of the way as you read. A third of the viewport is right in
              the feed, where the card IS the screen. On a page it would be a
              third of the screen spent before the title, every card, so flow
              mode uses a fixed, smaller band. */}
          <div
            className={`relative -mx-6 -mt-6 shrink-0 overflow-hidden sm:-mx-8 sm:-mt-8 md:hidden ${
              flow ? "h-52" : "h-[34dvh]"
            }`}
          >
            <ImagePanel card={card} onZoom={onZoom} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-paper-raised/70 to-transparent" />
          </div>

          {/* The chip may be long ("Crossed to Gallery · …") and the icons are
              fixed-width, so the chip is the side that gives: `min-w-0` (on the
              chip itself) lets it shrink past its longest word, which it then
              breaks. Without that, a 320px phone with scaled-up text pushed the
              icon row past the card's edge. */}
          <div className="flex items-center justify-between gap-3">
            <ModeChip via={arrivedVia} realmLabel={getRealm(realm).label} />
            <div className="flex shrink-0 items-center gap-1.5">
              {onReact && (
                <ReactionButtons reaction={reaction} onReact={onReact} />
              )}
              {onOrbit && <OrbitButton onOrbit={onOrbit} active={orbiting} />}
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
          {/* `min-w-0` again, for the same reason as the column above: the body
              holds the one element that can be wider than the card. */}
          <div className="relative flex min-w-0 flex-col gap-3">
            {/* Three cases, in order of richness: the expanded body WITH its
                tables (Phase 26), the expanded body as plain paragraphs (every
                other realm, and any page whose HTML did not parse), or the
                collapsed card's hook. The paragraph markup is identical in all
                three, so an article with no tables reads exactly as it did. */}
            {open && longBlocks
              ? longBlocks.map((block, i) =>
                  block.kind === "table" ? (
                    <CardTable
                      key={i}
                      data={block.table}
                      sourceUrl={card.sourceUrl}
                    />
                  ) : (
                    <p
                      key={i}
                      className="text-base leading-relaxed text-ink/85 sm:text-lg"
                    >
                      <MathText text={block.text} />
                    </p>
                  ),
                )
              : (open && longText
                  ? longText.split("\n\n")
                  : [card.extract]
                ).map((para, i) => (
                  <p
                    key={i}
                    className="text-base leading-relaxed text-ink/85 sm:text-lg"
                  >
                    <MathText text={para} />
                  </p>
                ))}
            {/* Soft fade at the truncation point — a quiet "there's more at the
                source" cue, not a tease to keep scrolling in-app. Suppressed when
                the body ends on a table: a gradient washing over a table's last
                row reads as a rendering fault, not as a cue. */}
            {open && hasMore && !loadingMore && !endsOnTable && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-paper-raised to-transparent" />
            )}
          </div>
          {open && loadingMore && (
            <p className="text-sm italic text-ink-soft">Fetching the rest…</p>
          )}
          {/* Wikipedia articles are not uniformly CC BY-SA with attribution
              satisfied by the history page: some incorporate text from external
              sources that attach their own attribution requirements, and
              Wikipedia flags those in the page footer or on the talk page. Drift's
              parser takes paragraphs, tables and the infobox, and never the
              footer, so for exactly that subset it reproduced the article and
              dropped the notice saying who else must be credited (audit M-3).
              CC BY-SA 4.0 §3(a)(2) accepts a link to a resource carrying the
              required information, and the article link is right here. */}
          {open && (card.source ?? "wikipedia") === "wikipedia" && (
            <p className="text-xs leading-relaxed text-ink-soft">
              This article may incorporate text from other sources with their own
              attribution requirements.{" "}
              <a
                href={card.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-ink/30 underline-offset-2 transition hover:text-accent-strong"
              >
                See the article on Wikipedia
              </a>{" "}
              for its full licensing footer.
            </p>
          )}
          {/* The museum label — a calm, tap-to-open "Details" block (art only).
              Inline scroll content, so it never overlays or eats the viewport on
              a phone; the two-column list wraps long values instead of overflowing. */}
          {facts && facts.length > 0 && (
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
                  {facts.map((f) => (
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
            {/* The licence notice for the card's TEXT, on the card itself. The
                link above is the ATTRIBUTION (the article's history page lists
                its authors, which the Terms of Use accept); this is the separate
                obligation to state the licence AND link its text. It belongs
                where the content is read, not only in the public footer.

                The trailing "excerpted and reformatted" is a THIRD and equally
                mandatory limb: CC BY-SA 4.0 §3(a)(1)(B) requires modification to
                be indicated, and it is satisfied by neither of the other two
                (compliance audit M-2). Drift truncates every article to a few
                sentences and re-lays out the rest.

                This notice covers the text only. The image beside it is a
                separate work with its own creator and licence, credited under the
                image itself. See lib/licenses.ts and lib/imagecredit.ts. */}
            {license && (
              <span className="text-xs text-ink-soft">
                <a
                  href={license.url}
                  target="_blank"
                  rel="license noopener noreferrer"
                  className="font-medium underline decoration-ink/30 underline-offset-4 transition hover:text-accent-strong hover:decoration-accent"
                >
                  {license.label} ↗
                </a>{" "}
                · {open ? MODIFICATION_FULL : MODIFICATION_CARD}
              </span>
            )}
          </div>
          {/* Phone only: the threads sit here, at the end of the read, so the
              text above them gets the card's full height. Desktop renders the
              pinned copy below instead. */}
          {/* Phone only: the threads sit here, at the end of the read, so the
              text above them gets the card's full height. Desktop renders the
              pinned copy below instead. In flow mode this is the ONLY copy, at
              every width, since there is nothing to pin a bar against. */}
          <ThreadsSection
            threads={threads}
            threadsLoading={threadsLoading}
            onThread={onThread}
            variant={flow ? "flow" : "inline"}
            innerRef={inlineThreadsRef}
            revisiting={revisiting}
            ways={ways}
            onWay={onWay}
          />

          {/* A quiet, static wayfinding cue for the overscroll-to-advance
              gesture — not a tease (no autoplay/countdown); the bottom-nav
              Advance button stays the explicit control (§2.2). It comes after
              the threads so the order reads: read it, go deeper, or drift on.

              Absent in flow mode: there is no feed to drift onward INTO, so it
              would be an instruction that does nothing. */}
          {!flow && (
            <p className="pt-1 text-center text-xs text-ink-soft">
              ⌄ keep scrolling to drift onward
            </p>
          )}

          {/* The floating "there are threads below" cue. Last in the flow and
              sticky, so it hovers just above the fold while the chips are out of
              sight and settles away once they are reached. Phone only.
              `-mt-12` cancels its own `h-12` so it contributes NO scroll height:
              the feed's overscroll-to-advance reads this container's
              scrollHeight, and a floating hint must not move where the bottom
              edge is. It stays inside the scroll region (rather than overlaying
              from outside) so a swipe that starts on it is still read as
              "scrolling to read" — see lib/gesture `insideRegion`. */}
          <div
            className={`pointer-events-none sticky bottom-0 z-10 -mx-6 -mt-14 flex h-14 items-end justify-center bg-gradient-to-t from-paper-raised from-55% via-paper-raised/85 to-transparent px-6 pb-1 transition-opacity duration-300 sm:-mx-8 sm:px-8 md:hidden ${
              showThreadHint ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              type="button"
              onClick={scrollToThreads}
              tabIndex={showThreadHint ? 0 : -1}
              aria-hidden={!showThreadHint}
              className={`inline-flex items-center gap-1.5 rounded-full bg-paper-raised/92 px-3 py-1 text-xs font-medium text-accent-strong shadow-sm ring-1 ring-accent/25 backdrop-blur-sm ${
                showThreadHint ? "pointer-events-auto" : "pointer-events-none"
              }`}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              {threads.length} {threads.length === 1 ? "thread" : "threads"}{" "}
              below
            </button>
          </div>
        </div>

        {/* Desktop: threads pinned below the scroll region — always reachable,
            and there is height enough that they cost the reading nothing.
            Flow mode has no scroll region to pin against, and its single copy
            above already renders at every width. */}
        {!flow && (
          <ThreadsSection
            threads={threads}
            threadsLoading={threadsLoading}
            onThread={onThread}
            variant="pinned"
            revisiting={revisiting}
            ways={ways}
            onWay={onWay}
          />
        )}
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
