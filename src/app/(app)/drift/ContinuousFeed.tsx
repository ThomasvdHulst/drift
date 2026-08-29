"use client";

// ---------------------------------------------------------------------------
// The continuous feed: a scroll-snap scroller, 1:1 with your finger.
//
// The SHELL over `useDriftSession`. The engine decides WHAT the reader sees;
// this decides only HOW it appears. It was one of two shells behind a flag
// while it was being built; it is the only one now.
//
// WHAT IS ON SCREEN, top to bottom:
//
//     pathTo(tip)   the committed trail, scroll up to revisit
//     ─────────     the commit boundary
//     queue         materialised, NOT in the trail, discardable without trace
//     (the scroller ENDS here)
//
// Everything below the boundary "has not happened": it is not in the trail, not
// in `seen`, not counted by the meter. That is what makes pulling a thread,
// crossing realms and changing focus easy — they throw the queue away and there
// is nothing to undo. See lib/feedqueue.ts and docs/continuous-feed.md §5.
//
// THREE PROPERTIES HOLD THE WHOLE THING UP, and breaking any of them breaks it
// in a way that looks like a mystery rather than a bug:
//
//   1. EVERY ITEM IS EXACTLY ONE SCROLLER-HEIGHT. That is what makes changing
//      anything below the reader scroll-safe, and what makes the skipped-card
//      compensation in `commit` exact.
//   2. THE PATH PREFIX IS STABLE. `pathTo(tipOf(history, c))` for a child of `p`
//      shares its whole prefix with the old path up to `p` (lib/branch.ts), so a
//      fork rewrites only what is below the reader and `scrollTop` stays valid.
//   3. THREADS ARE FETCHED FOR THE ACTIVE CARD AND AT MOST ONE AHEAD. Never for
//      every rendered card — that is ~45 Met requests a screenful against a
//      bucket of ~80 per 30 seconds (CLAUDE.md §4).
// ---------------------------------------------------------------------------

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { Card, Thread, TrailStep } from "@/lib/types";
import { cardId } from "@/lib/card";
import { candidateToCard } from "@/lib/wiki";
import { focusName } from "@/lib/focus";
import {
  NO_PULL,
  WHEEL_QUIET_MS,
  WHEEL_THRESHOLD,
  edgePull,
  edgesOf,
  resolveHorizontalSwipe,
  type PullState,
} from "@/lib/gesture";
import {
  COMMIT_RATIO,
  COMMIT_SETTLE_MS,
  clearTerminus,
  commitAt,
  commitDecision,
  insertAfterLike,
  invalidateQueue,
  isQueued,
  pendingIds,
  queueCapacity,
  queuedCount,
  queuedItem,
  appendTerminus,
  hasTerminus,
  terminusReason,
  trimToCapacity,
  type FeedItem,
  type QueuedItem,
  type TerminusReason,
} from "@/lib/feedqueue";
import { shouldWarn, stopsRemaining } from "@/lib/limits";
import { shouldShowAd } from "@/lib/ads";
import { CardView } from "@/components/CardView";
import { AdCard } from "@/components/AdCard";
import { TerminusCard } from "@/components/TerminusCard";
import { FeedTopBar } from "@/components/FeedChrome";
import { FocusBanner } from "@/components/FocusBanner";
import { useAuth } from "@/components/AuthProvider";
import { ShareSheet } from "@/components/ShareSheet";
import { cardToSharePayload } from "@/lib/social/share";
import { DayDone } from "@/components/DayDone";
import { EndOverlay } from "./EndOverlay";
import { useDriftSession, ADS, FREE_DAILY_STOPS } from "./useDriftSession";

// After this many stops, offer a gentle, dismissible nudge toward the trail map
// (spec §2.4 "gentle awareness, not guilt"). Never blocks, never guilts.
const NUDGE_AT = 25;

// The band of paper between one card and the next.
//
// A deliberate design decision, not spacing. 1:1 scrolling means the next card
// is partly visible while your thumb moves — that peek is unavoidable — and this
// is what decides whether it reads as turning a page or as one continuous
// surface. With a gap you see the seam and the next card's top edge; edge to
// edge you would see a readable slice of it, which is the shape of the feeds
// Drift exists to be an antidote to. Kept as a constant because it is worth
// revisiting after reading on it, not because it is arbitrary.
const SEAM = "px-4 py-3 sm:px-6 sm:py-4";

// How long to leave a struggling source alone after a refill comes back empty.
//
// ⚠️ THIS EXISTS BECAUSE THE CONTINUOUS FEED RETRIES HARDER THAN THE OLD ONE DID,
// and it was found by measurement. The card-at-a-time feed asks for a card only
// when the reader asks for one, so a throttled source is asked once per swipe.
// This shell tops the queue up on its own, from an effect that re-runs on every
// state change — so an empty answer immediately produced another attempt, and
// another. Measured against a Met that was already refusing: discover calls per
// card went from 0.54 to 2.62. Retrying hardest exactly when a source is asking
// us to stop is precisely backwards (CLAUDE.md §4), and it is how a brief
// throttle becomes a shrunk daily budget.
const FILL_BACKOFF_MS = 4000;

// The longest the feed will ever wait before asking a quiet source again.
//
// The backoff DOUBLES on each consecutive failure and stops here. Two rules pull
// in opposite directions and this is where they meet: a source that is merely
// throttling must be asked again, or the reader is stranded on an ending that is
// not true (measured: the feed stayed on `terminus:pool-dry` fifteen seconds
// after the upstream recovered, because nothing retried); and a source that is
// refusing must not be retried into the ground, because that is how a brief
// throttle becomes a shrunk daily budget (CLAUDE.md §4).
const FILL_RETRY_MAX_MS = 60_000;

// How many refills in a row must come back empty before the feed will SAY it has
// ended.
//
// ⚠️ ONE IS NOT ENOUGH, AND NOT ONLY BECAUSE OF FAILING REQUESTS. Measured with
// `discover` answering `[]` while `related` stayed healthy: the feed announced
// the end of the road immediately, even though the degraded thread-neighbour
// fallback in `nextDriftCard` would have carried it on — the FIRST refill of a
// session runs before the seed card's chips have arrived, so the fallback had an
// empty list to choose from. "Empty right now" is not "empty", so the feed asks
// once more before it tells the reader anything. The cost is that a genuinely
// exhausted pool takes FILL_BACKOFF_MS to say so, standing on the last card it
// had, which is where the reader already is.
const TRIES_BEFORE_END = 2;

/** What one screen of the scroller holds: a committed stop, a card the reader
 *  has not arrived on yet, a calm ad interstitial, or the end of the road. */
type Slot =
  | { key: string; kind: "step"; index: number; step: TrailStep }
  | { key: string; kind: "queued"; item: QueuedItem }
  | { key: string; kind: "ad" }
  | { key: string; kind: "terminus"; reason: TerminusReason };

export function ContinuousFeed() {
  const s = useDriftSession();
  const { user, cloudConfigured } = useAuth();
  const reduceMotion = useReducedMotion();

  const scrollerRef = useRef<HTMLDivElement>(null);
  // ⚠️ `queueRef` IS THE QUEUE; `queue` is its mirror for rendering. Every
  // mutation writes the ref first and then the state, and nothing writes the
  // state alone. That ordering matters: `fill` runs across awaits and has to be
  // able to see a steer that happened while a card was in flight, which React
  // state cannot tell it (it would still be holding the value from its own
  // render).
  const [queue, setQueue] = useState<FeedItem[]>([]);
  const queueRef = useRef<FeedItem[]>([]);
  const setQueueBoth = useCallback((next: FeedItem[]) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  // The engine as of the last render.
  //
  // ⚠️ `fill` IS MEMOISED ON `capacity`, WHICH NEVER CHANGES FOR MOST READERS, SO
  // WITHOUT THIS IT KEEPS THE ENGINE OBJECT FROM THE RENDER IT WAS BUILT IN — for
  // the whole session. This comment used to say the functions on the engine "read
  // refs" and that pinning it was therefore harmless. Most of them do; one of
  // them does not, and it is the one that matters when a source is struggling.
  // `nextDriftCard`'s degraded fallback — a random untapped thread of the card on
  // screen, the path that keeps the feed alive while discover is throttled —
  // reads `threads` from the RENDER scope. Pinned to the first render of a
  // session, that list is empty, because the seed card's chips have not arrived
  // yet. Measured: with `discover` answering `[]` and `related` perfectly
  // healthy, the feed announced the end of the road and the fallback never fired
  // once. Reading the engine through a ref costs nothing and removes the whole
  // class of it.
  const sRef = useRef(s);
  useEffect(() => {
    sRef.current = s;
  });

  const [shareCard, setShareCard] = useState<Card | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // The slot the reader is looking at, by key. Updated the moment it becomes the
  // most visible one, with NO settle: the chrome must never lag the finger.
  // Committing is the other, slower signal — see `commit` below.
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // ----- what is on screen -----
  const slots: Slot[] = [
    ...s.path.map((index) => ({
      key: `step:${index}`,
      kind: "step" as const,
      index,
      step: s.history[index],
    })),
    ...queue.map((item): Slot => {
      if (isQueued(item)) {
        return { key: `queued:${item.id}`, kind: "queued", item };
      }
      if (item.kind === "terminus") {
        return { key: `terminus:${item.reason}`, kind: "terminus", reason: item.reason };
      }
      if (item.kind === "ad") {
        // Keyed on the ad's own id, NOT on its position: everything above it
        // leaves the queue as the reader commits, so a positional key changed
        // under them and remounted the ad. See the `ad` item in lib/feedqueue.
        return { key: `ad:${item.id}`, kind: "ad" };
      }
      // A committed step lives ABOVE the boundary and is never in the queue.
      // `FeedItem` allows it because the two halves share one union; this branch
      // exists so the mapping is total rather than because it can happen.
      return {
        key: `step:${item.index}`,
        kind: "step",
        index: item.index,
        step: s.history[item.index],
      };
    }),
  ];
  // ⚠️ WHEN THE ACTIVE SLOT DISAPPEARS, DO NOT FALL BACK TO SLOT 0. This was
  // `Math.max(0, findIndex(...))`, so a key that named a slot no longer on screen
  // read as the FIRST STOP OF THE TRAIL. Two consequences, one of them ugly: the
  // heavy-image window jumped to the top of the feed, and the effect that syncs
  // the engine's `pos` fired with that index and jumped `pos` to stop 0 — which
  // then blocked the refill too, since only the tip may fill. Reachable by
  // tapping "Try again" on an ending, which removes the very slot the reader is
  // standing on. The last slot is the honest guess for that one frame (a slot
  // only vanishes from under a reader who is at the bottom), and `pos` is left
  // alone entirely until the observer names a real slot again.
  const foundIndex = slots.findIndex((slot) => slot.key === activeKey);
  const activeIndex = foundIndex >= 0 ? foundIndex : Math.max(0, slots.length - 1);
  const active = slots[activeIndex] ?? slots[0];
  // Standing on a stop already left: the chips branch rather than continue. The
  // same question `pos !== tip` asks in the other shell, asked of the scroller.
  const revisiting = active?.kind === "step" && active.index !== s.tip;
  const activeCard =
    active?.kind === "step"
      ? active.step?.card
      : active?.kind === "queued"
        ? active.item.card
        : undefined;

  // ----- filling the queue -----
  const fillingRef = useRef(false);
  // ⚠️ A STEER IS IN FLIGHT, SO DO NOT FILL. Found by measurement: crossing
  // realms voids the queue, which immediately woke the refill — and the realm
  // only becomes the new one once the crossing LANDS, so the queue refilled
  // with Encyclopedia cards and then sat under a Gallery card. The queue must be
  // rebuilt after the promise changes, never during.
  const steeringRef = useRef(false);
  // The earliest the feed may ask again. See FILL_BACKOFF_MS / FILL_RETRY_MAX_MS.
  //
  // ⚠️ IT IS A REF *AND* A COUNTER, AND BOTH ARE NEEDED. The ref is read
  // synchronously inside `fill` to enforce the backoff. The counter exists
  // purely so that "the feed came up empty" is something React can RE-RENDER on
  // — with only the ref, the effect that places the ending card had nothing to
  // fire on and the ending simply never appeared.
  const fillNextAtRef = useRef(0);
  const [dryTick, setDryTick] = useState(0);
  // How many refills in a row have come back with nothing, and whether the last
  // one failed to REACH the source rather than finding it empty. Together they
  // decide both which ending is honest and whether to keep asking.
  const dryCountRef = useRef(0);
  const sourceQuietRef = useRef(false);
  // The retry that used to be missing entirely.
  //
  // ⚠️ NOTHING ELSE WAKES THE REFILL, AND THAT IS WHY THE FEED USED TO DIE. The
  // fill effect fires on the queue changing, on a steer and on the day's
  // capacity — none of which happens while the feed sits empty. So one failed
  // refill was the last one that would ever be attempted, and the reader was
  // stuck on an ending long after the source came back. This timer is the only
  // thing that re-opens the question.
  const retryTimerRef = useRef<number | undefined>(undefined);
  const [retryTick, setRetryTick] = useState(0);
  // Drift-scrolls since the last ad.
  //
  // ⚠️ COUNTED ON COMMIT, NOT ON MATERIALISE. "One ad every N drifts" is a
  // promise about what the READER did, and a queue materialises cards three
  // ahead of them — counting there would put the ad three cards away from where
  // the number says. Only passive drifts count toward one, never a deliberate
  // thread pull or realm cross; same rule as the other shell.
  const driftsRef = useRef(0);
  // Ads need an identity of their own, because their POSITION changes under them
  // every time something above commits. See the `ad` item in lib/feedqueue.
  const adSeqRef = useRef(0);
  // Bumped when a steer finishes, purely to give the refill effect a dependency
  // to fire on. See `steer` for why the refill cannot simply be called there.
  const [steerTick, setSteerTick] = useState(0);
  const capacity = queueCapacity({
    stopsRemaining: stopsRemaining(
      s.meter ?? { stops: 0, supporter: false },
      s.meter ? FREE_DAILY_STOPS : null,
    ),
  });

  const fill = useCallback(async () => {
    if (fillingRef.current || steeringRef.current) return;
    if (Date.now() < fillNextAtRef.current) return;
    fillingRef.current = true;
    let added = 0;
    // Did this fill stop because something ELSE happened, rather than because
    // the source had nothing? See the `finally` below for why the difference
    // has to be carried out of the loop.
    let interrupted = false;
    try {
      // One card at a time, re-reading the capacity each round: a thread pull or
      // a realm cross can land mid-fill, and a card chosen under the old promise
      // must never be appended under the new one.
      while (queuedCount(queueRef.current) < capacity) {
        const before = queueRef.current;
        // Re-read every round, not once above the loop: each round awaits, and
        // the chips that the degraded fallback needs may have arrived meanwhile.
        const engine = sRef.current;
        const next = await engine.nextDriftCard({ likedFollow: false, background: true });
        if (!next) break;
        // The queue was thrown away while this card was in flight, or a steer
        // began. Give the card back to the buffer rather than appending it under
        // a promise it was not chosen for.
        if (queueRef.current !== before || steeringRef.current) {
          engine.returnToBuffer([next]);
          interrupted = true;
          break;
        }
        // ⚠️ THE SAME CARD TWICE IS A REAL POSSIBILITY, AND IT IS WHAT
        // `pendingIds` IS FOR. The buffer and the pools all HAND OUT a card (it
        // leaves them), so they cannot repeat — but the degraded fallback in
        // `nextDriftCard` picks a random untapped thread of the card on screen,
        // from a fixed set of three or four, and two rounds of one fill can
        // name the same one. Two items with the same id collide on the React key
        // AND on the `data-slot` the observer commits by. Treated as "nothing
        // came back", because that is what it is: the only source still
        // answering has nothing new in it.
        if (pendingIds(queueRef.current).has(cardId(next.card))) {
          engine.returnToBuffer([next]);
          break;
        }
        // A real card means the feed is NOT at its end, whatever it said a
        // moment ago. Dropping the ending here is what keeps it the last thing
        // in the scroller (lib/feedqueue.clearTerminus).
        const next2: FeedItem[] = clearTerminus(queueRef.current);
        // A calm ad interstitial every N drift-scrolls (Phase 21), as its own
        // stop rather than in place of a card. OFF by default: with
        // NEXT_PUBLIC_ADS_ENABLED unset nothing here runs at all.
        if (ADS.enabled && !engine.tourActive && shouldShowAd(driftsRef.current, ADS.every)) {
          adSeqRef.current += 1;
          next2.push({ kind: "ad", id: `ad-${adSeqRef.current}` });
          driftsRef.current = 0;
        }
        next2.push(queuedItem(next.card, next.via));
        setQueueBoth(next2);
        added++;
      }
    } finally {
      fillingRef.current = false;
      if (added > 0) {
        // The source answered. Forget everything the last failure taught us.
        dryCountRef.current = 0;
        sourceQuietRef.current = false;
        fillNextAtRef.current = 0;
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = undefined;
      } else if (!interrupted && queuedCount(queueRef.current) < capacity) {
        // Nothing came back and the queue is short. WHICH kind of nothing
        // decides how long the feed keeps asking: a pool that answered and was
        // empty is dry, and once it has said so twice the feed believes it; a
        // source that did not answer at all may come back, so that one is asked
        // again for as long as the reader is here, backing off as it goes.
        //
        // ⚠️ `!interrupted` MATTERS BECAUSE THE LOOP HAS A THIRD WAY OUT AND IT
        // IS NOT THE SOURCE'S FAULT. A round that came back with a perfectly
        // good card, and dropped it because the queue changed underneath while
        // it was in flight, also lands here with `added === 0` — and the queue
        // changes underneath on every commit and every steer. Charging that to
        // the source cost the reader a four-second refill freeze and a step
        // toward the ending, for the crime of scrolling on while a discover call
        // was open. Nothing is lost by staying quiet: the very thing that
        // interrupted this fill (a new queue) is itself a dependency of the
        // effect that calls it, so the refill is already about to run again.
        // A duplicate card from the degraded fallback is NOT this case and still
        // counts, deliberately — the source answered, and had nothing new.
        dryCountRef.current += 1;
        sourceQuietRef.current = sRef.current.sourceQuiet();
        const wait = sourceQuietRef.current
          ? Math.min(
              FILL_BACKOFF_MS * 2 ** (dryCountRef.current - 1),
              FILL_RETRY_MAX_MS,
            )
          : FILL_BACKOFF_MS;
        fillNextAtRef.current = Date.now() + wait;
        if (sourceQuietRef.current || dryCountRef.current < TRIES_BEFORE_END) {
          window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = window.setTimeout(
            () => setRetryTick((n) => n + 1),
            wait,
          );
        }
        setDryTick((n) => n + 1);
      }
    }
    // The engine comes through `sRef`, never from this closure — see the ⚠️ on
    // `sRef`. Capacity is the only value this callback may hold directly, and it
    // IS listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  /** Ask again now: the reader tapped "Try again" on a quiet-source ending. */
  const retryNow = useCallback(() => {
    // NOT back to zero. The counter is the evidence, and a tap does not undo
    // what we already know: leave it one short of the threshold so a single
    // further failure puts the ending straight back rather than making the
    // reader wait out a second round to be told the same thing. Leaving it high
    // also keeps the backoff ladder where it was, so somebody tapping repeatedly
    // cannot reset a refusing source's cooldown to four seconds.
    dryCountRef.current = Math.max(0, TRIES_BEFORE_END - 1);
    sourceQuietRef.current = false;
    fillNextAtRef.current = 0;
    window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = undefined;
    // Take the ending away first. It is a claim about right now, the reader has
    // just disputed it, and leaving it up while we look would be answering a tap
    // with nothing at all.
    setQueueBoth(clearTerminus(queueRef.current));
    setRetryTick((n) => n + 1);
  }, [setQueueBoth]);

  // A timer outlives the component if nobody stops it.
  useEffect(() => () => window.clearTimeout(retryTimerRef.current), []);

  useEffect(() => {
    if (s.initialLoading || s.error || s.dayDone || s.ended) return;
    if (s.history.length === 0) return;
    // ⚠️ THE QUEUE HANGS UNDER THE TIP, SO ONLY THE TIP MAY FILL IT. The engine
    // derives the realm, the focus and the fallback threads from the stop the
    // reader is STANDING on, and a reader who has scrolled back up is standing
    // somewhere else — measured: cross to the Gallery, scroll up three, and the
    // session reads as Encyclopedia again while three Met cards sit queued under
    // a Gallery tip. Filling from there stacks the wrong realm under the reader
    // (invariant 3). Scrolling back down puts `pos` on the tip again and this
    // effect fires on it, so nothing is lost by waiting.
    if (s.pos !== s.tip) return;
    // Never refill while the reader is standing ON the ending. A card arriving
    // takes the ending's place in the scroll, and swapping the thing under
    // somebody's eye is the dishonesty §2.1 forbids. "Try again" is their way
    // out, and scrolling off it re-runs this effect anyway.
    if (active?.kind === "terminus") return;
    // The day can close from another device or another tab, so the allowance can
    // drop by more than the one stop this reader just took. Trimming from the END
    // runs the feed out under their thumb rather than in front of it, and it is
    // what keeps "the queue never exceeds what the day has left" a property
    // rather than a hope (invariant 7).
    if (queuedCount(queueRef.current) > capacity) {
      const { queue: kept, dropped } = trimToCapacity(queueRef.current, capacity);
      if (dropped.length > 0) s.returnToBuffer(dropped);
      setQueueBoth(kept);
      return;
    }
    void fill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fill,
    steerTick,
    retryTick,
    s.initialLoading,
    s.error,
    s.dayDone,
    s.ended,
    s.history.length,
    s.pos,
    s.tip,
    activeKey,
    capacity,
    queue.length,
  ]);

  // ----- the end of the road -----
  //
  // A pool that cannot be refilled used to fire a transient hint wherever the
  // reader happened to be standing, which is the wrong place to answer "why did
  // it stop?" — the question is asked at the BOTTOM of the feed. So the answer
  // is placed there, as a card the scroller ends on.
  const endedRef = useRef(false);
  useEffect(() => {
    if (s.initialLoading || s.error || s.ended) return;
    if (s.history.length === 0) return;
    // Only when the feed has genuinely run out: nothing queued, nothing coming,
    // and the refill has come back empty enough times to mean it.
    //
    // ⚠️ ONE EMPTY REFILL IS NOT AN ENDING — see TRIES_BEFORE_END. The
    // alternative is what this feed used to do: announce the end of the road
    // four seconds into a session, on a single 503 or on a discover call that
    // came back before the fallback threads did, and then stay there.
    //
    // A spent day is the exception, and it is not really a case of this at all:
    // the allowance is a fact we already hold, not an answer we are waiting for.
    const dry =
      queuedCount(queueRef.current) === 0 &&
      !fillingRef.current &&
      (capacity === 0 || dryCountRef.current >= TRIES_BEFORE_END);
    if (!dry || hasTerminus(queueRef.current)) return;
    setQueueBoth(
      appendTerminus(
        queueRef.current,
        terminusReason({
          focusKind: s.banner?.focus.kind ?? null,
          dayDone: capacity === 0,
          sourceQuiet: sourceQuietRef.current,
        }),
      ),
    );
    endedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, capacity, dryTick, steerTick, s.initialLoading, s.error, s.ended, s.history.length]);

  // ----- threads: the active card, and exactly one ahead -----
  //
  // ⚠️ THIS IS NOW THE ONLY THREADS LOOKAHEAD, AND IT WAS NOT BEFORE. The engine
  // carried a second one from Phase 0 ("prepare the NEXT card") that fetched for
  // the head of the DISCOVER BUFFER — which, once `fill` started taking cards out
  // of that buffer to materialise them, is QUEUE_AHEAD + 1 = four cards below the
  // reader, not one. So invariant 6 was false of the code that implemented it,
  // and the effect below was mostly a cache hit on work already done too early.
  // It was removed (useDriftSession.ts has the measurements); this is what keeps
  // the promise now, so do not add a second one back without changing the
  // invariant and the four documents that state it.
  useEffect(() => {
    if (activeCard) s.ensureThreads(activeCard);
    // "One ahead" is the first queued card the reader is NOT already on, which is
    // the next thing they can reach. Two things about that phrasing are load-
    // bearing:
    //
    //   • not the next slot in the list. When the reader is scrolled up in the
    //     trail, the cards below them are already committed and already have
    //     their chips, so the one worth preparing is still the head of the queue.
    //   • not simply the head. `activeKey` flips the moment a card is 75% on
    //     screen, but the card does not COMMIT for another COMMIT_SETTLE_MS, and
    //     until it does it is still the head of the queue — so `queue.find(isQueued)`
    //     returned the card the reader was standing on and the lookahead went
    //     quiet at exactly the moment it should have been starting. Skipping the
    //     active card makes it continuous instead of commit-triggered, and buys
    //     the settle window back. It costs nothing: the same cards are fetched,
    //     one per committed card, just started a little earlier.
    const ahead = queue.find(isQueued);
    if (ahead && ahead.card !== activeCard) s.ensureThreads(ahead.card);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCard, queue]);

  // ----- committing -----
  //
  // A queued card becomes a trail step when the reader has actually arrived on
  // it: >=COMMIT_RATIO visible, held for COMMIT_SETTLE_MS. The settle window is
  // what stops one fling recording six stops, because `scroll-snap-stop: always`
  // halts at every card (lib/feedqueue.ts).
  // Held in a ref, updated every render, and read by the observer.
  //
  // ⚠️ NOT a `useCallback`. It closes over the engine, which is a fresh object
  // every render, so any honest dependency list makes it unstable — and the
  // observer effect below depends on it, so an unstable one would tear down and
  // rebuild the IntersectionObserver on every render. Losing the observer
  // mid-scroll loses the settle timers with it, which is exactly how a card
  // would silently fail to commit.
  const commitRef = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    commitRef.current = (id: string) => {
      const { queue: rest, committed, skipped, removed } = commitAt(queueRef.current, id);
      if (!committed) return;
      // Cards a fling jumped over were never read. They go back in the pile
      // rather than into the trail, and the DOM they occupied is compensated
      // exactly — every item is one scroller-height, so this cannot drift.
      if (skipped.length > 0) s.returnToBuffer(skipped);
      // ⚠️ `removed`, NOT `skipped.length`. An ad passed over on the way leaves
      // the queue but is not a card to hand back, so it is in the first number
      // and not the second; compensating with the second left the reader one
      // card further down than they flicked to, on a card they never scrolled
      // onto, which then committed. See `commitAt` in lib/feedqueue.
      if (removed > 0) {
        const el = scrollerRef.current;
        if (el) el.scrollTop -= removed * el.clientHeight;
      }
      setQueueBoth(rest);
      driftsRef.current += 1;
      // The tip, not `pos`: the reader may have been scrolled up a moment ago,
      // and this card continues from the far end of the line, not from wherever
      // they last looked.
      s.commitCard(committed.card, committed.via, s.tip);
      // It is a step now, so its key changes shape with it. `history.length` is
      // the index it is about to take (pushStep appends).
      setActiveKey(`step:${s.history.length}`);
    };
  });

  // One observer over the scroller, and TWO signals out of it. Conflating them
  // would be the bug: `active` is immediate, so the chrome never lags the
  // finger, and the commit is settled, so the trail follows the reader rather
  // than the scroll.
  const timersRef = useRef<Map<string, number>>(new Map());
  // How long each slot has been at or above the commit ratio, and where it is
  // now. Kept so the decision itself can be made by `commitDecision` in
  // lib/feedqueue — the tested expression of the rule — rather than re-derived
  // from the shape of a setTimeout.
  const visibleRef = useRef<Map<string, { since: number; ratio: number }>>(new Map());
  const slotKeys = slots.map((slot) => slot.key).join("|");
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const timers = timersRef.current;
    const visible = visibleRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.slot;
          if (!key) continue;
          const ratio = entry.intersectionRatio;
          if (ratio >= COMMIT_RATIO) {
            // Compared inside the updater rather than against a ref, so this
            // never needs to read state during render.
            setActiveKey((prev) => (prev === key ? prev : key));
            const seen = visible.get(key);
            visible.set(key, { since: seen?.since ?? Date.now(), ratio });
            if (!timers.has(key)) {
              timers.set(
                key,
                window.setTimeout(() => {
                  timers.delete(key);
                  const v = visible.get(key);
                  if (!v || !key.startsWith("queued:")) return;
                  if (
                    !commitDecision({
                      ratio: v.ratio,
                      visibleMs: Date.now() - v.since,
                      committed: false,
                    })
                  ) {
                    return;
                  }
                  commitRef.current(key.slice("queued:".length));
                }, COMMIT_SETTLE_MS),
              );
            }
          } else {
            // Left before it settled: it was glimpsed, not read. This is the
            // half that stops one fling recording six stops, because
            // `scroll-snap-stop: always` halts at every card on the way.
            visible.delete(key);
            const t = timers.get(key);
            if (t !== undefined) {
              window.clearTimeout(t);
              timers.delete(key);
            }
          }
        }
      },
      // NOT `threshold: 1`. It silently never fires on an element as tall as its
      // root, which every item here is by construction.
      { root: el, threshold: [0, COMMIT_RATIO] },
    );
    for (const node of el.querySelectorAll<HTMLElement>("[data-slot]")) {
      observer.observe(node);
    }
    return () => {
      observer.disconnect();
      for (const t of timers.values()) window.clearTimeout(t);
      timers.clear();
      visible.clear();
    };
    // Re-observed when the SET of slots changes, by key rather than by count: a
    // fork can replace what is below the reader without changing how many there
    // are, and an observer still watching detached nodes would go quiet.
  }, [slotKeys]);

  // Keep the engine's `pos` on the committed stop the reader is looking at, so
  // the rail, the banner and the back-nav describe where they actually are.
  //
  // ⚠️ `jumpTo` CAN REFUSE, so this cannot fire only once per card. It early-
  // returns while a move holds the busy lock and while the tour has frozen
  // navigation — and with only the card's index to fire on, a refused jump was
  // never retried and `pos` stayed behind for the rest of the session. `pos`
  // decides the realm, the focus and (now) whether the queue may be refilled at
  // all, so it going stale is not cosmetic. Listing the things that can UNBLOCK
  // it makes the effect try again the moment they clear.
  const activeStepIndex = active?.kind === "step" ? active.index : null;
  useEffect(() => {
    // A guessed slot must never move the engine — see `activeIndex` above.
    if (foundIndex < 0) return;
    if (active?.kind !== "step") return;
    const at = s.path.indexOf(active.index);
    if (at >= 0 && active.index !== s.pos) s.jumpTo(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStepIndex, s.pos, s.advancing, s.holdNav]);

  // ----- moving the scroller ourselves -----
  const scrollToSlot = useCallback(
    (index: number, smooth = false) => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTo({
        top: index * el.clientHeight,
        behavior: smooth && !reduceMotion ? "smooth" : "instant",
      });
    },
    [reduceMotion],
  );

  // Carry the reader onto the ending — the ONE place this feed ever moves
  // without a gesture.
  //
  // ⚠️ THE GUARD IS WHAT MAKES THAT HONEST, so do not remove it. It only fires
  // when the reader is already on the LAST card, i.e. standing at a dead end
  // with nowhere further to go. Somebody scrolled up re-reading an earlier stop
  // is never yanked to the bottom. And it is not advancing anyone THROUGH
  // content — there is none left — it is showing them the exit, which is what
  // principle §2.3 asks for.
  useEffect(() => {
    if (endedRef.current) return;
    const last = slots[slots.length - 1];
    if (last?.kind !== "terminus") return;
    // ⚠️ A QUIET SOURCE IS NOT AN EXIT, SO NOBODY IS CARRIED TO IT. The whole
    // justification for this one automatic move is that there is nothing left to
    // advance anyone THROUGH — which is true of a pool read dry and of a day
    // that is over, and false of a source that did not answer. Leaving the
    // reader on their last real card also lets the background retry do its work:
    // the refill will not replace the card somebody is standing on, so carrying
    // them onto this one would strand them there until they tapped Try again.
    if (last.reason === "source-quiet") return;
    if (activeIndex !== slots.length - 2) return; // not standing at the end
    endedRef.current = true;
    scrollToSlot(slots.length - 1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.length, activeIndex]);

  // Land on the stop the session opened at: the tip of a continued trail, or the
  // seed. Done with an explicit scrollTo rather than by focusing an element,
  // because scroll-into-view-on-focus is unreliable under scroll snap.
  const placedRef = useRef(false);
  useLayoutEffect(() => {
    if (placedRef.current || s.initialLoading || s.history.length === 0) return;
    const at = s.path.indexOf(s.pos);
    placedRef.current = true;
    if (at > 0) scrollToSlot(at);
    setActiveKey(`step:${s.pos}`);
  }, [s.initialLoading, s.history.length, s.path, s.pos, scrollToSlot]);

  /** Put the reader on the tip after a move that rebuilt what is below them. */
  const scrollToTip = useCallback(() => {
    // After a fork the path changes shape, so the tip's position has to be read
    // from the NEW path on the next frame rather than computed from the old one.
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const nodes = el.querySelectorAll<HTMLElement>("[data-slot^='step:']");
      if (nodes.length > 0) scrollToSlot(nodes.length - 1, true);
    });
  }, [scrollToSlot]);

  // ----- steering: every one of these voids the queue -----
  //
  // A queued card was chosen under a promise — this realm, this focus, this line
  // of the trail. Pulling a thread, crossing realms or changing focus changes
  // that promise, so the cards are void. Nothing has to be undone because none of
  // them was ever committed; they go back to the buffer, since they already cost
  // an upstream request.
  const voidQueue = useCallback(() => {
    const { queue: rest, dropped } = invalidateQueue(queueRef.current);
    // Through the ref, like everything else that outlives one render.
    if (dropped.length > 0) sRef.current.returnToBuffer(dropped);
    setQueueBoth(rest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Make a move that changes the promise, then rebuild underneath it.
   *
   * The order is the whole point and it was got wrong first: void the queue,
   * hold the refill OFF while the move is in flight, and only let it fill again
   * once the move has landed and the realm and focus are the new ones. Filling
   * during the move is how Encyclopedia cards ended up queued under a Gallery
   * card.
   */
  const steer = useCallback(
    async (move: () => void | Promise<void>, opts: { toTip?: boolean } = {}) => {
      steeringRef.current = true;
      // The reader just asked for something different, so do not make them wait
      // out a backoff that a previous, unrelated failure started — and do not
      // keep believing the feed is dry, because that was a fact about the
      // promise they have just replaced.
      fillNextAtRef.current = 0;
      dryCountRef.current = 0;
      sourceQuietRef.current = false;
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
      voidQueue();
      try {
        await move();
      } finally {
        steeringRef.current = false;
      }
      if (opts.toTip) scrollToTip();
      // ⚠️ NOT `void fill()` HERE, AND THAT COST AN HOUR. The engine derives the
      // realm during RENDER (`realmRef.current = realm`), so immediately after
      // `await move()` the ref still says the realm we just left — the crossing
      // has landed in state but React has not re-rendered yet. Filling here drew
      // three Encyclopedia cards and stacked them under a Gallery card. Bumping
      // a tick instead defers the refill to an effect, which runs after the
      // render that makes the new realm true.
      setSteerTick((n) => n + 1);
    },
    [voidQueue, scrollToTip],
  );

  function onThread(thread: Thread) {
    void steer(() => s.onThread(thread), { toTip: true });
  }
  function onCross() {
    void steer(() => s.crossRealm(), { toTip: true });
  }
  function onReleaseFocus(realm: Parameters<typeof s.releaseFocus>[0]) {
    void steer(() => s.releaseFocus(realm));
  }
  function onOrbit(card: Card) {
    void steer(() => s.toggleOrbitHere(card));
  }

  /**
   * Step onto one of the ways this stop was left (Phase 30).
   *
   * The reader does NOT move: the path's prefix up to the fork is identical on
   * both lines (lib/branch.ts), so only what is below them is rewritten. Then
   * they are carried down exactly one item onto the line they chose, which is
   * the same distance the chips move them.
   */
  function onWay(index: number) {
    const from = activeIndex;
    void steer(() => s.onWay(index)).then(() =>
      requestAnimationFrame(() => scrollToSlot(from + 1, true)),
    );
  }

  /**
   * ♥ — "keep me in this stream".
   *
   * The card-at-a-time feed answers this by quietly redirecting the next drift
   * down one of this card's threads. A queue cannot do it quietly, because the
   * next card already exists, so it INSERTS the follow instead — and never over
   * anything the reader has begun to reveal (that is `firstMutableIndex`, and
   * swapping a card out from under someone's eye is the dishonesty §2.1 forbids).
   */
  function onReact(card: Card, signal: Parameters<typeof s.handleReact>[1]) {
    void s.handleReact(card, signal);
    if (signal !== "like") return;
    // ⚠️ ONLY THE TIP MAY STEER THE QUEUE, for the same reason only the tip may
    // fill it. A ♥ on a stop the reader scrolled BACK to would splice that
    // card's neighbour in at the head of a queue built for somewhere else —
    // measured: liking an Encyclopedia card three stops up put
    // `queued:wikipedia:Cephalopod` on top of three Met cards under a Gallery
    // tip, four deep against a capacity of three. The reaction itself still
    // records and still teaches the interest model, which is the durable half of
    // what a ♥ means; only the insert is held back.
    if (s.pos !== s.tip) return;
    // Under a focus the follow stays suppressed, exactly as it is in the other
    // shell: following a thread would carry the reader out of the field the
    // banner promises they are inside.
    if (s.banner && !s.banner.dormant) return;
    const chips = s.threadsOf(card);
    if (chips.length === 0) return;
    const follow = queuedItem(candidateToCard(chips[0].candidate), {
      type: "drift",
      fromLiked: card.displayTitle,
    });
    // The head of the queue is already partly revealed if the reader is mid-drag
    // onto it; index 0 is safe here because a tap cannot happen mid-drag, but the
    // parameter is what makes that a decision rather than an accident.
    // A ♥ says the feed is going on, so any ending standing at the bottom has
    // stopped being true and goes with it.
    setQueueBoth(
      insertAfterLike(clearTerminus(queueRef.current), follow, {
        firstMutableIndex: 0,
      }),
    );
  }

  // ----- keyboard -----
  //
  // Native key scrolling moves about 40px and mandatory snap drags it straight
  // back, so arrows would look dead without this. One key, one card — the same
  // promise the gesture makes.
  //
  // Returns the slot it moved to, which the scroll handoff below needs: an
  // ABSOLUTE destination is the only thing safe to re-issue, and re-issuing is
  // how that handler survives an engine that ignores a programmatic scroll
  // while a touch is still down.
  const stepBy = useCallback(
    (delta: number) => {
      const el = scrollerRef.current;
      if (!el) return null;
      const at = Math.round(el.scrollTop / el.clientHeight);
      // Clamped at BOTH ends, from the DOM rather than from `slots`, so this
      // needs no dependency on a list that changes every commit.
      const last = Math.max(
        0,
        Math.round((el.scrollHeight - el.clientHeight) / el.clientHeight),
      );
      const to = Math.min(last, Math.max(0, at + delta));
      scrollToSlot(to, true);
      return to;
    },
    [scrollToSlot],
  );
  // Latest handlers, reachable from the stable keydown listener below. Written
  // in an effect (not during render) and with no dependency list, so it simply
  // tracks every render, the same way `commitRef` above does.
  const keyRef = useRef({ stepBy, onThread, threads: [] as Thread[] });
  useEffect(() => {
    keyRef.current = {
      stepBy,
      onThread,
      threads: activeCard ? s.threadsOf(activeCard) : [],
    };
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      if (typing) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        keyRef.current.stepBy(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        keyRef.current.stepBy(-1);
      } else if (e.key === "1" || e.key === "2" || e.key === "3") {
        const t = keyRef.current.threads[Number(e.key) - 1];
        if (t) keyRef.current.onThread(t);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ----- touch: the realm cross, and the scroll handoff -----
  //
  // `touch-action: pan-y` on the scroller means the browser claims the vertical
  // axis and leaves horizontal drags to us, which is the only reason the cross
  // can coexist with native scrolling at all. Same reasoning as the reading
  // region's own `touch-pan-y` — see the comment in CardView.
  //
  // ⚠️ THE VERTICAL HALF IS A POLYFILL FOR SCROLL CHAINING, AND IT EXISTS
  // BECAUSE WEBKIT DOES NOT HAVE ANY. A card is two nested scrollers: this feed,
  // and the card's own reading region. Reaching the bottom of the inner one and
  // pulling further hands the gesture to the outer one in Chrome and Firefox;
  // WebKit LATCHES, moving only the scroller it picked when the finger went
  // down, so on an iPhone that pull did nothing and it took two to four separate
  // gestures to move on. Measured: every collapsed Encyclopedia card overflows
  // its region on a phone, so this was every card, not a corner. The decision
  // lives in `lib/gesture.edgePull`; the guard that makes it safe is that it
  // stands down the instant the outer scroller moves on its own, so on a
  // chaining engine nothing here fires. See docs/continuous-feed.md §8.11.
  //
  // This is the same fix `stepBy` above already is, for the same disease: a
  // small scroll of a mandatory-snap scroller gets dragged straight back, so the
  // move has to be made as one whole card or not at all.
  const touchRef = useRef<{
    x: number;
    y: number;
    lastY: number;
    /** The active card's reading region, when the touch began inside it. The
     *  marker is rendered only on the active card, so a hit here already means
     *  "in the card being read" — the gutter, a peeking neighbour, the terminus
     *  and the zoom overlay all give null and leave the browser to it. */
    region: HTMLElement | null;
    pull: PullState;
    /** Where a handoff sent the reader, and where the feed stood when it did. */
    target: number | null;
    firedAt: number | null;
  } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    const region =
      e.target instanceof Element
        ? e.target.closest<HTMLElement>("[data-drift-scroll]")
        : null;
    touchRef.current = {
      x: t.clientX,
      y: t.clientY,
      lastY: t.clientY,
      region,
      pull: NO_PULL,
      target: null,
      firedAt: null,
    };
  }

  function onTouchMove(e: React.TouchEvent) {
    const g = touchRef.current;
    const el = scrollerRef.current;
    if (!g || !g.region || !el) return;
    if (g.pull.fired) return;
    // The tour's "look around" freeze is `overflow: hidden`, which stops a
    // finger but not a programmatic scroll — so it has to be refused here.
    if (s.holdNav) return;
    const t = e.changedTouches[0];
    const dy = g.lastY - t.clientY; // + = finger travelling up = onward
    g.lastY = t.clientY;
    // ⚠️ MEASURED FRESH EVERY MOVE, NOT CACHED AT `touchstart`. The obvious
    // optimisation is to read the region's height once, since a finger is only
    // down for a moment — but "Read more" fetches the rest of an article
    // asynchronously, so a body that lands mid-gesture grows this region under
    // the reader. Cached, we would still believe they were at the bottom and
    // hand them to the next card with the article they just opened unread.
    const edges = edgesOf({
      scrollTop: g.region.scrollTop,
      clientHeight: g.region.clientHeight,
      scrollHeight: g.region.scrollHeight,
    });
    const { next, action } = edgePull(g.pull, {
      dy,
      atTop: edges.atTop,
      atBottom: edges.atBottom,
      outerTop: el.scrollTop,
      totalX: t.clientX - g.x,
      totalY: g.y - t.clientY,
    });
    g.pull = next;
    if (action === "none") return;
    g.firedAt = el.scrollTop;
    g.target = stepBy(action === "forward" ? 1 : -1);
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchRef.current;
    if (!start) return;
    const el = scrollerRef.current;
    // ⚠️ THE SAFETY NET FOR THE ONE THING THAT CANNOT BE TESTED WITHOUT AN
    // IPHONE: whether WebKit honours a programmatic scroll of the outer scroller
    // while a touch is still latched to the inner one. If it did not, the feed
    // has not moved a pixel since we asked, and asking again now that the finger
    // is up costs nothing. It re-issues the ABSOLUTE slot rather than another
    // relative step, so it can never turn one card into two.
    if (start.target !== null && start.firedAt !== null && el) {
      if (Math.abs(el.scrollTop - start.firedAt) < 4) scrollToSlot(start.target, true);
      return; // a handoff and a realm cross are never the same gesture
    }
    if (!s.crossEnabled) return;
    const deltaX = e.changedTouches[0].clientX - start.x;
    const deltaY = start.y - e.changedTouches[0].clientY;
    if (resolveHorizontalSwipe({ deltaX, deltaY }) === "cross") onCross();
  }

  // ----- wheel: the same handoff, for macOS Safari -----
  //
  // WebKit latches trackpad scrolls exactly as it latches touch, so a Mac reader
  // meets the same dead pull at the end of an article. Chrome and Firefox chain
  // natively and the stand-down guard keeps this inert there.
  //
  // ⚠️ THE ONE THING TOUCH DOES NOT NEED: trackpad momentum keeps firing `wheel`
  // events after the fingers lift, which is exactly the false advance the old
  // feed's "measure the edge at the START of the gesture" rule existed to
  // prevent. A burst that has gone quiet therefore starts a fresh budget.
  //
  // That reset is deliberately conservative, and one case is knowingly left on
  // the table: a DISCRETE mouse wheel in Safari, notched slowly enough that
  // every notch starts a new burst, may never accrue `WHEEL_THRESHOLD` and so
  // never hand off. That is exactly what Safari does today with no handler at
  // all, so the worst case here is "no better", never "worse" — which is the
  // right way round for an engine nobody here can test on.
  const wheelRef = useRef<{ pull: PullState; at: number }>({
    pull: NO_PULL,
    at: 0,
  });

  function onWheel(e: React.WheelEvent) {
    const el = scrollerRef.current;
    if (!el || s.holdNav) return;
    const region =
      e.target instanceof Element
        ? e.target.closest<HTMLElement>("[data-drift-scroll]")
        : null;
    if (!region) return;
    const w = wheelRef.current;
    const now = Date.now();
    if (now - w.at > WHEEL_QUIET_MS) w.pull = NO_PULL;
    w.at = now;
    if (w.pull.fired) return;
    const edges = edgesOf({
      scrollTop: region.scrollTop,
      clientHeight: region.clientHeight,
      scrollHeight: region.scrollHeight,
    });
    // A wheel has no axis to lock, so `totalX`/`totalY` are left off.
    const { next, action } = edgePull(w.pull, {
      dy: e.deltaY, // + = scrolling down the page = onward
      atTop: edges.atTop,
      atBottom: edges.atBottom,
      outerTop: el.scrollTop,
      threshold: WHEEL_THRESHOLD,
    });
    w.pull = next;
    if (action !== "none") stepBy(action === "forward" ? 1 : -1);
  }

  if (s.dayDone) {
    return (
      <div className="h-dvh overflow-y-auto bg-paper" data-realm={s.realm}>
        <DayDone stops={s.meter?.stops ?? 0} />
      </div>
    );
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-paper"
      data-realm={s.realm}
      // React attaches `touchstart`, `touchmove` and `wheel` PASSIVELY at the
      // root, and none of these calls `preventDefault`, so listening here cannot
      // cost the scroll a frame.
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      <FeedTopBar
        steps={s.path.map((i) => s.history[i])}
        pos={s.pathPos}
        branchAt={s.branchAt}
        stops={s.history.length}
        stopsLeft={
          s.meter && shouldWarn(s.meter, FREE_DAILY_STOPS)
            ? (stopsRemaining(s.meter, FREE_DAILY_STOPS) ?? undefined)
            : undefined
        }
        realm={{ label: s.realmMeta.label, glyph: s.realmMeta.glyph }}
        otherRealm={
          s.crossEnabled
            ? {
                id: s.otherRealmMeta.id,
                label: s.otherRealmMeta.label,
                glyph: s.otherRealmMeta.glyph,
              }
            : undefined
        }
        onCrossRealm={s.crossEnabled ? onCross : undefined}
        endless={s.endless}
        onJump={(i) => scrollToSlot(i, true)}
        onEnd={() => s.endSession()}
      />

      {s.banner && (
        <FocusBanner
          focus={s.banner.focus}
          proximity={s.bannerSuffix}
          releaseLabel={
            s.revealed ? `Back to ${focusName(s.revealed)}` : "Drift freely"
          }
          onRelease={() => onReleaseFocus(s.bannerRealm)}
        />
      )}

      <main className="relative min-h-0 flex-1">
        {s.initialLoading && (
          <div className="flex h-full items-center justify-center">
            <p className="animate-pulse font-serif text-xl text-ink-soft">
              Finding a starting point…
            </p>
          </div>
        )}

        {s.error && !s.initialLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-sm text-ink-soft">{s.error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
            >
              Try again
            </button>
          </div>
        )}

        {!s.initialLoading && !s.error && (
          <div
            ref={scrollerRef}
            // `tabindex` because only Chrome makes a scroller keyboard-focusable
            // on its own, and without focus a keyboard reader cannot move at all.
            tabIndex={0}
            aria-label="Your drift"
            // `h-full` inside the h-dvh shell, never the document scroller: the
            // page itself never scrolls, so mobile keeps its browser chrome up
            // and the height stays stable. That is what keeps the snap positions
            // from shifting mid-scroll.
            // `holdNav` is the tour "looking around" at a card: navigation is
            // frozen so the reader can study it without drifting off. A boolean
            // means nothing to a native scroller, so freezing here is literally
            // refusing to scroll.
            className={`focus-ring h-full touch-pan-y snap-y snap-mandatory ${
              s.holdNav ? "overflow-hidden" : "overflow-y-auto"
            }`}
          >
            {slots.map((slot, i) => {
              const isActive = slot.key === active?.key;
              // ⚠️ THE HEAVY IMAGE IS LOADED FOR THE ACTIVE CARD AND ITS
              // NEIGHBOURS ONLY. See `heavy` on ImagePanel: four cards are on
              // screen, and a Gallery card's full-size image comes through our
              // own proxy, which fetches a multi-megabyte original per card.
              // Rendering all of them at once is what "the Gallery was slow to
              // load" turned out to be.
              const heavy = Math.abs(i - activeIndex) <= 1;
              const card =
                slot.kind === "step"
                  ? slot.step.card
                  : slot.kind === "queued"
                    ? slot.item.card
                    : null;
              const via =
                slot.kind === "step"
                  ? slot.step.arrivedVia
                  : slot.kind === "queued"
                    ? slot.item.via
                    : null;
              return (
                <article
                  // ⚠️ KEYED ON THE CARD, NOT ON THE SLOT. A slot key changes
                  // from `queued:…` to `step:…` the instant a card commits, and
                  // keying on that would unmount and remount the card at exactly
                  // that moment — a visible flash and a re-fetched image, on
                  // every single stop. `data-slot` still carries the changing
                  // identity, for the observer, which is what wants to know.
                  key={card ? cardId(card) : slot.key}
                  data-slot={slot.key}
                  // `snap-always` is the anti-fling control: the browser must
                  // stop at every card, so a hard swipe cannot blur past six of
                  // them. That is a §2 control, not a performance one.
                  className={`h-full w-full snap-start snap-always ${SEAM}`}
                  // ⚠️ EVERY CARD BUT THE ONE BEING READ IS INERT, and it is an
                  // agency control rather than a nicety. Four cards are laid out
                  // at once, so Tab walked straight out of the active card into
                  // the queue below it — and the browser scrolls focus into
                  // view, so a keyboard reader reaching for "Read more" was
                  // carried three cards down the feed and those cards committed
                  // to their trail. `inert` also stops a screen reader
                  // announcing three articles nobody has arrived at.
                  inert={!isActive}
                >
                  {slot.kind === "ad" && <AdCard config={ADS} />}
                  {slot.kind === "terminus" && (
                    <TerminusCard
                      reason={slot.reason}
                      focusLabel={s.banner ? focusName(s.banner.focus) : undefined}
                      // "Go wider" used to sit here beside "Drift freely" and
                      // both called releaseFocus, so the card offered one action
                      // under two names. There is nothing else to offer: every
                      // widening ladder the engine has (the orbit rings, the
                      // artist rings, the field's deep window) has already been
                      // climbed before an ending is placed, so letting the focus
                      // go IS going wider.
                      onDriftFreely={
                        s.banner ? () => onReleaseFocus(s.bannerRealm) : undefined
                      }
                      onRetry={slot.reason === "source-quiet" ? retryNow : undefined}
                      onSeeTrail={() => s.endSession()}
                      stops={s.history.length}
                    />
                  )}
                  {card && via && (
                    <CardView
                      card={card}
                      realm={s.realm}
                      arrivedVia={via}
                      threads={s.threadsOf(card)}
                      threadsLoading={s.threadsPendingFor(card)}
                      onThread={onThread}
                      onExpand={
                        slot.kind === "step"
                          ? () => s.markExpanded(slot.index)
                          : undefined
                      }
                      reaction={s.reactions[cardId(card)]}
                      onReact={
                        s.realmMeta.hasInterestModel
                          ? (sig) => onReact(card, sig)
                          : undefined
                      }
                      onShare={
                        cloudConfigured && user
                          ? () => setShareCard(card)
                          : undefined
                      }
                      onOrbit={
                        s.realm === "encyclopedia" ? () => onOrbit(card) : undefined
                      }
                      orbiting={isActive && s.orbitingThisCard}
                      // Standing on a stop already left: the chips branch rather
                      // than continue, and the fork gets a switch (Phase 30).
                      // Only the card being READ may say so.
                      revisiting={isActive && revisiting}
                      ways={
                        isActive && slot.kind === "step"
                          ? s.waysFrom(slot.index)
                          : undefined
                      }
                      onWay={isActive ? onWay : undefined}
                      active={isActive}
                      heavyImage={heavy}
                      // Reading an article must never fall out of it by
                      // accident, but on a phone a long piece is most of the
                      // screen, so trapping the gesture would leave no way
                      // onward. Chaining lets the drag carry into the next card
                      // once the article is actually finished.
                      scrollChaining="auto"
                    />
                  )}
                </article>
              );
            })}
          </div>
        )}

        {s.hint && (
          <div className="pointer-events-none absolute inset-x-0 bottom-safe z-10 flex justify-center px-4">
            <span className="rounded-full bg-paper-raised px-4 py-2 text-center text-sm font-medium text-ink-soft shadow-lg ring-1 ring-line">
              {s.hint}
            </span>
          </div>
        )}

        {s.following && (
          <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center px-4">
            <span className="rounded-full bg-ink/85 px-4 py-2 text-center text-sm font-medium text-paper shadow-lg">
              {s.following.branch ? "New branch" : "Following"}: {s.following.label}…
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

        {!s.ended && !nudgeDismissed && s.history.length >= NUDGE_AT && (
          <div className="absolute inset-x-0 bottom-safe z-10 flex justify-center px-4">
            <div className="flex items-center gap-3 rounded-2xl bg-paper-raised px-4 py-3 shadow-lg ring-1 ring-line">
              <p className="text-sm text-ink-soft">
                {s.endless
                  ? "You've wandered far. A nice place to pause?"
                  : "You've wandered far. Want to see your trail?"}
              </p>
              {s.endless ? (
                <Link
                  href="/"
                  className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
                >
                  Head home
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => s.endSession()}
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

      {s.ended && (
        <EndOverlay
          history={s.history}
          realm={s.realm}
          existing={s.endExisting}
          onSaved={s.onTrailSaved}
          onOpenDoor={(od) => void steer(() => s.openDoor(od), { toTip: true })}
          onClose={() => s.setEnded(false)}
          reason={s.endReason}
        />
      )}
    </div>
  );
}
