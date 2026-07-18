"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import type {
  ArrivedVia,
  Card,
  RelatedCandidate,
  Thread,
  TrailStep,
} from "@/lib/types";
import { candidateToCard } from "@/lib/wiki";
import { cardId } from "@/lib/card";
import { selectDiverseThreads, selectFacetThreads } from "@/lib/diversity";
import { classifyThreads } from "@/lib/threads";
import { pickDriftNext, pickRandomThread } from "@/lib/drift";
import {
  edgesOf,
  resolveSwipe,
  resolveHorizontalSwipe,
  isWheelReadingScroll,
} from "@/lib/gesture";
import { randomOffset, interleave } from "@/lib/discover";
import { applyFeedback, type Interest, type Reaction } from "@/lib/interest";
import { getRealm, discoverUrl, relatedUrl, doorwayUrl, summaryUrl } from "@/lib/realms";
import type { RealmId } from "@/lib/realms/types";
import { realmOfSource } from "@/lib/crossrealm";
import { autoTrailName } from "@/lib/naming";
import { computeTrailStats, formatDuration } from "@/lib/stats";
import { trailToText } from "@/lib/export";
import { exportTrailPng } from "@/lib/export-image";
import {
  getTrail,
  loadSeen,
  persistSeen,
  saveTrail,
  renameTrail,
  setTrailLiked,
  recordSession,
  getInterest,
  setInterest,
  getReactions,
  setReaction,
  getCachedTopics,
  cacheTopics,
  getSettings,
} from "@/lib/storage";
import { CardView } from "@/components/CardView";
import { FeedTopBar, FeedBottomNav } from "@/components/FeedChrome";
import { TrailMap } from "@/components/TrailMap";
import { useAuth } from "@/components/AuthProvider";
import { ShareToFriend } from "@/components/ShareToFriend";
import { cardToSharePayload } from "@/lib/social/share";

type Dir = "drift" | "thread" | "back" | "cross";

// A random-drift card waiting in the buffer, tagged with the topic it came from
// (interesting-random, M8) and why that topic was chosen (M9). topic/reason are
// absent for cards from the plain-random fallback.
type BufferedCard = {
  card: Card;
  topic?: { id: string; label: string };
  reason?: "interest" | "wildcard";
};

// Enough of a saved trail to update it in place (preserving id/name/like/date).
type SessionTrail = {
  id: string;
  name: string;
  liked: boolean;
  createdAt: number;
};

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

const spring = { type: "spring", stiffness: 260, damping: 30 } as const;

// After this many stops, offer a gentle, dismissible nudge toward the trail map
// (spec §2.4 "gentle awareness, not guilt"). Never blocks, never guilts.
const NUDGE_AT = 25;

// A buffer refill pulls this many topics and this many cards per topic, then
// interleaves them — so the random-drift buffer holds a mix of a few topics at a
// time (variety) and rotates to fresh topics once drained. Kept small on purpose:
// a large buffer would keep a session stuck on the same 1–2 topics for dozens of
// stops. The search endpoint isn't burst-limited, so refilling often is cheap.
const REFILL_TOPICS = 3;
const DISCOVER_LIMIT = 4;

// The card's inner scroll region under a wheel/touch event target, or null if the
// gesture began outside it (the threads bar, the desktop image panel, gaps). The
// element carries [data-drift-scroll] (see CardView). Used to tell "scroll to
// read" from "overscroll to drift on".
function scrollRegionFrom(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? (target.closest("[data-drift-scroll]") as HTMLElement | null)
    : null;
}

export default function DriftPage() {
  const { user, cloudConfigured } = useAuth();
  const [shareCard, setShareCard] = useState<Card | null>(null);
  const [history, setHistory] = useState<TrailStep[]>([]);
  const [pos, setPos] = useState(0);
  const [threadCache, setThreadCache] = useState<Record<string, Thread[]>>({});
  const [dir, setDir] = useState<Dir>("drift");
  const [followingLabel, setFollowingLabel] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  // "Just drift" mode (?mode=endless): the trail framing is removed (no rail, no
  // save prompt, a gentle pause nudge instead). History still accrues in memory,
  // so the quiet "Keep this trail" escape hatch can save it if you decide to.
  const [endless, setEndless] = useState(false);
  // Snapshot of this session's saved-trail meta, captured (from a ref) when the
  // end screen opens — reading the ref here rather than during render.
  const [endExisting, setEndExisting] = useState<SessionTrail | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-cardId ♥/✕ (drives the button state on each card). The interest weights
  // themselves live in a ref (in-memory truth, persisted on change).
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  // The realm FOLLOWS the displayed card (Phase 15): a trail can now span both
  // realms (cross via a doorway or a horizontal swipe), so "which realm am I in"
  // is derived from the current card's source, not fixed for the session. This
  // `initialRealm` is only the pre-first-card fallback (set from ?realm= / a
  // continued trail). `realm` (derived below) + `realmRef` are the live values.
  const [initialRealm, setInitialRealm] = useState<RealmId>("encyclopedia");
  const realmRef = useRef<RealmId>("encyclopedia");

  const seenRef = useRef<Set<string>>(new Set());
  // The interest model (topic → weight) + whether personalization is on. Held in
  // refs so the buffer refill reads the latest without re-subscribing. Only the
  // random-drift topic pick uses these; threads are never personalized.
  const interestRef = useRef<Interest>({});
  const personalizeRef = useRef(true);
  const busyRef = useRef(false);
  const wheelAccumRef = useRef(0);
  const wheelTsRef = useRef(0);
  const fireTsRef = useRef(0);
  // The vertical start of a touch + the card scroll region's edge state at that
  // moment (measured at start so iOS momentum after touchend can't cause a false
  // advance). Read by onTouchEnd via resolveSwipe.
  const touchStartRef = useRef<{
    x: number;
    y: number;
    insideRegion: boolean;
    atTop: boolean;
    atBottom: boolean;
  }>({ x: 0, y: 0, insideRegion: false, atTop: true, atBottom: true });
  // A buffer of "interesting random" cards, tagged with their topic. Random
  // drifts are served from here; it's refilled reactively when it runs dry (via
  // the topic-discover endpoint) — deliberately NOT a continuously-topped-up
  // queue. See fetchDiscoverBatch / refillRandomBuffer.
  const randomBufferRef = useRef<BufferedCard[]>([]);
  // The currently-viewed step + when we landed on it, so we can attribute rough
  // dwell time to each stop (nice for the trail map + stats). Best-effort.
  const dwellRef = useRef<{ index: number; at: number }>({ index: 0, at: 0 });
  // Per drift-session identity for the personal stats view (upserted on end).
  const sessionIdRef = useRef<string>("");
  const sessionStartRef = useRef<number>(0);
  // The saved trail this drift-session maps to: set when we arrive via
  // ?continue=<id>, or on the first Save. Re-saving (after more drifting, or
  // re-opening the end screen) updates the same trail — preserving its id, name,
  // liked state and original createdAt — instead of duplicating or resetting it.
  const sessionTrailRef = useRef<SessionTrail | null>(null);

  const current = history[pos];
  // Realm follows the displayed card's source (so back-nav across a crossing shows
  // the right chrome/threads), falling back to the seed realm before the first
  // card. Mirrored into realmRef in render so async handlers/effects read the live
  // realm without a stale-closure race.
  const realm: RealmId = current ? realmOfSource(current.card.source) : initialRealm;
  realmRef.current = realm;
  const realmMeta = getRealm(realm);
  // The realm a horizontal swipe / the top-bar control crosses INTO (two realms).
  const otherRealmMeta = getRealm(realm === "gallery" ? "encyclopedia" : "gallery");
  // The displayed card's app-wide id (thread cache key) and source-native id
  // (used to fetch related/summary). Distinct because two realms can share a
  // native title string.
  const displayedId = current ? cardId(current.card) : undefined;
  const displayedNative = current?.card.pageTitle;

  // Threads come from a per-card cache, so going back shows the same threads a
  // card had (fixing the "threads disappear on back" bug) and any viewed card
  // that isn't cached yet counts as still-loading.
  const threads = displayedId ? (threadCache[displayedId] ?? []) : [];
  const threadsLoading = !!displayedId && !(displayedId in threadCache);
  // The displayed card, mirrored to a ref so the (deferred) threads fetch can
  // classify it (Phase 6) without adding it to the effect deps. The abort on
  // navigation guarantees a resolved fetch still matches this card.
  const cardForThreadsRef = useRef<Card | undefined>(undefined);
  cardForThreadsRef.current = current?.card;

  // ----- initial card -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const title = params.get("title");
      const seed = params.get("seed");
      const continueId = params.get("continue");
      const realmParam = params.get("realm");
      const bucketParam = params.get("bucket");
      // "Just drift" (endless) comes from the homepage toggle; a continued trail
      // always keeps its trail (that branch returns before we set endless).
      const wantEndless = params.get("mode") === "endless";
      if (!sessionIdRef.current) {
        sessionIdRef.current = crypto.randomUUID();
        sessionStartRef.current = Date.now();
      }
      // Fix the session's realm up front (validated → unknown falls to
      // Encyclopedia); a continued trail overrides it below from its own realm.
      const startRealm = getRealm(realmParam).id;
      realmRef.current = startRealm;
      setInitialRealm(startRealm);
      try {
        // Hydrate the persistent seen-list so we don't immediately repeat pages
        // visited in earlier sessions (spec §5).
        try {
          for (const t of await loadSeen()) seenRef.current.add(t);
        } catch {
          /* storage unavailable — session-only seen still works */
        }
        // Hydrate the interest model + prior reactions + the personalize setting
        // (defaults on). All optional — failure just means unpersonalized drift.
        try {
          interestRef.current = await getInterest();
        } catch {
          /* no interest yet — uniform topics */
        }
        try {
          const s = await getSettings();
          personalizeRef.current = s.personalize !== false;
        } catch {
          /* default: personalization on */
        }
        try {
          if (!cancelled) setReactions(await getReactions());
        } catch {
          /* no reactions yet */
        }
        if (cancelled) return;

        // Continue a saved trail: rehydrate its steps and resume at the last one.
        if (continueId) {
          const trail = await getTrail(continueId);
          if (cancelled) return;
          if (trail && trail.steps.length > 0) {
            const trealm = getRealm(trail.realm).id;
            realmRef.current = trealm;
            setInitialRealm(trealm);
            trail.steps.forEach((s) => seenRef.current.add(cardId(s.card)));
            sessionTrailRef.current = {
              id: trail.id,
              name: trail.name,
              liked: trail.liked,
              createdAt: trail.createdAt,
            };
            setHistory(trail.steps);
            setPos(trail.steps.length - 1);
            return;
          }
        }

        let card: Card | undefined;
        if (title) {
          const res = await fetch(summaryUrl(realmRef.current, title));
          const c = (await res.json()) as Card;
          if (!res.ok || !c?.pageTitle) throw new Error("no card");
          card = c;
        } else if (bucketParam) {
          // Seed a bucket drift (Gallery/Library seed tile): fetch that specific
          // bucket's batch — first card is the starting point, the rest seed the
          // buffer so the first drifts stay on-theme and instant.
          const res = await fetch(
            discoverUrl(realmRef.current, {
              bucket: bucketParam,
              offset: randomOffset(),
              limit: 12,
            }),
          );
          const cards = (await res.json()) as Card[];
          if (!res.ok || !Array.isArray(cards) || cards.length === 0)
            throw new Error("no card");
          card = cards[0];
          const bLabel = getRealm(realmRef.current).bucketLabel(bucketParam);
          randomBufferRef.current.push(
            ...cards.slice(1).map((c) => ({
              card: c,
              topic: { id: bucketParam, label: bLabel },
            })),
          );
        } else {
          // "Surprise me": seed from an interesting-random discover batch
          // (popular, on-topic, varied) — first card is the starting point, the
          // rest seed the drift buffer so the first several random drifts are
          // instant. Encyclopedia falls back to the plain random endpoint if
          // discover is down; other realms rely on discover alone.
          const batch = await fetchDiscoverBatch();
          if (batch.length > 0) {
            card = batch[0].card;
            randomBufferRef.current.push(...batch.slice(1));
          } else if (realmRef.current === "encyclopedia") {
            const res = await fetch("/api/wiki/random");
            const cards = (await res.json()) as Card[];
            if (!res.ok || !Array.isArray(cards) || cards.length === 0)
              throw new Error("no card");
            card = cards[0];
            randomBufferRef.current.push(...cards.slice(1).map((c) => ({ card: c })));
          } else {
            throw new Error("no card");
          }
        }
        if (cancelled || !card) return;
        seenRef.current.add(cardId(card));
        persistSeen([cardId(card)]);
        if (wantEndless) setEndless(true);
        const via: ArrivedVia = {
          type: "seed",
          seedName: seed ?? title ?? "Surprise me",
        };
        setHistory([
          { card, arrivedVia: via, timestamp: Date.now(), expanded: false },
        ]);
        setPos(0);
      } catch {
        if (!cancelled)
          setError(
            "Couldn't reach the source. Check your connection and try again.",
          );
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ----- threads for whichever card is displayed (live or a revisited one) -----
  // Aborting on cleanup cancels superseded requests during fast scrolling and
  // avoids React StrictMode's duplicate dev fetch — both help dodge 429s.
  useEffect(() => {
    if (!displayedId || !displayedNative || displayedId in threadCache) return;
    const controller = new AbortController();
    const rid = realmRef.current;
    (async () => {
      // In-realm threads + a cross-realm doorway (Phase 15), fetched together
      // within this card's prefetch window. The doorway is best-effort: {} on any
      // miss ⇒ no doorway chip, in-realm threads unaffected.
      const [cands, door] = await Promise.all([
        fetch(relatedUrl(rid, displayedNative), { signal: controller.signal })
          .then((r) => r.json())
          .catch(() => []),
        fetch(doorwayUrl(rid, displayedNative), { signal: controller.signal })
          .then((r) => r.json())
          .catch(() => ({})),
      ]);
      const rm = getRealm(rid);
      const cc = cardForThreadsRef.current;
      let chosen: Thread[] = [];
      if (Array.isArray(cands)) {
        if (rm.threadMode === "facet") {
          chosen = selectFacetThreads(cands, { count: 3, seen: seenRef.current });
        } else if (cc && cc.pageTitle === displayedNative) {
          // Encyclopedia: classify into directional threads (Phase 6).
          chosen = classifyThreads(cc, cands, { count: 3, seen: seenRef.current });
        } else {
          chosen = selectDiverseThreads(cands, { count: 3, seen: seenRef.current });
        }
      }
      const cand = (door as { candidate?: RelatedCandidate })?.candidate;
      if (cand?.pageTitle && !seenRef.current.has(cardId(cand))) {
        chosen = [
          ...chosen,
          {
            candidate: cand,
            label: cand.threadLabel || cand.displayTitle || cand.pageTitle,
            eyebrow: cand.eyebrow,
            doorway: realmOfSource(cand.source),
          },
        ];
      }
      setThreadCache((c) => ({ ...c, [displayedId]: chosen }));
    })().catch((e: unknown) => {
      if ((e as { name?: string })?.name !== "AbortError")
        setThreadCache((c) => ({ ...c, [displayedId]: [] }));
    });
    return () => controller.abort();
  }, [displayedId, displayedNative, threadCache]);

  // ----- dwell time -----
  // Add the elapsed time to the step we're leaving (accumulates, so revisits add
  // more), then start the clock on the newly-viewed step. Runs in an effect, so
  // Date.now() here is fine (not a render-purity violation).
  function accrueDwell(now: number) {
    const prev = dwellRef.current;
    if (prev.at > 0 && prev.index !== undefined) {
      const elapsed = now - prev.at;
      setHistory((h) => {
        if (prev.index < 0 || prev.index >= h.length) return h;
        const copy = h.slice();
        const s = copy[prev.index];
        copy[prev.index] = { ...s, dwellMs: (s.dwellMs ?? 0) + elapsed };
        return copy;
      });
    }
  }

  useEffect(() => {
    const now = Date.now();
    if (dwellRef.current.index !== pos) accrueDwell(now);
    dwellRef.current = { index: pos, at: now };
  }, [pos]);

  // Finalize the current card's dwell (it's never "left") before the trail map,
  // so the duration includes the stop you ended on.
  function endSession() {
    const now = Date.now();
    accrueDwell(now);
    dwellRef.current = { index: dwellRef.current.index, at: now };
    setEndExisting(sessionTrailRef.current);
    setEnded(true);
    // Record this drift-session for the personal stats view. Wall-clock duration
    // (start → end) is more honest than summed dwell for "time spent".
    if (sessionIdRef.current) {
      const s = computeTrailStats(history);
      recordSession({
        id: sessionIdRef.current,
        startedAt: sessionStartRef.current,
        stops: s.stops,
        threadsPulled: s.threadsPulled,
        drifts: s.drifts,
        durationMs: Math.max(0, now - sessionStartRef.current),
      });
    }
  }

  // Mark a step as "read more"-expanded (drives the trail-map glow + stats).
  function markExpanded(index: number) {
    setHistory((h) => {
      if (index < 0 || index >= h.length || h[index].expanded) return h;
      const copy = h.slice();
      copy[index] = { ...copy[index], expanded: true };
      return copy;
    });
  }

  // ----- navigation -----
  function pushStep(card: Card, via: ArrivedVia, direction: Dir) {
    seenRef.current.add(cardId(card));
    persistSeen([cardId(card)]); // fire-and-forget; serialized in storage
    setDir(direction);
    const step: TrailStep = {
      card,
      arrivedVia: via,
      timestamp: Date.now(),
      expanded: false,
    };
    // Slicing to pos+1 means taking a thread from a revisited card branches a
    // new direction from there (and is a no-op at the live end).
    setHistory((h) => [...h.slice(0, pos + 1), step]);
    setPos(pos + 1);
  }

  async function advance() {
    if (ended || busyRef.current) return;

    // Revisiting: move forward through existing history without a new step.
    if (pos < history.length - 1) {
      setDir("drift");
      setPos((p) => p + 1);
      return;
    }

    // At the live card → drift. By default every drift is an independent random
    // jump (two scrolls are unrelated). The one exception: if you ♥-liked this
    // card, the next drift follows one of its related threads to "stay in the
    // stream" (instant, on-theme) — relatedness tied to an explicit signal, not
    // a blind coin flip that used to chain near-identical pages together.
    const likedCurrent = current
      ? reactions[cardId(current.card)] === "like"
      : false;
    const choice = pickDriftNext(threads, { likedCurrent });
    if (choice.type === "thread" && current) {
      pushStep(
        candidateToCard(choice.thread.candidate),
        { type: "drift", fromLiked: current.card.displayTitle },
        "drift",
      );
      return;
    }

    // Independent random drift. Served from the buffered batch: instant whenever
    // it holds cards; we only refetch when it runs dry. The buffer is filled from
    // the topic-discover endpoint (interesting-random), so a "random" drift lands
    // on a popular, on-topic page instead of an obscure stub — and carries the
    // topic it came from (shown on the card).
    let bc = takeBufferedRandom();
    if (!bc) {
      busyRef.current = true;
      setAdvancing(true);
      try {
        await refillRandomBuffer();
        bc = takeBufferedRandom();
      } finally {
        busyRef.current = false;
        setAdvancing(false);
      }
    }
    if (bc) {
      pushStep(
        bc.card,
        { type: "drift", topic: bc.topic, reason: bc.reason },
        "drift",
      );
    } else {
      // Refill failed (both discover and random unavailable). Keep advancing on
      // a *random* untapped thread (morelike stays healthy under throttling),
      // else a gentle hint. Never a silent dead button.
      const t = pickRandomThread(threads);
      if (t) {
        pushStep(candidateToCard(t.candidate), { type: "drift" }, "drift");
      } else {
        showHint("The source is catching its breath. Try drifting again in a moment.");
      }
    }
  }

  // Cross to the OTHER realm (Phase 15) — from a horizontal swipe or the top-bar
  // control. "Smart cross": land on the current card's doorway if one exists (a
  // genuinely related crossing), else a fresh discover card in the other realm.
  // Either way the realm then follows the landed card.
  async function crossRealm() {
    if (ended || busyRef.current || !current) return;
    const fromRealm = realm;
    const otherRealm: RealmId =
      fromRealm === "gallery" ? "encyclopedia" : "gallery";
    busyRef.current = true;
    setAdvancing(true);
    try {
      let landed: { card: Card; via: ArrivedVia } | null = null;

      // #1 the current card's doorway (related crossing).
      try {
        const res = await fetch(doorwayUrl(fromRealm, current.card.pageTitle), {
          signal: AbortSignal.timeout(6000),
        });
        const data = (await res.json()) as { candidate?: RelatedCandidate };
        const cand = data?.candidate;
        if (cand?.pageTitle && !seenRef.current.has(cardId(cand))) {
          landed = {
            card: candidateToCard(cand),
            via: {
              type: "thread",
              label: cand.threadLabel || cand.displayTitle || cand.pageTitle,
              fromTitle: current.card.pageTitle,
              crossedFrom: fromRealm,
            },
          };
        }
      } catch {
        /* no doorway — fall through to a fresh card */
      }

      // #2 no doorway → a fresh discover card in the other realm.
      if (!landed) {
        const batch = await fetchDiscoverBatch(otherRealm);
        const idx = batch.findIndex(
          (b) => b.card?.pageTitle && !seenRef.current.has(cardId(b.card)),
        );
        if (idx >= 0) {
          const bc = batch[idx];
          landed = {
            card: bc.card,
            via: {
              type: "drift",
              topic: bc.topic,
              reason: bc.reason,
              crossedFrom: fromRealm,
            },
          };
          // Seed the buffer with the rest so the next drifts in the new realm are instant.
          randomBufferRef.current.push(...batch.filter((_, i) => i !== idx));
        }
      }

      if (landed) pushStep(landed.card, landed.via, "cross");
      else showHint("Couldn't cross realms just now. Try again in a moment.");
    } finally {
      busyRef.current = false;
      setAdvancing(false);
    }
  }

  // Take the next unseen card off the random buffer (discarding any now-seen), or
  // null if the buffer is empty.
  function takeBufferedRandom(): BufferedCard | null {
    const buf = randomBufferRef.current;
    while (buf.length > 0) {
      const bc = buf.shift()!;
      // Only serve cards from the realm we're currently in (the buffer can hold
      // leftovers from the other side of a crossing).
      if (
        bc?.card?.pageTitle &&
        !seenRef.current.has(cardId(bc.card)) &&
        realmOfSource(bc.card.source) === realmRef.current
      )
        return bc;
    }
    return null;
  }

  // One buffer refill: pick REFILL_TOPICS topics, fetch a small popular-but-
  // varied batch for each (via /api/wiki/discover), drop already-seen cards, and
  // interleave so consecutive random drifts alternate topics. Returns [] on total
  // failure. Topic choice is interest-weighted when personalization is on (with a
  // serendipity floor + truthful reason), else a plain uniform-random wander.
  async function fetchDiscoverBatch(
    rid: RealmId = realmRef.current,
  ): Promise<BufferedCard[]> {
    const rm = getRealm(rid);
    const personalize = personalizeRef.current && rm.hasInterestModel;
    const picks = Array.from({ length: REFILL_TOPICS }, () =>
      rm.pickDiscover({ interest: interestRef.current, personalize }),
    );
    const batches = await Promise.all(
      picks.map(async (pick): Promise<BufferedCard[]> => {
        try {
          const res = await fetch(
            discoverUrl(rid, {
              bucket: pick.bucket,
              offset: randomOffset(),
              limit: DISCOVER_LIMIT,
            }),
            { signal: AbortSignal.timeout(6000) },
          );
          if (!res.ok) return [];
          const cards = (await res.json()) as Card[];
          if (!Array.isArray(cards)) return [];
          return cards
            .filter((c) => c?.pageTitle && !seenRef.current.has(cardId(c)))
            .map((card) => ({
              card,
              topic: { id: pick.id, label: pick.label },
              reason: pick.reason,
            }));
        } catch {
          return [];
        }
      }),
    );
    return interleave(batches);
  }

  // Resolve a page's tracked topics — from the client cache, else the topics API
  // (Lift Wing). Returns [] on any failure (the like still records, model just
  // doesn't move). Cached so re-reacting costs nothing.
  async function resolveTopics(title: string): Promise<string[]> {
    try {
      const cached = await getCachedTopics(title);
      if (cached) return cached;
    } catch {
      /* fall through to fetch */
    }
    try {
      const res = await fetch(
        `/api/wiki/topics?title=${encodeURIComponent(title)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { topics?: string[] };
      const topics = Array.isArray(data?.topics) ? data.topics : [];
      cacheTopics(title, topics);
      return topics;
    } catch {
      return [];
    }
  }

  // ♥/✕ a card. Optimistically flips the button, persists the reaction, then
  // adjusts the interest weights: undo the previous reaction (if any) and apply
  // the new one, so switching or clearing is consistent. Threads are untouched.
  async function handleReact(card: Card, signal: Reaction) {
    const id = cardId(card);
    const prev = reactions[id];
    const next = prev === signal ? undefined : signal; // click the active one → clear

    setReactions((r) => {
      const copy = { ...r };
      if (next) copy[id] = next;
      else delete copy[id];
      return copy;
    });
    setReaction(id, next ?? null);

    if (!prev && !next) return;
    const topics = await resolveTopics(card.pageTitle);
    if (topics.length === 0) return;

    let interest = interestRef.current;
    if (prev) {
      interest = applyFeedback(interest, topics, prev === "like" ? "dislike" : "like");
    }
    if (next) {
      interest = applyFeedback(interest, topics, next);
    }
    interestRef.current = interest;
    setInterest(interest);
  }

  // Refill the buffer from the topic-discover endpoint. If that yields nothing
  // (throttled/offline), we deliberately do NOT fall back to /api/wiki/random —
  // that's the endpoint Wikimedia burst-limits first, so hammering it under
  // throttling only makes things worse. Instead advance() falls back to a
  // morelike thread neighbour (which stays healthy). Leaves the buffer empty on
  // failure; the caller handles that.
  async function refillRandomBuffer(): Promise<void> {
    const batch = await fetchDiscoverBatch();
    if (batch.length > 0) randomBufferRef.current.push(...batch);
  }

  function showHint(message: string) {
    setHint(message);
    window.setTimeout(() => setHint(null), 3000);
  }

  function goBack() {
    if (ended || busyRef.current) return;
    if (pos > 0) {
      setDir("back");
      setPos((p) => p - 1);
    }
  }

  function jumpTo(index: number) {
    if (ended || busyRef.current || index === pos) return;
    if (index < 0 || index >= history.length) return;
    setDir(index < pos ? "back" : "drift");
    setPos(index);
  }

  function onThread(thread: Thread) {
    if (ended || busyRef.current || !current) return;
    setFollowingLabel(thread.label);
    window.setTimeout(() => setFollowingLabel(null), 950);
    // A doorway (or any candidate in the other realm) crosses realms — the realm
    // then follows the landed card automatically; we just record where we came
    // from for the honest "Crossed to …" line + a distinct trail-map/atlas edge.
    const destRealm = realmOfSource(thread.candidate.source);
    const crossing = destRealm !== realm;
    pushStep(
      candidateToCard(thread.candidate),
      {
        type: "thread",
        label: thread.label,
        fromTitle: current.card.pageTitle,
        kind: thread.kind,
        ...(crossing ? { crossedFrom: realm } : {}),
      },
      "thread",
    );
  }

  // Keep latest handlers reachable from the stable keydown listener.
  const advanceRef = useRef(advance);
  const backRef = useRef(goBack);
  const keyExtrasRef = useRef<{ pull: (i: number) => void; escape: () => void }>(
    { pull: () => {}, escape: () => {} },
  );
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
    if (busyRef.current || now - fireTsRef.current < 280) return;
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
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    const deltaX = e.changedTouches[0].clientX - start.x;
    const deltaY = start.y - e.changedTouches[0].clientY;
    // Axis-lock: a clearly-horizontal swipe crosses realms; otherwise it's the
    // vertical read/advance gesture. Never both.
    if (resolveHorizontalSwipe({ deltaX, deltaY }) === "cross") {
      crossRealm();
      return;
    }
    const action = resolveSwipe({
      deltaY,
      insideRegion: start.insideRegion,
      atTopStart: start.atTop,
      atBottomStart: start.atBottom,
    });
    if (action === "advance") advance();
    else if (action === "back") goBack();
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-paper"
      data-realm={realm}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <FeedTopBar
        steps={history}
        pos={pos}
        stops={history.length}
        realm={{ label: realmMeta.label, glyph: realmMeta.glyph }}
        otherRealm={{
          id: otherRealmMeta.id,
          label: otherRealmMeta.label,
          glyph: otherRealmMeta.glyph,
        }}
        onCrossRealm={crossRealm}
        endless={endless}
        onJump={jumpTo}
        onEnd={endSession}
      />

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
              key={current.card.pageTitle}
              custom={dir}
              variants={cardVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={spring}
              className="absolute inset-0 px-4 pb-safe sm:px-6"
            >
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
                onShare={
                  cloudConfigured && user
                    ? () => setShareCard(current.card)
                    : undefined
                }
              />
            </motion.div>
          </AnimatePresence>
        )}

        {followingLabel && (
          <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex justify-center">
            <span className="rounded-full bg-ink/85 px-4 py-2 text-sm font-medium text-paper shadow-lg">
              Following: {followingLabel}…
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
          <ShareToFriend
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
                    onClick={endSession}
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
          canGoBack={pos > 0}
          viewingBack={pos < history.length - 1}
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
            onSaved={(t) => {
              sessionTrailRef.current = t;
            }}
            onClose={() => setEnded(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// "End & view trail" → the trail map. The reward for stopping: your journey drawn
// as a meandering spine, with an editable name, stats, and save / like (M4).
// Export + copy-as-text arrive in M5.
function EndOverlay({
  history,
  realm,
  existing,
  onSaved,
  onClose,
}: {
  history: TrailStep[];
  realm: RealmId;
  existing: SessionTrail | null;
  onSaved: (t: SessionTrail) => void;
  onClose: () => void;
}) {
  const stats = computeTrailStats(history);
  const statLine = [
    `${stats.stops} ${stats.stops === 1 ? "stop" : "stops"}`,
    formatDuration(stats.durationMs),
    `${stats.threadsPulled} ${stats.threadsPulled === 1 ? "thread" : "threads"} pulled`,
  ].join(" · ");

  const [name, setName] = useState(existing?.name ?? autoTrailName(history));
  const [liked, setLiked] = useState(existing?.liked ?? false);
  // The persisted trail once saved — kept in sync so post-save rename/like edits
  // can't be clobbered by a later re-save in the same session.
  const [saved, setSaved] = useState<SessionTrail | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  async function handleExport() {
    if (!mapRef.current) return;
    const fname = (name.trim() || "drift-trail").slice(0, 48);
    try {
      await exportTrailPng(mapRef.current, `${fname}.png`);
    } catch {
      /* export failed — non-fatal, never crashes the app */
    }
  }

  async function handleCopy() {
    const text = trailToText({
      id: saved?.id ?? "trail",
      name: name.trim() || autoTrailName(history),
      steps: history,
      createdAt: existing?.createdAt ?? saved?.createdAt ?? 0,
      liked,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — non-fatal */
    }
  }

  async function handleSave() {
    setBusy(true);
    const t: SessionTrail = {
      id: saved?.id ?? existing?.id ?? crypto.randomUUID(),
      name: name.trim() || autoTrailName(history),
      liked,
      // Preserve the original creation date when updating an existing trail.
      createdAt: existing?.createdAt ?? saved?.createdAt ?? Date.now(),
    };
    try {
      await saveTrail({ ...t, steps: history, realm });
      persistSeen(history.map((s) => cardId(s.card)));
      setName(t.name);
      setSaved(t);
      onSaved(t);
    } finally {
      setBusy(false);
    }
  }

  function commitRename() {
    const finalName = name.trim() || autoTrailName(history);
    setName(finalName);
    if (saved) {
      const t = { ...saved, name: finalName };
      setSaved(t);
      onSaved(t);
      renameTrail(t.id, finalName);
    }
  }

  function toggleLike() {
    const next = !liked;
    setLiked(next);
    if (saved) {
      const t = { ...saved, liked: next };
      setSaved(t);
      onSaved(t);
      setTrailLiked(t.id, next);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-2xl bg-paper-raised shadow-xl ring-1 ring-line"
      >
        <div className="shrink-0 border-b border-line px-6 pb-4 pt-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
            Your trail
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            aria-label="Trail name"
            className="mt-1 w-full rounded-lg bg-transparent text-center font-serif text-2xl leading-tight text-ink outline-none transition focus:bg-paper focus:ring-1 focus:ring-accent/40 sm:text-3xl"
          />
          <p className="mt-1.5 text-sm text-ink-soft">{statLine}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <TrailMap steps={history} mapRef={mapRef} />
        </div>

        <div className="flex shrink-0 items-center justify-center gap-5 border-t border-line px-6 py-2.5 text-sm">
          <button
            type="button"
            onClick={handleExport}
            className="text-ink-soft transition hover:text-accent-strong"
          >
            Export image
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="text-ink-soft transition hover:text-accent-strong"
          >
            {copied ? "Copied ✓" : "Copy as text"}
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line bg-paper-raised px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Keep drifting
          </button>

          {saved ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleLike}
                aria-label={liked ? "Unlike trail" : "Like trail"}
                aria-pressed={liked}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-accent-strong transition hover:border-accent/50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
                </svg>
              </button>
              <Link
                href={`/trails/${saved.id}`}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
              >
                View in My Trails →
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || history.length === 0}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save trail"}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
