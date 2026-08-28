"use client";

// ---------------------------------------------------------------------------
// The card-at-a-time feed: one card on screen, advanced by a deliberate swipe,
// wheel tick or key press, with a spring transition between stops.
//
// It is a SHELL. Everything about what the reader sees — the trail, the focus,
// the buffers, the threads, the meter, every move — lives in `useDriftSession`,
// which a second shell (the continuous scroller, behind
// NEXT_PUBLIC_FEED_CONTINUOUS) will consume identically. What is left here is
// only how a card gets on screen: the gestures, the keyboard, the transition,
// and the markup.
// ---------------------------------------------------------------------------

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import type { Card } from "@/lib/types";
import { parentOf } from "@/lib/branch";
import { cardId } from "@/lib/card";
import {
  edgesOf,
  resolveSwipe,
  resolveHorizontalSwipe,
  isWheelReadingScroll,
} from "@/lib/gesture";
import { focusName } from "@/lib/focus";
import { CardView } from "@/components/CardView";
import { FeedTopBar, FeedBottomNav } from "@/components/FeedChrome";
import { FocusBanner } from "@/components/FocusBanner";
import { useAuth } from "@/components/AuthProvider";
import { ShareSheet } from "@/components/ShareSheet";
import { cardToSharePayload } from "@/lib/social/share";
import { AdCard } from "@/components/AdCard";
import { shouldWarn, stopsRemaining } from "@/lib/limits";
import { DayDone } from "@/components/DayDone";
import { EndOverlay } from "./EndOverlay";
import { useDriftSession, ADS, FREE_DAILY_STOPS, type Dir } from "./useDriftSession";

const cardVariants: Variants = {
  enter: (d: Dir) =>
    d === "thread"
      ? { x: 140, y: -20, opacity: 0, rotate: 1.5 }
      : d === "cross"
        ? { x: 300, opacity: 0 } // a clean sideways slide — crossing realms
        : d === "back"
          ? { y: -70, opacity: 0 }
          : { y: 70, opacity: 0 },
  center: { x: 0, y: 0, opacity: 1, rotate: 0 },
  exit: (d: Dir) =>
    d === "thread"
      ? { x: -160, y: -30, opacity: 0, rotate: -1.5 }
      : d === "cross"
        ? { x: -300, opacity: 0 }
        : d === "back"
          ? { y: 70, opacity: 0 }
          : { y: -70, opacity: 0 },
};

// A neutral cross-fade for readers who ask for reduced motion. `prefers-
// reduced-motion` is a real setting real people use, and motion/react does NOT
// honour it by default — measured, a Playwright context with `reducedMotion:
// "reduce"` still ran the full spring below. Same posture as
// components/landing/Reveal.tsx and components/tour/TourOverlay.tsx.
const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

// ⚠️ THIS NUMBER IS THE LARGEST PER-CARD DELAY THAT HAS NOTHING TO DO WITH THE
// NETWORK, so it is measured rather than chosen by feel. The original spring
// (stiffness 260, damping 30) took a median of **530 ms** from keypress to the
// next card's title being on screen — identical in both realms and unchanged by
// a warm buffer, because it is animation, not loading. This one settles in
// roughly half that and still reads as a spring rather than a cut. If you retune
// it, re-measure; do not guess.
const spring = { type: "spring", stiffness: 380, damping: 34 } as const;
const fadeTransition = { duration: 0.12 } as const;

// After this many stops, offer a gentle, dismissible nudge toward the trail map
// (spec §2.4 "gentle awareness, not guilt"). Never blocks, never guilts.
const NUDGE_AT = 25;

// The card's inner scroll region under a wheel/touch event target, or null if the
// gesture began outside it (the threads bar, the desktop image panel, gaps). The
// element carries [data-drift-scroll] (see CardView). Used to tell "scroll to
// read" from "overscroll to drift on".
function scrollRegionFrom(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? (target.closest("[data-drift-scroll]") as HTMLElement | null)
    : null;
}

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
      <DriftFeed />
    </Suspense>
  );
}

function DriftFeed() {
  const {
    history, pos, tip, path, pathPos, branchAt, ways, current, endless,
    threads, threadsLoading, reactions,
    realm, realmMeta, otherRealmMeta, crossEnabled,
    banner, bannerRealm, revealed, bannerSuffix, orbitingThisCard,
    initialLoading, error, advancing, hint, following, meter, dayDone, showAd, dir,
    ended, setEnded, endReason, endExisting, endSession, onTrailSaved,
    isBusy, advance, goBack, jumpTo, onWay, onThread, crossRealm, openDoor,
    markExpanded, handleReact, toggleOrbitHere, releaseFocus,
  } = useDriftSession();

  // Shell-only state: an overlay, a dismissible nudge, and the reader's motion
  // preference. None of it is part of the session.
  const { user, cloudConfigured } = useAuth();
  const [shareCard, setShareCard] = useState<Card | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  // motion/react does not honour prefers-reduced-motion on its own, so the card
  // transition asks explicitly. A reader who has asked for less motion gets a
  // short cross-fade instead of a slide.
  const reduceMotion = useReducedMotion();

  // Gesture bookkeeping. This is the part a continuous scroller replaces
  // wholesale with native scrolling, which is why it never moved into the hook.
  const wheelAccumRef = useRef(0);
  const wheelTsRef = useRef(0);
  const fireTsRef = useRef(0);
  // The vertical start of a touch + the card scroll region's edge state at that
  // moment (measured at start so iOS momentum after touchend can't cause a false
  // advance). Read by onTouchEnd via resolveSwipe.
  // The last touchmove position, so a browser-cancelled gesture can still be
  // read (see onTouchCancel).
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartRef = useRef<{
    x: number;
    y: number;
    insideRegion: boolean;
    atTop: boolean;
    atBottom: boolean;
  }>({ x: 0, y: 0, insideRegion: false, atTop: true, atBottom: true });

  // Keep latest handlers reachable from the stable keydown listener.
  const advanceRef = useRef(advance);
  const backRef = useRef(goBack);
  const keyExtrasRef = useRef<{ pull: (i: number) => void; escape: () => void }>(
    { pull: () => {}, escape: () => {} },
  );
  // The tour's "cross into the other realm" step used to have to release the
  // reader's focus as it opened, because crossing was disabled whenever one was
  // set — the step just before it invites them to start an orbit, so the tour
  // would otherwise spotlight a control that wasn't rendered. Crossing now works
  // under a focus (it goes dormant in the other realm and resumes when you come
  // back), so the step needs nothing: the orbit the reader just started survives
  // the crossing, which is a better demonstration than confiscating it.

  useEffect(() => {
    advanceRef.current = advance;
    backRef.current = goBack;
    keyExtrasRef.current = {
      pull: (i) => {
        if (!ended && threads[i]) onThread(threads[i]);
      },
      escape: () => {
        if (ended) setEnded(false);
        else setNudgeDismissed(true);
      },
    };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Never hijack keys while typing (e.g. the rename field).
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        advanceRef.current();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        backRef.current();
      } else if (!typing && (e.key === "1" || e.key === "2" || e.key === "3")) {
        keyExtrasRef.current.pull(Number(e.key) - 1);
      } else if (e.key === "Escape") {
        keyExtrasRef.current.escape();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Accumulate wheel delta so a normal scroll reliably triggers exactly one move
  // (fixes "scrolling sometimes does nothing"), with a small gap between fires.
  // But first let the card text scroll natively while there's room to read — only
  // at the region's edge (or when the wheel is outside it) does a wheel tick count
  // toward advancing/back (overscroll-to-advance).
  function onWheel(e: React.WheelEvent) {
    const now = Date.now();
    if (now - wheelTsRef.current > 200) wheelAccumRef.current = 0;
    wheelTsRef.current = now;

    const region = scrollRegionFrom(e.target);
    if (region) {
      const { scrollable, atTop, atBottom } = edgesOf(region);
      if (
        isWheelReadingScroll({
          deltaY: e.deltaY,
          insideRegion: true,
          scrollable,
          atTop,
          atBottom,
        })
      ) {
        wheelAccumRef.current = 0; // reading — don't let it bleed into an advance
        return;
      }
    }

    wheelAccumRef.current += e.deltaY;
    if (isBusy() || now - fireTsRef.current < 280) return;
    if (wheelAccumRef.current > 55) {
      wheelAccumRef.current = 0;
      fireTsRef.current = now;
      advance();
    } else if (wheelAccumRef.current < -55) {
      wheelAccumRef.current = 0;
      fireTsRef.current = now;
      goBack();
    }
  }
  // Record the touch's start Y + the scroll region's edge state, so touchEnd can
  // tell a reading scroll from an overscroll-to-advance (see lib/gesture).
  function onTouchStart(e: React.TouchEvent) {
    const region = scrollRegionFrom(e.target);
    const edges = region
      ? edgesOf(region)
      : { scrollable: false, atTop: true, atBottom: true };
    touchStartRef.current = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      insideRegion: !!region,
      atTop: edges.atTop,
      atBottom: edges.atBottom,
    };
    lastTouchRef.current = null;
  }
  // Remember where the finger actually got to. A gesture the BROWSER decides to
  // take over (to scroll the text) ends in `touchcancel`, which carries no useful
  // coordinates, so without this a cancelled swipe would be unreadable.
  function onTouchMove(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    lastTouchRef.current = { x: t.clientX, y: t.clientY };
  }

  function resolveTouch(x: number, y: number, cancelled: boolean) {
    const start = touchStartRef.current;
    const deltaX = x - start.x;
    const deltaY = start.y - y;
    // Axis-lock: a clearly-horizontal swipe crosses realms (only where crossing
    // applies and no focus is set); otherwise it's the vertical read/advance
    // gesture. Never both.
    if (crossEnabled && resolveHorizontalSwipe({ deltaX, deltaY }) === "cross") {
      crossRealm();
      return;
    }
    // A cancelled gesture was the browser scrolling the text, so it is a read,
    // never an advance. Only the horizontal decision above survives a cancel.
    if (cancelled) return;
    const action = resolveSwipe({
      deltaY,
      insideRegion: start.insideRegion,
      atTopStart: start.atTop,
      atBottomStart: start.atBottom,
    });
    if (action === "advance") advance();
    else if (action === "back") goBack();
  }

  function onTouchEnd(e: React.TouchEvent) {
    resolveTouch(e.changedTouches[0].clientX, e.changedTouches[0].clientY, false);
  }

  /**
   * The browser cancelled the gesture, which it does the moment it claims the
   * drag for native scrolling. `touch-action: pan-y` on the reading region makes
   * that rare (the browser no longer claims horizontal drags at all), but it can
   * still happen on a diagonal one, and when it did the cross-realm swipe simply
   * vanished: the app only listened for `touchend`, so the swipe felt like it
   * "got stuck in the text". This is most visible during the guided tour, where
   * the coach card pushes your thumb down into the middle of the prose.
   */
  function onTouchCancel() {
    const last = lastTouchRef.current;
    if (last) resolveTouch(last.x, last.y, true);
  }

  // Opened the feed with the day already spent: there is no session behind this,
  // so there is no trail map to end into and nothing to save. A calm exit page
  // instead, before any of the feed chrome mounts (Phase 32).
  if (dayDone) {
    return (
      <div className="h-dvh overflow-y-auto bg-paper" data-realm={realm}>
        <DayDone stops={meter?.stops ?? 0} />
      </div>
    );
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-paper"
      data-realm={realm}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <FeedTopBar
        // The rail draws the branch you are ON, not the storage order; `stops`
        // stays the whole trail, because that is what you have read.
        steps={path.map((i) => history[i])}
        pos={pathPos}
        branchAt={branchAt}
        stops={history.length}
        // Only when the day is nearly done; undefined the rest of the time.
        stopsLeft={
          meter && shouldWarn(meter, FREE_DAILY_STOPS)
            ? (stopsRemaining(meter, FREE_DAILY_STOPS) ?? undefined)
            : undefined
        }
        realm={{ label: realmMeta.label, glyph: realmMeta.glyph }}
        otherRealm={
          crossEnabled
            ? {
                id: otherRealmMeta.id,
                label: otherRealmMeta.label,
                glyph: otherRealmMeta.glyph,
              }
            : undefined
        }
        onCrossRealm={crossEnabled ? crossRealm : undefined}
        endless={endless}
        onJump={jumpTo}
        onEnd={() => endSession()}
      />

      {banner && current && (
        <FocusBanner
          focus={banner.focus}
          proximity={bannerSuffix}
          // Letting go says where it lands you, because with nesting that is no
          // longer always "drift freely" (§2.1).
          releaseLabel={
            revealed ? `Back to ${focusName(revealed)}` : "Drift freely"
          }
          onRelease={() => releaseFocus(bannerRealm)}
        />
      )}

      <main className="relative min-h-0 flex-1">
        {initialLoading && (
          <div className="flex h-full items-center justify-center">
            <p className="animate-pulse font-serif text-xl text-ink-soft">
              Finding a starting point…
            </p>
          </div>
        )}

        {error && !initialLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-sm text-ink-soft">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
            >
              Try again
            </button>
          </div>
        )}

        {current && !error && (
          <AnimatePresence custom={dir} initial={false}>
            <motion.div
              key={showAd ? "__ad__" : current.card.pageTitle}
              custom={dir}
              variants={reduceMotion ? fadeVariants : cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduceMotion ? fadeTransition : spring}
              className="absolute inset-0 px-4 pb-safe sm:px-6"
            >
              {showAd ? (
                <AdCard config={ADS} />
              ) : (
                <CardView
                  card={current.card}
                  realm={realm}
                  arrivedVia={current.arrivedVia}
                  threads={threads}
                  threadsLoading={threadsLoading}
                  onThread={onThread}
                  onExpand={() => markExpanded(pos)}
                  reaction={reactions[cardId(current.card)]}
                  onReact={
                    realmMeta.hasInterestModel
                      ? (sig) => handleReact(current.card, sig)
                      : undefined
                  }
                  // Sharing a card no longer depends on NEXT_PUBLIC_SOCIAL.
                  // That flag hides the FRIEND GRAPH, and gating the whole
                  // control behind it meant that with the flag off (which is how
                  // Drift runs) there was no way to share a card at all: the only
                  // route out of the app was to finish a trail first.
                  onShare={
                    cloudConfigured && user
                      ? () => setShareCard(current.card)
                      : undefined
                  }
                  onOrbit={
                    realm === "encyclopedia"
                      ? () => toggleOrbitHere(current.card)
                      : undefined
                  }
                  orbiting={orbitingThisCard}
                  // Standing on a stop already left: the chips branch rather
                  // than continue, and the fork has a switch (Phase 30). Same
                  // test the bottom nav uses for its "Return" label.
                  revisiting={pos !== tip}
                  ways={ways}
                  onWay={onWay}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {following && (
          <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center px-4">
            <span className="rounded-full bg-ink/85 px-4 py-2 text-center text-sm font-medium text-paper shadow-lg">
              {following.branch ? "New branch" : "Following"}: {following.label}…
            </span>
          </div>
        )}

        {hint && (
          <div className="pointer-events-none absolute inset-x-0 bottom-safe z-10 flex justify-center px-4">
            <span className="rounded-full bg-paper-raised px-4 py-2 text-center text-sm font-medium text-ink-soft shadow-lg ring-1 ring-line">
              {hint}
            </span>
          </div>
        )}

        {shareCard && (
          <ShareSheet
            kind="card"
            payload={cardToSharePayload(shareCard)}
            label={shareCard.displayTitle}
            onClose={() => setShareCard(null)}
          />
        )}

        {current &&
          !ended &&
          !nudgeDismissed &&
          history.length >= NUDGE_AT && (
            <div className="absolute inset-x-0 bottom-safe z-10 flex justify-center px-4">
              <div className="flex items-center gap-3 rounded-2xl bg-paper-raised px-4 py-3 shadow-lg ring-1 ring-line">
                <p className="text-sm text-ink-soft">
                  {endless
                    ? "You've wandered far. A nice place to pause?"
                    : "You've wandered far. Want to see your trail?"}
                </p>
                {endless ? (
                  <Link
                    href="/"
                    className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
                  >
                    Head home
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => endSession()}
                    className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
                  >
                    View trail
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNudgeDismissed(true)}
                  aria-label="Dismiss"
                  className="text-ink-soft transition hover:text-ink"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

      </main>

      {current && !error && (
        <FeedBottomNav
          canGoBack={parentOf(history, pos) !== null}
          viewingBack={pos !== tip}
          busy={advancing}
          onBack={goBack}
          onAdvance={advance}
        />
      )}

      <AnimatePresence>
        {ended && (
          <EndOverlay
            history={history}
            realm={realm}
            existing={endExisting}
            onSaved={onTrailSaved}
            onOpenDoor={openDoor}
            onClose={() => setEnded(false)}
            reason={endReason}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
