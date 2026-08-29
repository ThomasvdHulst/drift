"use client";

// ---------------------------------------------------------------------------
// The drift session engine.
//
// Everything a reading session IS, with nothing about how it is drawn: the seed
// it started from, the trail it has grown, the focus steering it, the buffers
// and pools it is served out of, the threads on the card you are looking at,
// the doors you left behind, the meter, and every move you can make.
//
// WHY IT LIVES APART FROM THE FEED. It was extracted (Phase 1 of the
// continuous-feed work) when there were two ways to render a session and they
// differed ONLY in how a card gets on screen; everything above is identical, and
// it is also the subtlest code in the app — the session-restart guard, the
// branch model, the focus stack, the upstream budget. Two copies of that would
// have diverged, and the divergence would have shown up as a bug in one feed
// that was impossible to reproduce in the other.
//
// ⚠️ THERE IS ONLY ONE SHELL NOW (Phase 7 retired the card-at-a-time feed) AND
// THE SEPARATION STILL EARNS ITS KEEP, for a different reason: the rule "if it
// decides WHAT the reader sees it belongs here, if it decides HOW it appears it
// belongs in the shell" is what keeps 2,500 lines of session logic out of a file
// that also has to think about scroll offsets and an IntersectionObserver. Do
// not fold them back together.
//
// The extraction was deliberately behaviour-neutral — no logic was changed, only
// moved — so that any later misbehaviour is known to be new.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  ArrivedVia,
  Card,
  Door,
  RelatedCandidate,
  Thread,
  TrailStep,
} from "@/lib/types";
import {
  doorArrival,
  doorsFrom,
  engagedWith,
  parseDoorParam,
  parseStopParam,
  type OpenDoor,
} from "@/lib/doors";
import { childrenOf, parentOf, pathTo, tipOf } from "@/lib/branch";
import { candidateToCard } from "@/lib/wiki";
import { cardId } from "@/lib/card";
import { selectDiverseThreads, selectFacetThreads } from "@/lib/diversity";
import { classifyThreads, threadsNotInTrail } from "@/lib/threads";
import { pickDriftNext, pickRandomThread } from "@/lib/drift";
import { randomOffset, interleave } from "@/lib/discover";
import { servableCount, takeServable } from "@/lib/lookahead";
import { applyFeedback, type Interest, type Reaction } from "@/lib/interest";
import {
  focusStackFromParams,
  focusBucket,
  focusRealm,
  focusForRealm,
  focusUnder,
  bannerFocus,
  pushFocus,
  releaseFocusIn,
  writeFocusParams,
  sessionKey,
  type Focus,
} from "@/lib/focus";
import {
  artistRingLabel,
  describeArtistRing,
  nextArtistRing,
  type MetArtistProfile,
  type MetArtistRing,
} from "@/lib/realms/met.artist";
import {
  initOrbit,
  nextToExpand,
  ingestMorelike,
  takeFromPool,
  proximityWord,
  type OrbitState,
  type OrbitCard,
} from "@/lib/orbit";
import { getRealm, discoverUrl, relatedUrl, doorwayUrl, summaryUrl } from "@/lib/realms";
import type { RealmId } from "@/lib/realms/types";
import { realmOfSource } from "@/lib/crossrealm";
import { computeTrailStats } from "@/lib/stats";
import {
  getTrail,
  loadSeen,
  persistSeen,
  recordSession,
  getInterest,
  setInterest,
  getReactions,
  setReaction,
  getCachedTopics,
  cacheTopics,
  getSettings,
} from "@/lib/storage";
import type { Way } from "@/components/CardView";
import { useAuth } from "@/components/AuthProvider";
import { useTour } from "@/components/tour/TourProvider";
import { adsConfig } from "@/lib/ads";
import {
  primeMeter,
  recordStop,
  refreshStatus,
  subscribeMeter,
} from "@/lib/billing/meter";
import { dailyLimit, limitReached, type MeterState } from "@/lib/limits";

/** Which KIND of move put a card in the trail.
 *
 *  ⚠️ IT IS NOT A DIRECTION ANY MORE, WHATEVER THE NAME SAYS. It used to drive
 *  the card-at-a-time feed's transition (slide up, slide sideways, slide back)
 *  and was state on the engine for that reason. The scroller has no transition
 *  to run, so the state is gone — but the value still does one load-bearing job
 *  inside `pushStep`: it tells the guided tour which real action just happened
 *  (`tourSignal("drifted" | "threaded" | "crossed")`), which is what its forced
 *  steps advance on. Delete it and the tour stops at "Pull a thread". */
export type Dir = "drift" | "thread" | "back" | "cross";

// A random-drift card waiting in the buffer, tagged with the topic it came from
// (interesting-random, M8) and why that topic was chosen (M9). topic/reason are
// absent for cards from the plain-random fallback.
type BufferedCard = {
  card: Card;
  topic?: { id: string; label: string };
  reason?: "interest" | "wildcard" | "field" | "orbit" | "form" | "artist";
};

// One article from an "in the news" section (Phase 23), with how recently it was
// linked from a news story. Matches /api/wiki/current's response shape.
type CurrentCard = { card: Card; daysAgo: number };

// How many news articles to pull per page of the pool. The Action API caps
// extracts at 20 per request, and a page this size keeps a drift instant.
const CURRENT_PAGE = 12;
// How many pages of the ranked pool to walk on the INITIAL load looking for an
// UNSEEN article before concluding you're caught up. Re-entering a section you've
// drifted deep into, the top of the pool is all in `seen`, so we page past it
// instead of wrongly reporting a load error. ~8×12 ranked slots is far more than a
// calm session covers, and it bounds the work when a heavy reader has seen most of it.
const CURRENT_MAX_PAGES = 8;
// Per-drift paging is kept small: the offset persists across drifts, so a caught-up
// section climbs toward the pool's end a little each drift (widening fills the gap)
// instead of stalling on a long multi-fetch spinner every single drift.
const CURRENT_DRIFT_PAGES = 2;


// Enough of a saved trail to update it in place (preserving id/name/like/date).
export type SessionTrail = {
  id: string;
  name: string;
  liked: boolean;
  createdAt: number;
};

// The free daily allowance (Phase 32), read once from the statically-inlined
// NEXT_PUBLIC_ var. `null` means no limit at all, which is both the default and
// the measure-first state: every stop is still counted, nobody is ever stopped.
//
// Note how this relates to NUDGE_AT above and does NOT replace it. The nudge is
// an invitation at 25 stops that can be waved away; the allowance is where the
// day actually closes. If a limit is ever set below the nudge the two would
// collide, which is a reason to keep it comfortably above 25.
export const FREE_DAILY_STOPS = dailyLimit();

// Ads config (Phase 21) — read once from statically-inlined NEXT_PUBLIC_* env.
// OFF by default: when disabled nothing below runs (no ad card, no counter effect).
export const ADS = adsConfig();

// A buffer refill pulls this many topics and this many cards per topic, then
// interleaves them — so the random-drift buffer holds a mix of a few topics at a
// time (variety) and rotates to fresh topics once drained. Kept small on purpose:
// a large buffer would keep a session stuck on the same 1–2 topics for dozens of
// stops. The search endpoint isn't burst-limited, so refilling often is cheap.
const REFILL_TOPICS = 3;
const DISCOVER_LIMIT = 4;
// Top the buffer up in the BACKGROUND once it holds fewer servable cards than
// this. Refilling only on empty (what it used to do) meant one drift in twelve
// waited under the busy lock while three discover calls came back. Same total
// upstream volume — a refill still yields up to REFILL_TOPICS × DISCOVER_LIMIT —
// in smaller, more frequent bursts, which is what a bucket-shaped limiter
// prefers (CLAUDE.md §4, the Met gate's rolling budget).
const REFILL_LOW_WATER = 3;
// How long a card must hold the screen before the feed prepares the NEXT one.
//
// ⚠️ Read CLAUDE.md §2.2 before changing this. Preparing one card ahead is what
// that principle permits; preparing several is what it forbids, and this timer
// is also the thing that keeps the cost honest. Work started here is WASTED
// How far down a bucket's ranking a SECOND-try refill may sample. The ordinary
// window is the top ~400 pages (lib/discover.ts `randomOffset`), which keeps
// drifted cards recognizable; a long session confined to one field can read that
// stretch dry, and then every card in a refill is already seen. Reaching deeper
// once beats telling the reader a 30,000-page field is empty. 1000 is the ceiling
// the discover route accepts.
const DEEP_OFFSET_MAX = 1000;

// The card's inner scroll region under a wheel/touch event target, or null if the
// gesture began outside it (the threads bar, the desktop image panel, gaps). The

export function useDriftSession() {
  const { user } = useAuth();
  // WHICH session the URL is asking for. The feed follows this, not its own
  // mount: see `sessionKey` in lib/focus.ts for the bug that motivated it.
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const paramKey = sessionKey(searchParams);
  // The guided tour listens for real actions on this page (Phase 20). Each call
  // is a no-op unless the tour is active and waiting on that event. `holdNav` is
  // true while the user is "looking around" in the tour: navigation is frozen so
  // they can read without drifting off the card they're studying.
  const { signal: tourSignal, holdNav, active: tourActive } = useTour();
  // The trail is a TREE (Phase 29), held flat with parent pointers — see
  // lib/branch.ts. `pos` is still the step on screen; `tip` is the far end of
  // the branch being read, and the two together give the line you are on
  // (`path`). Everything that used to be `pos ± 1` now walks that line, because
  // once a trail forks, "the step before this one" is a question about the tree
  // and not about the array.
  const [history, setHistory] = useState<TrailStep[]>([]);
  const [pos, setPos] = useState(0);
  const [tip, setTip] = useState(0);
  const [threadCache, setThreadCache] = useState<Record<string, Thread[]>>({});
  // The transient "you are moving" toast. It carries WHETHER the move forked
  // (Phase 30), because a thread pulled from a stop you already left starts a
  // new line, and until now the only place that was ever said was the exit
  // screen, minutes later.
  const [following, setFollowing] = useState<{
    label: string;
    branch: boolean;
  } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  // "Just drift" mode (?mode=endless): the trail framing is removed (no rail, no
  // save prompt, a gentle pause nudge instead). History still accrues in memory,
  // so the quiet "Keep this trail" escape hatch can save it if you decide to.
  const [endless, setEndless] = useState(false);
  // Snapshot of this session's saved-trail meta, captured (from a ref) when the
  // end screen opens — reading the ref here rather than during render.
  const [endExisting, setEndExisting] = useState<SessionTrail | null>(null);
  const [advancing, setAdvancing] = useState(false);
  // Where this reader stands against the daily allowance (Phase 32). `null` means
  // "we could not look" — signed out, no backend, or the request failed — and the
  // feed treats that exactly like an unmetered reader. The meter FAILS OPEN.
  const [meter, setMeter] = useState<MeterState | null>(null);
  // Why the session ended: the reader chose to (the normal case), or the day's
  // allowance ran out. Only the wording and the offered continuations differ.
  const [endReason, setEndReason] = useState<"user" | "limit">("user");
  // Opened the feed with the day already spent, so there is no session and no
  // trail to show. Distinct from `ended`, which always has a trail behind it.
  const [dayDone, setDayDone] = useState(false);
  // Who is reading, reachable from the session-load effect without making the
  // user object one of its dependencies (that effect restarts a session, and it
  // must key off the URL alone). Same trick as `realmRef` below.
  const userIdRef = useRef<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-cardId thumbs up/down (drives the button state on each card). The interest weights
  // themselves live in a ref (in-memory truth, persisted on change).
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  // The realm FOLLOWS the displayed card (Phase 15): a trail can now span both
  // realms (cross via a doorway or a horizontal swipe), so "which realm am I in"
  // is derived from the current card's source, not fixed for the session. This
  // `initialRealm` is only the pre-first-card fallback (set from ?realm= / a
  // continued trail). `realm` (derived below) + `realmRef` are the live values.
  const [initialRealm, setInitialRealm] = useState<RealmId>("encyclopedia");
  const realmRef = useRef<RealmId>("encyclopedia");
  // A "focused drift" (Phase 18): confine drift to a field or spiral out from a
  // seed. Held as a STACK, because a focus is bound to one realm and can hold a
  // narrower focus inside it (lib/focus.ts explains why both were needed). The
  // state drives the banner; the ref is the live truth read by the buffer refill
  // + gesture handlers. Set from URL params on load, or mid-session via "Drift
  // around this" / released via the banner.
  const [focusStack, setFocusStack] = useState<Focus[]>([]);
  const focusStackRef = useRef<Focus[]>([]);
  focusStackRef.current = focusStack;
  /** The focus steering `rid`'s passive drift right now, or null. Async handlers
   *  read this rather than a single "current focus", so a crossing that is still
   *  in flight already asks about the realm it is landing in. */
  function focusIn(rid: RealmId): Focus | null {
    return focusForRealm(focusStackRef.current, rid);
  }
  /** Set the stack in one place, so the ref (read by in-flight fetches) can never
   *  lag the state (read by the banner). */
  function applyFocusStack(next: Focus[]) {
    focusStackRef.current = next;
    setFocusStack(next);
  }
  // The live orbit engine (Phase 18, page-orbit focus): a widening BFS
  // neighbourhood of the seed, served lowest-ring-first. Null unless orbiting.
  // Phase 23 reuses it for the widening half of an "in the news" drift, seeded
  // with every news article the section served.
  const orbitRef = useRef<OrbitState | null>(null);
  // The "in the news" pool (Phase 23): cards fetched from /api/wiki/current,
  // best-first, plus how far we've paged through the section and which titles we
  // served (the seeds the orbit widens from once the pool runs dry).
  const currentBufferRef = useRef<CurrentCard[]>([]);
  const currentOffsetRef = useRef(0);
  const currentSeedsRef = useRef<string[]>([]);
  const currentDryRef = useRef(false);
  // Already-seen current articles, kept in ranked order to gently re-show once the
  // section's fresh pool AND its neighbourhood are read dry — so an "in the news"
  // drift is never a broken button (the Phase 23 bug fix), only "you're caught up".
  const currentRevisitRef = useRef<CurrentCard[]>([]);
  // Have we surfaced the one-time "you're caught up" notice this session? The ref
  // guards the announcement; the state drives the persistent banner suffix.
  const caughtUpRef = useRef(false);
  const [caughtUp, setCaughtUp] = useState(false);
  // An artist drift (Phase 24 M-G3). The ring is how far we've had to widen out
  // of the artist's own work: 0 = their oeuvre, 1 = their movement, 2 = their
  // period and medium. Bumping it just swaps the discover bucket, so widening
  // needs no pool of its own (unlike an orbit). The ref is the live truth read
  // inside fetches; the state drives the banner. The profile (what the artist's
  // movement/period/medium actually ARE) is measured server-side once on entry.
  const artistRingRef = useRef<MetArtistRing>(0);
  const [artistRing, setMetArtistRing] = useState<MetArtistRing>(0);
  const artistProfileRef = useRef<MetArtistProfile | null>(null);
  // Ring 0 is finite and ordered, so it is paged through in sequence.
  const artistOffsetRef = useRef(0);

  const seenRef = useRef<Set<string>>(new Set());
  // The interest model (topic → weight) + whether personalization is on. Held in
  // refs so the buffer refill reads the latest without re-subscribing. Only the
  // random-drift topic pick uses these; threads are never personalized.
  const interestRef = useRef<Interest>({});
  const personalizeRef = useRef(true);
  const busyRef = useRef(false);
  // The active auto-dismiss timer for the transient hint toast, so a later hint
  // (e.g. the longer "caught up" notice) can't be cut short by an earlier timer.
  const hintTimerRef = useRef<number | undefined>(undefined);
  // A buffer of "interesting random" cards, tagged with their topic. Random
  // drifts are served from here; it's refilled reactively when it runs dry (via
  // the topic-discover endpoint) — deliberately NOT a continuously-topped-up
  // queue. See fetchDiscoverBatch / refillRandomBuffer.
  const randomBufferRef = useRef<BufferedCard[]>([]);
  // A background buffer top-up is in flight (see `topUpBuffer`). One at a time.
  const bgRefillRef = useRef(false);
  // Did the last attempt to find a card end because a source could not be
  // REACHED, rather than because it answered and had nothing?
  //
  // ⚠️ "EMPTY" AND "UNREACHABLE" ARE DIFFERENT ANSWERS AND THE FEED HAS TO SAY
  // SO. Every producer here returns `[]` / null for both — a pool genuinely read
  // to the end, and every request failing — and the continuous feed turned that
  // into "You have read this area dry", permanently, on a free drift over the
  // whole of Wikipedia (measured against a 503 upstream). A pool that is dry
  // stays dry; a source that is quiet comes back. So the attempt records which
  // it was, and lib/feedqueue's `terminusReason` picks the honest ending:
  // `source-quiet` retries with a doubling backoff, refuses the auto-snap and
  // offers "Try again"; `pool-dry` and `caught-up` are final and offer neither.
  //
  // ⚠️ THIS USED TO BE `discoverQuietRef`, WRITTEN BY THE DISCOVER PATH ALONE,
  // AND THE COMMENT HERE CLAIMED THE POOL-SERVED FOCUSES DID NOT NEED IT —
  // "orbit and 'in the news' reach their end through their own widening ladders
  // and are genuinely exhausted when they return nothing". They do not. Neither
  // `refillOrbit` nor `fetchCurrentPage` reported an unreachable source at all,
  // so the exact bug the flag exists to prevent was still live in both. Measured
  // 29 August 2026 on `/drift?focus=orbit&title=Octopus&seed=Octopus` with
  // `/api/realm/*/related` answering 503: `step:0 | terminus:pool-dry`, "You have
  // read this area dry", within six seconds, for an orbit that had produced zero
  // cards and with no "Try again" offered. The source was then restored and
  // FORTY-FIVE SECONDS AND ZERO API REQUESTS LATER it was still exactly that.
  //
  // THE CONTRACT, and it is what makes this robust to which fetch ran last:
  // `nextDriftCard` CLEARS it at the top of every attempt, and every producer
  // that fails to reach a source ORs it to true. Nobody clears it in the middle.
  // So one attempt that touched the news pool (unreachable) and then the orbit
  // ring (frontier genuinely exhausted) still ends up saying "quiet", which is
  // the honest answer: we never got to find out whether the section was read out.
  const upstreamQuietRef = useRef(false);
  // Threads currently being fetched, by card id — see `threadsFor`. This is what
  // stops a prepared card being fetched a second time by the reader arriving on
  // it before the preparation lands.
  const threadsInFlightRef = useRef<Map<string, Promise<Thread[]>>>(new Map());
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
  // The branch currently being read, root → tip, and where on it the reader is.
  // The rail, the back/forward moves and the "am I revisiting?" test all work in
  // these terms; `history` order is only ever the storage order.
  const path = pathTo(history, tip);
  const pathPos = Math.max(0, path.indexOf(pos));
  // Where on that line a fork happened: a step whose parent has other children,
  // and which is not the first of them. Given as positions along `path`, since
  // that is what the rail indexes by. The rail marks them so a branch is never
  // drawn as if it were simply the next stop along.
  // The tree, read once per render. The rail's fork ticks, the "ways from here"
  // switch and the "will this pull branch?" test all ask the same question of it,
  // and three separate traversals would be three chances to disagree.
  const kids = childrenOf(history);
  const branchAt = (() => {
    const marks = new Set<number>();
    path.forEach((i, k) => {
      const p = parentOf(history, i);
      if (p !== null && kids[p].length > 1 && kids[p][0] !== i) marks.add(k);
    });
    return marks;
  })();
  // The ways this stop was left (Phase 30). More than one means the reader is
  // standing on a fork and can step onto either line; the card renders nothing
  // for a single way, which is the ordinary case.
  /** The ways a given stop was left. More than one means the reader is standing
   *  on a fork and can step onto either line. */
  function waysFrom(index: number): Way[] {
    return (kids[index] ?? []).map((i) => ({
      index: i,
      title: history[i].card.displayTitle,
      onPath: path.includes(i),
    }));
  }
  // Realm follows the displayed card's source (so back-nav across a crossing shows
  // the right chrome/threads), falling back to the seed realm before the first
  // card. Mirrored into realmRef in render so async handlers/effects read the live
  // realm without a stale-closure race.
  const realm: RealmId = current ? realmOfSource(current.card.source) : initialRealm;
  realmRef.current = realm;
  userIdRef.current = user?.id ?? null;
  const realmMeta = getRealm(realm);
  // The realm a horizontal swipe / the top-bar control crosses INTO (two realms).
  const otherRealmMeta = getRealm(realm === "gallery" ? "encyclopedia" : "gallery");
  // Cross-realm is an Encyclopedia<->Gallery feature (Phase 15). Papers stays
  // self-contained for now (its cross-realm doorways arrive later), so it neither
  // offers the cross control nor reacts to a horizontal swipe.
  const canCross = realm === "encyclopedia" || realm === "gallery";
  // Crossing is ALWAYS available in those two realms, focused or not. It used to
  // be disabled while a focus was set ("a focus is a single-realm intent"), which
  // read as principled and behaved as a trap: threads stay free, so a doorway
  // thread could carry a focused drift into the other realm and then refuse to
  // let it back. A focus now suspends itself when you leave its realm and resumes
  // when you return (lib/focus.ts), which keeps the same intent without the cage.
  const crossEnabled = canCross;
  // The focus steering THIS realm's drift, if any (the stack may also hold one
  // waiting in the other realm — see `banner` below).
  const focus = focusForRealm(focusStack, realm);
  // Is the session orbiting the page this card shows? Drives the lit state of
  // the orbit control, so it reads as a toggle rather than a button that seems
  // to do nothing. Matched on the seed title, not merely "a focus exists": once
  // an orbit carries you to a neighbouring page, that page is not the centre and
  // its control should be unlit, so tapping it re-anchors here.
  const orbitingThisCard =
    focus?.kind === "orbit" && !!current &&
    focus.seedTitle === current.card.pageTitle;
  // The orbit banner's "how far from the seed" word: the seed is the center, an
  // orbit drift carries its ring, a thread mid-orbit has no defined distance.
  const orbitProx =
    focus?.kind === "orbit" && current
      ? current.arrivedVia.type === "seed"
        ? "the center"
        : current.arrivedVia.type === "drift" && current.arrivedVia.orbit
          ? proximityWord(current.arrivedVia.orbit.ring)
          : undefined
      : undefined;
  // An artist drift names where it has wandered to once it leaves the artist's
  // own work: "wandering wider · asian art, 18th century to 19th century".
  // Nothing at ring 0, where you are simply with the artist.
  const artistProx =
    focus?.kind === "artist" && artistProfileRef.current
      ? describeArtistRing(artistProfileRef.current, artistRing)
      : undefined;
  // What the banner shows, which is not always what is steering: a focus you
  // carried into the other realm is DORMANT there, and saying so is the whole
  // point (§2.1). Without it the pill would keep promising "Within Mathematics"
  // over a Gallery drift that is not in mathematics at all.
  const banner = bannerFocus(focusStack, realm);
  // Where letting go lands you: the broader focus this one was entered inside, or
  // nothing (a free drift). Names the release control, so the tap is never a
  // surprise.
  const bannerRealm = banner ? focusRealm(banner.focus) : realm;
  const revealed = banner ? focusUnder(focusStack, bannerRealm) : null;
  // The focus banner's trailing word: where a dormant focus resumes, an orbit's
  // distance, how far an artist drift has widened, or — for an "in the news"
  // drift you've read to the end — a persistent, honest "caught up" marker.
  const bannerSuffix = banner?.dormant
    ? `resumes in the ${getRealm(bannerRealm).label}`
    : (orbitProx ??
      artistProx ??
      (focus?.kind === "current" && caughtUp ? "caught up" : undefined));
  // The displayed card's app-wide id (thread cache key) and source-native id
  // (used to fetch related/summary). Distinct because two realms can share a
  // native title string.
  const displayedId = current ? cardId(current.card) : undefined;
  const displayedNative = current?.card.pageTitle;

  // Threads come from a per-card cache, so going back shows the same threads a
  // card had (fixing the "threads disappear on back" bug) and any viewed card
  // that isn't cached yet counts as still-loading.
  // The chips for the card on screen, minus anything this trail already holds.
  // The cache is built once per card, so a stop you come BACK to still offers
  // whatever you read after leaving it, and pulling that would fork to a page
  // already on the trail (lib/threads.ts). Costless on a forward walk, where
  // nothing can match.
  const threads = threadsNotInTrail(
    displayedId ? (threadCache[displayedId] ?? []) : [],
    history,
  );
  // The displayed card, mirrored to a ref so the (deferred) threads fetch can
  // classify it (Phase 6) without adding it to the effect deps. The abort on
  // navigation guarantees a resolved fetch still matches this card.
  const cardForThreadsRef = useRef<Card | undefined>(undefined);
  cardForThreadsRef.current = current?.card;
  // Mirrored for the prepare-next effect below, which must not restart its timer
  // every time a card's chips land. Same trick as `realmRef` and `focusStackRef`.
  const threadCacheRef = useRef<Record<string, Thread[]>>({});
  threadCacheRef.current = threadCache;
  // ----- the session the URL asks for -----
  //
  // Keyed on the params, NOT on the mount. This used to run once per mount and
  // read `window.location.search`, which assumed that arriving with new params
  // always means a fresh component. Whenever that assumption failed — a router
  // that reuses the page, a client restored from cache — picking a field or a
  // page to orbit did nothing at all: the previous drift simply carried on,
  // wandering wherever it liked, until the app was reloaded. That is exactly the
  // bug this fixes, and it also makes the intent honest: the feed shows the
  // session in the URL, and the URL is the only thing that decides.
  //
  // `appliedKeyRef` is what keeps that from being disruptive: the feed rewrites
  // its own URL when you anchor an orbit or let a focus go (see below), and those
  // rewrites must not restart the session the reader is in the middle of.
  const appliedKeyRef = useRef<string | null>(null);
  // The in-flight seed load, held in a REF rather than only in the effect's
  // closure, so that a second entry into this effect for the SAME session can
  // re-adopt it. That combination is the whole point:
  //
  //   React re-runs an effect by calling its cleanup and then the effect again.
  //   In development it does that once on mount by design (StrictMode), which
  //   here meant: run 1 claims the key and starts loading → cleanup cancels it →
  //   run 2 sees its own key already applied and returns. Nothing was left to
  //   finish the load, so `initialLoading` never cleared and the feed sat on
  //   "Finding a starting point…" forever. Reloading the page appeared to fix it
  //   because a hydration mount is not double-invoked, which is exactly why this
  //   only ever bit a click-through from the homepage.
  //
  // So the guard below un-cancels instead of walking away. A cleanup with no
  // successor is still a real teardown (leaving /drift mid-load), and that one
  // still cancels — no stray fetches, no `persistSeen` for a card nobody saw.
  // The daily meter (Phase 32): ask once where the reader stands, then follow the
  // module's own updates (recordStop reconciles with the server's count, which is
  // the one that has seen every device). Subscribe BEFORE the fetch so the first
  // answer cannot land in the gap.
  useEffect(() => {
    const unsubscribe = subscribeMeter(setMeter);
    void refreshStatus();
    return unsubscribe;
  }, []);

  const loadRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  useEffect(() => {
    if (appliedKeyRef.current === paramKey) {
      loadRef.current.cancelled = false; // re-adopt (see above); no-op once loaded
      return; // same session; nothing else to do
    }
    const restarting = appliedKeyRef.current !== null;
    appliedKeyRef.current = paramKey;

    // The day's allowance, decided BEFORE a seed is fetched (Phase 32).
    //
    // `primeMeter` reads this device's mirror synchronously, which is the whole
    // reason it exists: waiting for the round trip would hand a spent reader one
    // more card every time they opened the feed, and since a fresh session is a
    // page navigation away that would be farmable a card at a time. Unknown means
    // carry on — the meter fails open.
    const uid = userIdRef.current;
    const primed = uid ? primeMeter(uid) : null;
    if (primed && limitReached(primed, FREE_DAILY_STOPS)) {
      setDayDone(true);
      setInitialLoading(false);
      return;
    }
    setDayDone(false);

    const load = { cancelled: false };
    loadRef.current = load;
    (async () => {
      const params = new URLSearchParams(paramsString);
      // Arriving at a DIFFERENT session in the same component: put the feed back
      // to the state a fresh mount would have, or the new drift would inherit the
      // old one's cards, buffers and trail. `seenRef` is kept on purpose — not
      // repeating yourself is a property of the reader, not of the session.
      if (restarting) {
        setHistory([]);
        setPos(0);
        setTip(0);
        setEnded(false);
        setError(null);
        setInitialLoading(true);
        setFocusStack([]);
        setCaughtUp(false);
        setEndless(false);
        setMetArtistRing(0);
        focusStackRef.current = [];
        orbitRef.current = null;
        randomBufferRef.current = [];
        currentBufferRef.current = [];
        currentSeedsRef.current = [];
        currentRevisitRef.current = [];
        currentOffsetRef.current = 0;
        currentDryRef.current = false;
        caughtUpRef.current = false;
        artistProfileRef.current = null;
        artistRingRef.current = 0;
        artistOffsetRef.current = 0;
        sessionTrailRef.current = null;
        sessionIdRef.current = ""; // a new session id is minted below
      }
      const title = params.get("title");
      const seed = params.get("seed");
      const continueId = params.get("continue");
      const realmParam = params.get("realm");
      const bucketParam = params.get("bucket");
      // "Just drift" (endless) comes from the homepage toggle; a continued trail
      // always keeps its trail (that branch returns before we set endless).
      const wantEndless = params.get("mode") === "endless";
      // A focused drift (Phase 18): field (stay in one topic) or orbit (spiral
      // out from a seed), plus whatever broader focus it was entered inside
      // (`under`), so a reload resumes the nesting rather than flattening it.
      // Validated → an unknown/injected field bucket yields no focus. Applied
      // only on a fresh session (a continued trail returns first).
      const parsedStack = focusStackFromParams(params);
      const parsedFocus = parsedStack[parsedStack.length - 1] ?? null;
      focusStackRef.current = parsedStack;
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
          if (!load.cancelled) setReactions(await getReactions());
        } catch {
          /* no reactions yet */
        }
        if (load.cancelled) return;

        // Continue a saved trail: rehydrate its steps and resume at the last one
        // — or, with `?door=<stop>.<door>`, resume it on a BRANCH through one of
        // the doors it left open (Phase 29), so a door on a saved trail rejoins
        // that trail instead of starting an unrelated drift.
        if (continueId) {
          const trail = await getTrail(continueId);
          if (load.cancelled) return;
          if (trail && trail.steps.length > 0) {
            const trealm = getRealm(trail.realm).id;
            realmRef.current = trealm;
            setInitialRealm(trealm);
            sessionTrailRef.current = {
              id: trail.id,
              name: trail.name,
              liked: trail.liked,
              createdAt: trail.createdAt,
            };
            const steps = await withDoorBranch(trail.steps, params.get("door"));
            if (load.cancelled) return;
            steps.forEach((s) => seenRef.current.add(cardId(s.card)));
            // Only the branch step is new, and only it needs remembering; the
            // trail's own stops were persisted when it was saved.
            if (steps.length > trail.steps.length) {
              persistSeen([cardId(steps[steps.length - 1].card)]);
            }
            setHistory(steps);
            // Where to stand. By default the trail's tip, which is where you
            // left it; with `?from=<stop>` (Phase 30), the stop named, so an old
            // trail can grow a new line from ANYWHERE rather than only from its
            // end or through a door it happened to record. `tip` comes from
            // `tipOf` and never from `steps.length - 1`, which after a fork is
            // whichever branch was made last and may not pass through `from` at
            // all. A junk or out-of-range stop resumes the trail, the same way a
            // broken door does.
            const from = parseStopParam(params.get("from"));
            const at =
              from !== null && from < steps.length ? from : steps.length - 1;
            setPos(at);
            setTip(tipOf(steps, at));
            return;
          }
        }

        // An artist drift (Phase 24 M-G3) measures the artist up front, so the
        // feed knows which widening rings exist before it needs one. Best-effort:
        // no profile just means we serve their own work and cannot widen, which
        // is exactly the right degradation (§4).
        if (parsedFocus?.kind === "artist") {
          artistRingRef.current = 0;
          artistOffsetRef.current = 0;
          try {
            const res = await fetch(
              `/api/realm/gallery/artists?name=${encodeURIComponent(parsedFocus.artistName)}`,
              { signal: AbortSignal.timeout(6000) },
            );
            const p = (await res.json()) as MetArtistProfile | null;
            if (res.ok && p && typeof p.works === "number") {
              artistProfileRef.current = p;
            }
          } catch {
            /* profile is optional; the oeuvre still drifts */
          }
        }

        let card: Card | undefined;
        if (parsedFocus?.kind === "current") {
          // An "in the news" drift (Phase 23): open on the best-ranked UNSEEN
          // article and buffer the rest, so the opening drifts are instant and stay
          // on the current stories. Re-entering a section you've drifted before, the
          // top of the ranked pool is all in `seen`, so page deeper to find an unseen
          // card instead of wrongly reporting a load error (the bug this fixes).
          const section = parsedFocus.section;
          for (let guard = 0; guard < CURRENT_MAX_PAGES && !card; guard++) {
            const { fresh, status } = await fetchCurrentPage(section);
            if (fresh.length > 0) {
              card = fresh[0].card;
              currentBufferRef.current.push(...fresh.slice(1));
            } else if (status !== "ok") {
              break; // end of the ranked pool, or a transient fetch error
            }
          }
          // Whole section already read: don't dead-end. Open on the best story you've
          // seen and flag "caught up" (the drift loop keeps the section wandering).
          if (!card) {
            const revisit = currentRevisitRef.current[0];
            if (!revisit) throw new Error("no card");
            card = revisit.card;
            enterCaughtUp();
          }
        } else if (title) {
          const res = await fetch(summaryUrl(realmRef.current, title));
          const c = (await res.json()) as Card;
          if (!res.ok || !c?.pageTitle) throw new Error("no card");
          card = c;
        } else if (bucketParam) {
          // Seed a bucket drift (Gallery/Papers seed tile, or a Phase 24 focus):
          // fetch that specific bucket's batch — first card is the starting
          // point, the rest seed the buffer so the first drifts stay on-theme and
          // instant.
          //
          // An artist's own work is a FINITE, ordered set, so it must be seeded
          // from the top: a themed bucket has hundreds of pages and a random
          // offset is variety, but Van Gogh has 18 works and offsets run to 400,
          // so a random one would land past the end and report a load error on
          // nearly every open.
          const SEED_LIMIT = 12;
          const artistSeed = parsedFocus?.kind === "artist";
          // One window can come back empty for reasons that have nothing to do
          // with the bucket being poor: every page in it already junk-filtered
          // away, or a moment of upstream throttling. Treating the first empty
          // answer as fatal is what made "drift within a field" report
          // "couldn't load" on a field that works perfectly a second later, so
          // try again before believing it.
          //
          // An artist seed retries the SAME window rather than a different one.
          // Those are two different things, and conflating them was a bug: an
          // oeuvre is a finite ordered set that must be read from the top, so
          // there is no other OFFSET worth trying — but re-asking for offset 0
          // is perfectly valid and is exactly what recovers from a moment of
          // upstream throttling. The Met throttles readily, so before this an
          // artist drift died on the first hiccup ("Couldn't load a card just
          // now") while every other seed quietly recovered.
          const SEED_TRIES = 3;
          let cards: Card[] = [];
          for (let attempt = 0; attempt < SEED_TRIES; attempt++) {
            // Give a throttled upstream a moment before asking again; retrying
            // instantly is the most likely way to be refused a second time.
            if (attempt > 0) {
              await new Promise((r) => setTimeout(r, 400 * attempt));
              if (load.cancelled) return;
            }
            const res = await fetch(
              discoverUrl(realmRef.current, {
                bucket: bucketParam,
                // The last try goes to the head of the bucket, which is always
                // well-formed: variety matters less than actually opening.
                // Aligned to the window we are asking for, so two readers who
                // land on the same stretch of a bucket share one upstream call
                // (see `randomOffset`).
                offset:
                  artistSeed || attempt === SEED_TRIES - 1
                    ? 0
                    : randomOffset(Math.random, 400, SEED_LIMIT),
                limit: SEED_LIMIT,
              }),
            );
            if (load.cancelled) return;
            const batch = (await res.json()) as Card[];
            if (res.ok && Array.isArray(batch) && batch.length > 0) {
              cards = batch;
              break;
            }
          }
          if (cards.length === 0) throw new Error("no card");
          card = cards[0];
          // The seed consumed the first page of the oeuvre; refills continue from
          // where it stopped rather than re-serving it.
          if (artistSeed) artistOffsetRef.current = SEED_LIMIT;
          // A bucket-pinned focus keeps the buffer on this bucket for the whole
          // session; use its friendly label and tag the drifts with its kind, so
          // the "why this card" line distinguishes a focused drift from a
          // Gallery/Papers one-off seed tile that merely started here.
          const pinnedFocus =
            parsedFocus?.kind === "field" ||
            parsedFocus?.kind === "form" ||
            parsedFocus?.kind === "artist"
              ? parsedFocus
              : null;
          const bLabel = pinnedFocus
            ? pinnedFocus.label
            : getRealm(realmRef.current).bucketLabel(bucketParam);
          randomBufferRef.current.push(
            ...cards.slice(1).map((c) => ({
              card: c,
              topic: { id: bucketParam, label: bLabel },
              ...(pinnedFocus ? { reason: pinnedFocus.kind } : {}),
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
        if (load.cancelled || !card) return;
        seenRef.current.add(cardId(card));
        persistSeen([cardId(card)]);
        if (wantEndless) setEndless(true);
        // Apply the focus. For an orbit, anchor on the *resolved* card (redirects
        // followed), so morelike queries use the canonical title, and start the
        // engine seeded at ring 0.
        if (parsedFocus) {
          const effectiveFocus: Focus =
            parsedFocus.kind === "orbit"
              ? {
                  kind: "orbit",
                  seedTitle: card.pageTitle,
                  seedLabel: card.displayTitle,
                }
              : parsedFocus;
          applyFocusStack([...parsedStack.slice(0, -1), effectiveFocus]);
          if (effectiveFocus.kind === "orbit") {
            orbitRef.current = initOrbit(card.pageTitle, card.displayTitle);
          }
        }
        const via: ArrivedVia = {
          type: "seed",
          seedName: seed ?? title ?? "Surprise me",
        };
        setHistory([
          { card, arrivedVia: via, timestamp: Date.now(), expanded: false },
        ]);
        setPos(0);
        setTip(0);
        // The seed is a stop like any other, and this is the one that does not
        // go through `pushStep` (which counts the rest). See the note there.
        recordStop();
      } catch {
        if (!load.cancelled)
          setError(
            "Couldn't load a card just now. Check your connection and try again.",
          );
      } finally {
        if (!load.cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      load.cancelled = true;
    };
    // `paramsString` is here so the values read above are the ones this render
    // actually holds; `paramKey` is what decides whether anything happens at all.
    //
    // ⚠️ THE SUPPRESSION IS DELIBERATE AND MUST STAY. The rule wants
    // `fetchDiscoverBatch` and `withDoorBranch` in here. Both are plain function
    // declarations in the component body, so they are NEW OBJECTS ON EVERY
    // RENDER and can never be stable: listing them would re-run this effect on
    // every render, and this is the effect that STARTS A SESSION — it would
    // reseed the trail, reset `history`, `pos` and `tip`, and call `recordStop`
    // again, continuously. Wrapping them in `useCallback` would not help either,
    // since they close over most of the feed's state. The effect is a one-shot
    // per session key, which is exactly what `paramKey` expresses.
    //
    // Disabled explicitly rather than left as a standing warning, so the lint
    // output is empty and the next real warning is not lost in the noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey, paramsString]);

  // ----- threads for one card -----
  /**
   * Fetch and choose the chips for a SINGLE card: in-realm threads plus a
   * cross-realm doorway (Phase 15), asked for together in one window. The
   * doorway is best-effort — `{}` on any miss means no doorway chip and the
   * in-realm threads are unaffected.
   *
   * Both callers come through here: the card on screen, and the one-card-ahead
   * preparation below. That is the point of extracting it — the chips a card
   * gets must not depend on WHEN they were fetched, and two copies of this
   * selection logic would eventually disagree. Same reasoning that put the Met's
   * parameter ordering inside `searchIds` and both walked-door paths through
   * `doorArrival`.
   *
   * Stable (`useCallback` with no deps): everything it closes over is either a
   * module import or a ref, and the threads effect lists it as a dependency.
   *
   * ⚠️ IT NO LONGER TAKES AN AbortSignal, AND THAT IS A FIX RATHER THAN A LOSS.
   * The on-screen effect used to abort this on cleanup "to dodge 429s", but the
   * abort never cancelled anything upstream: our API routes do not forward
   * `request.signal`, so the Wikimedia and Met calls behind them ran to
   * completion whether the browser was still listening or not. All it actually
   * did was throw away an answer we had already paid for. Duplicate work is now
   * prevented properly, one layer up, by `threadsFor` — which also handles the
   * StrictMode double-invoke that the abort was the other half of.
   */
  const fetchThreadsFor = useCallback(
    async (
      card: Card | undefined,
      native: string,
      rid: RealmId,
    ): Promise<Thread[]> => {
      const [cands, door] = await Promise.all([
        fetch(relatedUrl(rid, native))
          .then((r) => r.json())
          .catch(() => []),
        fetch(doorwayUrl(rid, native))
          .then((r) => r.json())
          .catch(() => ({})),
      ]);
      const rm = getRealm(rid);
      let chosen: Thread[] = [];
      if (Array.isArray(cands)) {
        if (rm.threadMode === "facet") {
          chosen = selectFacetThreads(cands, { count: 3, seen: seenRef.current });
        } else if (card && card.pageTitle === native) {
          // Encyclopedia: classify into directional threads (Phase 6).
          chosen = classifyThreads(card, cands, { count: 3, seen: seenRef.current });
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
      return chosen;
    },
    [],
  );

  /**
   * The same fetch, but at most ONE in flight per card.
   *
   * ⚠️ THIS IS WHAT MAKES PREPARING A CARD AHEAD FREE INSTEAD OF WASTEFUL, and
   * it was found by measuring rather than by reading. Preparation gives the next
   * card's chips a head start, but a reader who moves on before it lands used to
   * arrive and start a SECOND identical request: measured over 13 cards, 14
   * `/related` and 15 `/doorway` where 12 and 12 were needed. Arriving mid-flight
   * now adopts the request already running, so a card costs exactly one lookup
   * whether it was prepared, arrived at, or both.
   *
   * It also subsumes the reason the old code aborted on cleanup: React's
   * StrictMode double-invoke in development now adopts its own first call
   * instead of racing it.
   */
  const threadsFor = useCallback(
    (
      card: Card | undefined,
      native: string,
      rid: RealmId,
      id: string,
    ): Promise<Thread[]> => {
      const running = threadsInFlightRef.current.get(id);
      if (running) return running;
      const p = fetchThreadsFor(card, native, rid).finally(() => {
        threadsInFlightRef.current.delete(id);
      });
      threadsInFlightRef.current.set(id, p);
      return p;
    },
    [fetchThreadsFor],
  );

  // ----- threads for whichever card is displayed (live or a revisited one) -----
  useEffect(() => {
    if (!displayedId || !displayedNative || displayedId in threadCache) return;
    let live = true;
    threadsFor(
      cardForThreadsRef.current,
      displayedNative,
      realmRef.current,
      displayedId,
    )
      .then((chosen) => {
        if (live) setThreadCache((c) => ({ ...c, [displayedId]: chosen }));
      })
      .catch(() => {
        // An empty list is what "we looked and found nothing" has always looked
        // like here, and it stops the chips spinning forever.
        if (live) setThreadCache((c) => ({ ...c, [displayedId]: [] }));
      });
    return () => {
      live = false;
    };
  }, [displayedId, displayedNative, threadCache, threadsFor]);

  // ----- ⚠️ THERE WAS A SECOND, DEEPER LOOKAHEAD HERE AND IT AIMED AT THE
  // WRONG CARD -----
  //
  // Phase 0 added "prepare the NEXT card, exactly one ahead": after 1.2 s on a
  // card it fetched the threads and the doorway for `peekServable(randomBuffer)`
  // and warmed that card's picture. In the CARD-AT-A-TIME feed the buffer's head
  // genuinely was the next card, so the name was true and the effect was worth
  // its cost: the chips were the whole wait (3,347 ms median in the Encyclopedia
  // against a local build with no CDN) and the picture already was not.
  //
  // The scroller made both halves wrong.
  //
  //   • THE PICTURE. Cards are RENDERED three ahead now, and a rendered card
  //     loads its own hotlinked preview immediately whether or not it is inside
  //     the heavy-image window. Warming an unrendered one bought nothing.
  //   • THE CHIPS, and this is the one that mattered. `fill` takes cards OUT of
  //     the buffer to materialise them, so the buffer's head is no longer the
  //     next card — it is the one after the whole queue, QUEUE_AHEAD + 1 = FOUR
  //     cards below the reader. Measured 29 August 2026, Encyclopedia, 2.6 s
  //     dwell: with the queue holding `Mach number | Human sexuality | La Scala`
  //     the only `/related` of that stop was for `Aerobatics`, which was in
  //     neither the trail nor the queue and became queue[2] one commit later.
  //     So "at most one ahead" — invariant 6, CLAUDE.md §12, drift-spec.md §7 and
  //     docs/beta-readiness.md, the rule §7.2 calls the one way to genuinely
  //     break this app — was false of the code that implemented it.
  //
  // It is gone rather than re-aimed, because re-aiming it at the queue's head
  // makes it a slower duplicate of the scroller's own lookahead
  // (ContinuousFeed.tsx, "threads: the active card, and exactly one ahead"),
  // which is better placed anyway: the head is KNOWN the instant the card above
  // it commits, so the fetch starts then, with a whole dwell of lead, where this
  // one waited 1.2 s and then guessed at a card four rows down.
  //
  // ⚠️ MEASURED BOTH WAYS, AND IT IS NOT FREE — the honest numbers, because the
  // next person will want them before they change this again. Ten stops,
  // Encyclopedia, local production build (no CDN, so the worst case; in
  // production `related` and `doorway` both carry `s-maxage=86400`):
  //
  //                                    with it        without it
  //   dwell 2,600 ms  chips ready       9/10           9/10      (median 0 ms)
  //   dwell 1,200 ms  chips ready       6-7/10         4/10      (median 618 ms)
  //   per committed card                1.00-1.18      0.91      `/related`
  //
  // So at a reading pace there is no difference at all, and at a SKIMMING pace
  // (1.2 s a card, half what `verify:feed` calls a reader's pace and a third of
  // the 4 s `docs/continuous-feed.md` measured against) the chips arrive a few
  // hundred ms after the card instead of with it. That was judged the right
  // trade: the card itself — title, description, extract, picture — is already
  // rendered and unaffected, it is only the chips that fill in; the reader who is
  // moving that fast is not pulling threads; and the deep lookahead was spending
  // the SHARED upstream budget (the Met's ~80-per-30-seconds bucket, CLAUDE.md
  // §4) on cards a skimmer never reaches.
  //
  // If that trade is ever revisited, the option to weigh is fetching for the
  // queue's SECOND card as well as its head — bounded by the queue, unlike this
  // effect, and in STEADY STATE it costs nothing extra (each commit still admits
  // exactly one new card to fetch for; only the session's first stop and each
  // steer pay one more). It would need invariant 6 and the four documents that
  // state "at most one ahead" changed to say two, in the same change, which is
  // the whole reason it was not done here.
  //
  // Two of its guards are worth keeping in mind if anything like it comes back,
  // because both had also stopped describing this feed: it skipped a pool-served
  // focus (so the deeper lookahead never applied to an orbit or the news at all)
  // and it skipped a ♥-liked card because "the next drift follows one of THIS
  // card's threads" — which the scroller turns off, passing `likedFollow: false`
  // and inserting the follow into the queue explicitly instead.

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
  /**
   * Whether the day's allowance is spent.
   *
   * An unknown meter (signed out, no backend, the request failed) is NOT spent:
   * the meter fails open, always (CLAUDE.md §4). `limitReached` already returns
   * false when no limit is configured, so the measure-first state needs no case
   * of its own here.
   */
  function dayIsSpent(): boolean {
    return meter !== null && limitReached(meter, FREE_DAILY_STOPS);
  }

  function endSession(reason: "user" | "limit" = "user") {
    if (holdNav) return; // frozen while "looking around" in the tour
    setEndReason(reason);
    const now = Date.now();
    accrueDwell(now);
    dwellRef.current = { index: dwellRef.current.index, at: now };
    setEndExisting(sessionTrailRef.current);
    setEnded(true);
    tourSignal("ended"); // the tour's forced "End" step advances on this
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
  /**
   * Add a stop. `opts.parent` says which step it continues from; without it,
   * the one on screen.
   *
   * This used to slice the array to `pos + 1`, so pulling a thread from a
   * revisited card silently DELETED everything after it. Now it forks: the trail
   * is a tree and nothing you read is thrown away to make room for what you read
   * next. That also makes `history` append-only, which is what keeps the parent
   * indices valid forever (lib/branch.ts).
   */
  function pushStep(
    card: Card,
    via: ArrivedVia,
    direction: Dir,
    opts: { parent?: number; leaving?: number | null } = {},
  ) {
    seenRef.current.add(cardId(card));
    persistSeen([cardId(card)]); // fire-and-forget; serialized in storage
    // The daily meter (Phase 32). ⚠️ This is only ONE of the two places a stop
    // enters a trail: the SEED sets `history` directly and never comes through
    // here, so it counts itself (see the seed branch above). Counting only here
    // would quietly make the first card of every session free.
    recordStop();
    // Tell the tour which real move just happened (drift onward / thread pull /
    // realm cross), so its forced steps advance on the genuine action.
    if (direction === "drift") tourSignal("drifted");
    else if (direction === "thread") tourSignal("threaded");
    else if (direction === "cross") tourSignal("crossed");
    // ⚠️ THE AD COUNTER USED TO BE INCREMENTED HERE AND IT MOVED TO THE SHELL,
    // deliberately. "One ad every N drifts" is a promise about what the READER
    // did, and the scroller materialises cards three ahead of them — so counting
    // at the moment a card is chosen would place the ad three cards away from
    // where the number says. It counts on COMMIT now (`driftsRef` in
    // ContinuousFeed), which is the moment the reader actually arrives. The rule
    // is unchanged: only a passive drift counts, never a thread pull or a cross,
    // and those never come through the commit path at all.
    const parent = opts.parent ?? pos;
    // WHICH STOP THE READER IS LEAVING, which is not always the same question as
    // which stop this one continues from.
    //
    // In the card-at-a-time feed they coincide: you are standing on `pos` and you
    // leave it. An explicit `parent` there means rejoining an EARLIER stop
    // (walking a door, branching), where nothing is being declined and so nothing
    // is recorded. The continuous feed breaks the coincidence — a card commits
    // when the reader scrolls onto it, and the stop they left is the tip, which
    // they may have passed a moment ago — so it names both.
    const leaving =
      opts.leaving !== undefined
        ? opts.leaving
        : opts.parent === undefined
          ? pos
          : null;
    const at = history.length; // the index this step is about to take
    // The doors the stop you are LEAVING keeps behind (Phase 28): the threads it
    // offered and you did not take. Recorded now, because only now is it known
    // which one you took — and only for a stop you actually engaged with, so a
    // card you scrolled straight past leaves nothing (lib/doors.ts). An explicit
    // parent means you are rejoining an earlier stop rather than leaving the one
    // on screen, so nothing is being declined and nothing is recorded.
    const doors = leaving === null ? [] : doorsLeavingHere(card, leaving);
    setHistory((h) => {
      const next = h.slice();
      const leaving = next[parent];
      if (leaving && doors.length > 0) {
        next[parent] = { ...leaving, doorsLeft: doors };
      }
      next.push({
        card,
        arrivedVia: via,
        timestamp: Date.now(),
        expanded: false,
        // Stored only when it is not the implicit "the step before this one",
        // so an ordinary trail serialises exactly as it always did.
        ...(parent === at - 1 ? {} : { parent }),
      });
      return next;
    });
    setPos(at);
    setTip(at);
  }

  /** The untaken threads of the card being left, if it earned any. Reads the
   *  live dwell from the ref, because the effect that writes `dwellMs` into the
   *  step has not run yet at this point (it fires on the `pos` change this very
   *  call is about to cause). */
  function doorsLeavingHere(taken: Card, from: number): Door[] {
    const leaving = history[from];
    if (!leaving) return [];
    const offered = threadCache[cardId(leaving.card)];
    if (!offered || offered.length === 0) return [];
    const live =
      dwellRef.current.index === from && dwellRef.current.at > 0
        ? Date.now() - dwellRef.current.at
        : 0;
    if (
      !engagedWith({
        expanded: leaving.expanded,
        reacted: !!reactions[cardId(leaving.card)],
        dwellMs: (leaving.dwellMs ?? 0) + live,
      })
    ) {
      return [];
    }
    // The card being pushed IS where you went, whether you pulled it or drifted
    // onto it, so it is never a door you left.
    return doorsFrom(offered, taken.pageTitle);
  }

  // ----- what a queue-based shell needs on top (continuous feed, Phase 3) -----
  //
  // A handful of small functions, and each exists because a continuous feed asks
  // a question the card-at-a-time feed never had to. (This said "four" until the
  // pre-Phase-7 audit added `sourceQuiet`; a count in a comment is a thing that
  // goes stale silently, so it is a count no longer.)

  /**
   * Commit a card the reader has actually arrived on.
   *
   * ⚠️ IT TAKES THE TIP EXPLICITLY, AND THAT IS THE POINT. `pushStep` defaults
   * both the parent and the stop-being-left to `pos`, which is right when the
   * reader can only be in one place. In a scroller they can be scrolled up to
   * stop 2 of 10, scroll back down through the queue, and commit a card that
   * continues from 10 — so the caller names the tip rather than letting `pos`
   * answer a question it no longer knows.
   */
  function commitCard(card: Card, via: ArrivedVia, from: number) {
    pushStep(card, via, "drift", { parent: from, leaving: from });
  }

  /** The chips for ANY card, committed or not — the queue renders cards that are
   *  not in the trail yet, and `threads` above can only speak about `history[pos]`.
   *  Filtered against the trail exactly as the displayed card's are. */
  function threadsOf(card: Card): Thread[] {
    return threadsNotInTrail(threadCache[cardId(card)] ?? [], history);
  }

  /** Are that card's chips still on their way? Distinct from "it has none". */
  function threadsPendingFor(card: Card): boolean {
    return !(cardId(card) in threadCache);
  }

  /**
   * Fetch a card's chips if nobody has yet. Idempotent twice over: it skips a
   * card already in the cache, and `threadsFor` keeps at most one request in
   * flight per card id, so however many callers ask, a card is fetched once.
   *
   * ⚠️ CALL IT FOR THE ACTIVE CARD AND AT MOST ONE AHEAD. Threads plus a doorway
   * for every rendered card would take a Gallery screenful from ~9 to ~45 Met
   * requests against a bucket of roughly 80 per 30 seconds, and CLAUDE.md §4
   * records that an open breaker serves a Gallery room zero cards. This is the
   * single rule in the continuous feed that must not be relaxed.
   */
  function ensureThreads(card: Card): void {
    const id = cardId(card);
    if (id in threadCacheRef.current) return;
    // The card's OWN realm, not the one on screen: a doorway card can be queued
    // from the other side, and asking the wrong realm's route would answer about
    // a different page that happens to share a title.
    void threadsFor(card, card.pageTitle, realmOfSource(card.source), id)
      .then((chosen) =>
        setThreadCache((c) => (id in c ? c : { ...c, [id]: chosen })),
      )
      .catch(() => {
        /* optional: the chips simply arrive on the card instead (CLAUDE.md §4) */
      });
  }

  /**
   * Put cards back in the pile.
   *
   * A queued card that is discarded — a thread pulled, a realm crossed, a focus
   * released, a card a flick skipped past — was never committed, so nothing
   * recorded that the reader saw it, and it is still perfectly good. It also
   * already cost an upstream request. Throwing it away would mean every thread
   * pull spends three cards of the museum's daily budget on nothing.
   *
   * To the FRONT, so the cards nearest the reader's attention are the ones served
   * next rather than being buried under a later refill.
   *
   * ⚠️ ONLY CARDS THAT CAME FROM THIS BUFFER GO BACK INTO IT. A card served by a
   * POOL — an "in the news" story, an orbit ring — carries framing the random
   * buffer cannot express ("2 days ago", "one ring out from Octopus"), and
   * putting it here would re-serve it later stripped of the reason it was ever
   * shown, which is precisely the transparency §2.1 is about. Those pools do
   * their own recycling (the news revisit ring, the orbit pool), so dropping the
   * card here loses nothing.
   */
  function returnToBuffer(items: { card: Card; via: ArrivedVia }[]): void {
    const buffered: BufferedCard[] = [];
    for (const { card, via } of items) {
      if (via.type !== "drift") continue;
      if (via.reason === "current") continue; // a pool's card, not the buffer's
      buffered.push({
        card,
        ...(via.topic ? { topic: via.topic } : {}),
        ...(via.reason ? { reason: via.reason } : {}),
      });
    }
    if (buffered.length > 0) randomBufferRef.current.unshift(...buffered);
  }

  // ----- walking a door (Phase 29) -----
  //
  // A door you left open used to reopen as a brand new session, which threw the
  // trail away: you lost the reading you were in the middle of, and the fact
  // that this page came from THAT stop was recorded nowhere. Opening one now
  // forks the trail at the stop that offered it. Two ways in — here, from the
  // live exit screen, and `withDoorBranch` below for a saved trail — and both
  // build the step through `doorArrival`, so they cannot drift apart.

  /** The card a door leads to, or null if it would not load. Optional by
   *  nature: a door that will not open must leave the trail exactly as it was. */
  async function fetchDoorCard(door: Door): Promise<Card | null> {
    try {
      const res = await fetch(
        summaryUrl(realmOfSource(door.source), door.pageTitle),
        { signal: AbortSignal.timeout(8000) },
      );
      const card = (await res.json()) as Card;
      return res.ok && card?.pageTitle ? card : null;
    } catch {
      return null;
    }
  }

  /** Open a door from the exit screen: close the map and carry straight on, on a
   *  branch off the stop that offered it. No navigation, so the session, its
   *  saved trail and its buffers all survive. */
  async function openDoor(od: OpenDoor) {
    if (busyRef.current || holdNav) return;
    // The day's allowance (Phase 32). Checked HERE, before anything is fetched,
    // so a spent day costs the upstream sources nothing. The session closes into
    // the trail map rather than into a wall: the reward belongs at the exit.
    if (dayIsSpent()) {
      endSession("limit");
      return;
    }
    const from = history[od.stepIndex];
    if (!from) return;
    await withBusy(async () => {
      const card = await fetchDoorCard(od.door);
      if (!card) {
        showHint("That door wouldn't open just now. Try again in a moment.");
        return;
      }
      setEnded(false);
      pushStep(card, doorArrival(od.door, from.card), "thread", {
        parent: od.stepIndex,
      });
    });
  }

  /** The same branch, applied to a trail being rehydrated from storage rather
   *  than to the live one (`?continue=<id>&door=<stop>.<door>`). Returns the
   *  steps unchanged when the reference is missing, junk or unloadable — a
   *  broken link resumes the trail rather than failing to open it. */
  async function withDoorBranch(
    steps: TrailStep[],
    param: string | null,
  ): Promise<TrailStep[]> {
    const ref = parseDoorParam(param);
    if (!ref) return steps;
    const from = steps[ref.stepIndex];
    const door = from?.doorsLeft?.[ref.doorIndex];
    if (!from || !door) return steps;
    const card = await fetchDoorCard(door);
    if (!card) return steps;
    return [
      ...steps,
      {
        card,
        arrivedVia: doorArrival(door, from.card),
        timestamp: Date.now(),
        expanded: false,
        ...(ref.stepIndex === steps.length - 1 ? {} : { parent: ref.stepIndex }),
      },
    ];
  }

  // Hold the feed busy across an async move, without stealing the lock from an
  // outer move that already holds it (a crossing INTO a focused realm runs the
  // focused-card fetch inside its own busy window). Nested calls are no-ops.
  async function withBusy<T>(fn: () => Promise<T>): Promise<T> {
    if (busyRef.current) return fn();
    busyRef.current = true;
    setAdvancing(true);
    try {
      return await fn();
    } finally {
      busyRef.current = false;
      setAdvancing(false);
    }
  }

  /**
   * The next card a POOL-SERVED focus should hand over — an "in the news" drift
   * or a page orbit, both of which draw from their own pool rather than the
   * discover buffer. Null when the focus has nothing left (a hint has been shown
   * saying so). Bucket-pinned focuses aren't here: they pin `fetchDiscoverBatch`
   * instead, and so are served by the ordinary buffer path.
   *
   * Shared by a passive drift and by a crossing that lands back in this focus's
   * realm, so both keep the same promise.
   */
  async function nextFocusedCard(
    f: Focus,
    // Always a *drift* arrival (narrowed from ArrivedVia so a crossing can add
    // `crossedFrom` to it, which only a drift or a thread carries).
    opts: { background?: boolean } = {},
  ): Promise<{ card: Card; via: Extract<ArrivedVia, { type: "drift" }> } | null> {
    // A BACKGROUND fetch must not take the busy lock — see `nextDriftCard`.
    const run = opts.background
      ? <T,>(fn: () => Promise<T>) => fn()
      : withBusy;
    // ...nor announce a dry pool with a transient toast. The card-at-a-time feed
    // has nowhere else to say it, so it says it over the middle of the screen.
    // A queue-based shell puts the same words on a card at the END of the
    // scroll, which is where the question "why did it stop?" is actually asked
    // (components/TerminusCard.tsx). Saying it twice, in two places, would be
    // worse than either.
    const say = opts.background ? () => {} : showHint;
    // "In the news" drift (Phase 23): serve the section's current articles,
    // best-ranked first, paging deeper into the pool as it empties. Once the
    // pool is genuinely dry we widen into the neighbourhood of the stories
    // themselves (a multi-seed orbit over everything we served) rather than
    // dropping you into a generic field, and the chip says so.
    if (f.kind === "current") {
      const via = (extra: {
        daysAgo?: number;
        widened?: boolean;
        revisit?: boolean;
      }) =>
        ({
          type: "drift" as const,
          reason: "current" as const,
          topic: { id: f.section, label: f.label },
          current: { section: f.section, label: f.label, ...extra },
        });

      // 1) The section's own current articles, best-ranked first, paging deeper as
      //    the buffer empties. Only a genuinely empty page (end of the ranked pool)
      //    marks the pool dry; a transient fetch error just retries next drift. The
      //    loop (not a single fetch) matters when a page is entirely already-seen.
      if (!currentDryRef.current) {
        let nc = takeCurrentCard();
        if (!nc) {
          await run(async () => {
            for (let guard = 0; guard < CURRENT_DRIFT_PAGES && !nc; guard++) {
              const { fresh, status } = await fetchCurrentPage(f.section);
              currentBufferRef.current.push(...fresh);
              nc = takeCurrentCard();
              if (status === "end") {
                if (!nc) currentDryRef.current = true;
                break;
              }
              if (status === "error") break;
            }
          });
        }
        if (nc) return { card: nc.card, via: via({ daysAgo: nc.daysAgo }) };
      }

      // 2) Pool dry: widen into the neighbourhood of the stories themselves (a
      //    multi-seed orbit over every story we served), so you keep finding NEW,
      //    related reading before anything is ever repeated.
      if (!orbitRef.current) {
        orbitRef.current = initOrbit(currentSeedsRef.current, f.label);
      }
      let oc = takeOrbitCard();
      if (!oc) {
        oc = await run(async () => {
          await refillOrbit();
          return takeOrbitCard();
        });
      }
      if (oc) return { card: oc.card, via: via({ widened: true }) };

      // 3) Read the stories AND their neighbourhood dry: rather than dead-ending,
      //    gently re-show current articles you've already read (best-ranked, on a
      //    recycling ring) and say so, so the section is never a broken button.
      //    New stories surface here over the following days.
      const rc = takeRevisitCard();
      if (rc) {
        enterCaughtUp();
        return { card: rc.card, via: via({ daysAgo: rc.daysAgo, revisit: true }) };
      }
      say(
        "You've read everything in this story and around it. Pull a thread, or drift freely.",
      );
      return null;
    }

    // Focused orbit drift (Phase 18): serve the seed's widening neighbourhood
    // (BFS, lowest ring first) instead of the topic buffer. Refill by expanding
    // the frontier via morelike (the healthy endpoint), on empty only.
    if (f.kind === "orbit") {
      let oc = takeOrbitCard();
      if (!oc) {
        oc = await run(async () => {
          await refillOrbit();
          return takeOrbitCard();
        });
      }
      if (oc) {
        return {
          card: oc.card,
          via: {
            type: "drift",
            reason: "orbit",
            topic: { id: "orbit", label: f.seedLabel },
            orbit: { seedLabel: f.seedLabel, ring: oc.ring },
          },
        };
      }
      say(
        "You've wandered this whole orbit. Pull a thread, or drift freely to go wider.",
      );
      return null;
    }

    return null; // bucket-pinned focuses are served by the discover buffer
  }

  // The real drift: a focused orbit, a liked-thread follow, or an independent
  // random jump.
  /**
   * CHOOSE the next passive-drift card, without committing it.
   *
   * The natural seam `doDrift` always had: everything above the `pushStep` calls
   * is a decision, everything at them is a consequence. The card-at-a-time feed
   * does both in one breath because only one card can exist; the continuous feed
   * must choose a card, render it, and only commit it once the reader actually
   * arrives (lib/feedqueue.ts). So the decision is a function now, and `doDrift`
   * is what it always was: this, plus a step.
   *
   * `likedFollow` is the one behavioural difference between the two callers. In
   * the card-at-a-time feed a ♥ quietly redirects the NEXT drift down one of this
   * card's threads. A queue cannot do that quietly — the next card already
   * exists — so the continuous feed turns it off here and inserts the follow
   * explicitly instead, which is the more honest version of the same promise.
   *
   * Returns null when nothing could be found; the caller decides what to say
   * about that, because a feed with a queue says it in a different place than one
   * without (a card at the end of the scroll, not a toast over the middle).
   */
  async function nextDriftCard(
    opts: { likedFollow?: boolean; background?: boolean } = {},
  ): Promise<{ card: Card; via: ArrivedVia } | null> {
    // ONE attempt, one answer to "could we reach a source?". Cleared here and
    // only here; every producer below ORs a failure in. That ordering is the
    // whole contract — see `upstreamQuietRef` for why last-writer-wins was not
    // good enough. A buffered card that needs no fetch at all leaves it false,
    // which is right: nothing was asked, so nothing was refused.
    upstreamQuietRef.current = false;
    // A focus steers the passive drift only inside its OWN realm: carried through
    // a doorway into the other one it goes dormant (and the banner says so), so
    // what happens here is an ordinary drift in the realm you are actually in.
    const focused = focusIn(realmRef.current);
    if (focused && (focused.kind === "current" || focused.kind === "orbit")) {
      // Already returns a card without committing it, which is why the
      // pool-served focuses needed no work here.
      return await nextFocusedCard(focused, { background: opts.background });
    }

    // At the live card → drift. By default every drift is an independent random
    // jump (two scrolls are unrelated). The one exception: if you liked this
    // card, the next drift follows one of its related threads to "stay in the
    // stream" (instant, on-theme) — relatedness tied to an explicit signal, not
    // a blind coin flip that used to chain near-identical pages together.
    // A focus is a promise about where the passive drift goes, and any focus still
    // live at this point is bucket-pinned (orbit and current returned above). So
    // the liked-card shortcut is suspended while one is set: following a thread on
    // your behalf would quietly carry you out of the field you asked to stay in,
    // while the banner still said you were inside it. Pulling a thread yourself
    // stays free, as it always is under a focus. A DORMANT focus makes no such
    // promise about this realm, so the shortcut is back on here.
    const likedCurrent =
      opts.likedFollow !== false && !focused && current
        ? reactions[cardId(current.card)] === "like"
        : false;
    const choice = pickDriftNext(threads, { likedCurrent });
    if (choice.type === "thread" && current) {
      return {
        card: candidateToCard(choice.thread.candidate),
        via: { type: "drift", fromLiked: current.card.displayTitle },
      };
    }

    // Independent random drift. Served from the buffered batch: instant whenever
    // it holds cards; we only refetch when it runs dry. The buffer is filled from
    // the topic-discover endpoint (interesting-random), so a "random" drift lands
    // on a popular, on-topic page instead of an obscure stub — and carries the
    // topic it came from (shown on the card).
    let bc = takeBufferedRandom();
    if (!bc) {
      // ⚠️ A BACKGROUND REFILL MUST NOT TAKE THE BUSY LOCK, and this was found by
      // measurement rather than by reading. `busyRef` is what stops a second
      // move starting while one is in flight, so `crossRealm`, `onThread`,
      // `goBack` and the rest all early-return while it is set. In the
      // card-at-a-time feed that is exactly right: a refill only ever happens
      // inside the move the reader is waiting on. In a continuous feed the queue
      // tops itself up in the background, constantly — so the lock was set most
      // of the time, and tapping "Cross to the Gallery" silently did nothing.
      const lock = !opts.background;
      if (lock) {
        busyRef.current = true;
        setAdvancing(true);
      }
      try {
        await refillRandomBuffer();
        bc = takeBufferedRandom();
      } finally {
        if (lock) {
          busyRef.current = false;
          setAdvancing(false);
        }
      }
    }
    if (bc) {
      // Keep the buffer above its low-water mark in the background, so the next
      // drift is never the one that has to wait for three discover calls.
      if (
        servableCount(
          randomBufferRef.current,
          seenRef.current,
          realmRef.current,
        ) < REFILL_LOW_WATER
      ) {
        void topUpBuffer();
      }
      return {
        card: bc.card,
        via: { type: "drift", topic: bc.topic, reason: bc.reason },
      };
    }

    // Refill failed (both discover and random unavailable). Keep advancing on
    // a *random* untapped thread (morelike stays healthy under throttling),
    // else nothing. Never a silent dead button.
    //
    // Except under a FIELD focus, where that thread is the bug the reader
    // reported as "I picked a field and it just drifted randomly": a thread
    // neighbour is not in the field, and it arrives labelled only "Drifting"
    // while the banner still promises "Within Architecture". A field holds tens
    // of thousands of pages and `refillRandomBuffer` has already reached deeper
    // before giving up, so an empty buffer here means the source is unavailable,
    // not that the field ran out. Say so, and keep the promise.
    const t = focused?.kind === "field" ? null : pickRandomThread(threads);
    if (t) return { card: candidateToCard(t.candidate), via: { type: "drift" } };
    return null;
  }

  // ⚠️ THERE WAS A `doDrift()` HERE AND ITS ABSENCE IS THE ARCHITECTURE, not an
  // omission. It was `nextDriftCard()` plus `pushStep()` in one breath — choose a
  // card and put it in the trail — which is only possible when exactly one card
  // can exist. The scroller chooses a card (`nextDriftCard`), renders it into the
  // queue, and commits it (`commitCard`) only once the reader has actually
  // arrived on it. Those two halves are now called from two different places at
  // two different times, and keeping a function that does both would be an
  // invitation to commit a card nobody has seen.
  //
  // Its dry-source hint went too: a queue answers "why did it stop?" with a card
  // at the END of the scroll, where the question is actually asked, rather than
  // with a toast over the middle of whatever the reader is on.

  // Cross to the OTHER realm (Phase 15) — from a horizontal swipe or the top-bar
  // control. "Smart cross": land on the current card's doorway if one exists (a
  // genuinely related crossing), else a fresh discover card in the other realm.
  // Either way the realm then follows the landed card.
  async function crossRealm() {
    if (ended || busyRef.current || !current || holdNav) return;
    // The day's allowance (Phase 32). Checked HERE, before anything is fetched,
    // so a spent day costs the upstream sources nothing. The session closes into
    // the trail map rather than into a wall: the reward belongs at the exit.
    if (dayIsSpent()) {
      endSession("limit");
      return;
    }
    const fromRealm = realm;
    // Only Encyclopedia<->Gallery cross for now; Papers is self-contained.
    if (fromRealm !== "encyclopedia" && fromRealm !== "gallery") return;
    const otherRealm: RealmId =
      fromRealm === "gallery" ? "encyclopedia" : "gallery";
    busyRef.current = true;
    setAdvancing(true);
    try {
      let landed: { card: Card; via: ArrivedVia } | null = null;
      // A focus waiting in the realm we're crossing INTO is a promise we made
      // and never withdrew, so the crossing has to land inside it: a doorway
      // would put you on a genuinely related page that is nonetheless outside
      // the field, under a banner insisting you were within it. Pool-served
      // focuses come from the same function a drift uses; the bucket-pinned ones
      // need nothing here, since #2's discover batch is already pinned to them.
      const destFocus = focusIn(otherRealm);
      if (destFocus) {
        const next = await nextFocusedCard(destFocus);
        if (next) {
          landed = { card: next.card, via: { ...next.via, crossedFrom: fromRealm } };
        } else if (destFocus.kind === "current" || destFocus.kind === "orbit") {
          return; // the pool is dry and has said so; don't cross to a random card
        }
      }

      // #1 the current card's doorway (related crossing).
      if (!landed && !destFocus) {
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

  // Take the next unseen card off the random buffer (discarding any now-seen or
  // belonging to the other realm), or null if nothing in it can be served.
  //
  // The predicate lives in lib/lookahead so that `peekNextBuffered` below cannot
  // disagree with it: a peek that named a different card would prepare one card
  // and then show another, and the only symptom would be an unexplained rise in
  // the upstream counts.
  function takeBufferedRandom(): BufferedCard | null {
    return takeServable(
      randomBufferRef.current,
      seenRef.current,
      realmRef.current,
    );
  }

  /** A short string naming the promise this realm's drift is under right now.
   *  A background refill is stamped with it and its result discarded if it has
   *  changed — see `topUpBuffer`. The artist ring is part of the promise because
   *  it selects the bucket. */
  function focusStamp(rid: RealmId): string {
    return `${JSON.stringify(focusIn(rid) ?? null)}|${artistRingRef.current}`;
  }

  /**
   * Top the buffer up WITHOUT the busy lock, so a reader never watches a refill.
   *
   * Guarded two ways. One at a time, or a slow upstream would let several
   * overlapping refills pile the same cards in. And the result is dropped if the
   * realm or the focus changed while it was in flight: a batch is chosen under a
   * promise, and `releaseFocus` only filters the buffer at the moment it runs, so
   * a late arrival would quietly re-seed the feed with cards from a focus the
   * reader has already let go of.
   *
   * Failure costs nothing: `nextDriftCard`'s own blocking `refillRandomBuffer`
   * is still there as the fallback. (This said `doDrift` until Phase 7, which
   * split choosing a card from committing it and deleted that function.)
   */
  async function topUpBuffer(): Promise<void> {
    if (bgRefillRef.current) return;
    const rid = realmRef.current;
    const stamp = focusStamp(rid);
    bgRefillRef.current = true;
    try {
      const batch = await fetchDiscoverBatch(rid);
      if (realmRef.current !== rid || focusStamp(rid) !== stamp) return;
      randomBufferRef.current.push(...batch);
    } catch {
      /* a background top-up that fails is not an error the reader should see */
    } finally {
      bgRefillRef.current = false;
    }
  }

  // One buffer refill: pick REFILL_TOPICS topics, fetch a small popular-but-
  // varied batch for each (via /api/wiki/discover), drop already-seen cards, and
  // interleave so consecutive random drifts alternate topics. Returns [] on total
  // failure. Topic choice is interest-weighted when personalization is on (with a
  // serendipity floor + truthful reason), else a plain uniform-random wander.
  async function fetchDiscoverBatch(
    rid: RealmId = realmRef.current,
    // `deep` samples further down the bucket's ranking than the usual window.
    // Used as a second try for a field focus, whose ordinary window is the top
    // ~400 pages of the topic: a long session inside one field reads that dry,
    // and then every card in a refill is already `seen` and the batch is empty.
    opts: { deep?: boolean } = {},
  ): Promise<BufferedCard[]> {
    const rm = getRealm(rid);
    // A bucket-pinned focus makes every pick in the refill the SAME bucket, so
    // the whole batch stays inside the chosen area. Three kinds pin this way: a
    // field focus in the Encyclopedia (Phase 18), and a form+era slice or an
    // artist in the Gallery (Phase 24). Otherwise the normal interest-weighted /
    // uniform topic mix (personalization is suspended while focused).
    //
    // Asked of the realm being FETCHED, not the one on screen: a crossing back
    // into a focused realm fetches its first card while the feed still shows the
    // realm it is leaving, and that batch has to arrive already inside the focus.
    const focus = focusIn(rid);
    const pinned =
      focus && (focus.kind === "field" || focus.kind === "form" || focus.kind === "artist")
        ? focus
        : null;
    const pinnedBucket = pinned
      ? focusBucket(pinned, artistRingRef.current)
      : null;
    const personalize =
      personalizeRef.current && rm.hasInterestModel && !pinned;
    const pinnedReason = (
      pinned?.kind === "form"
        ? "form"
        : pinned?.kind === "artist"
          ? "artist"
          : "field"
    ) as "form" | "artist" | "field";
    // Once an artist drift widens, the cards are no longer BY that artist, so
    // the "why this card" line has to say where they really came from
    // ("Post-Impressionism, around Vincent van Gogh") rather than keep crediting
    // the artist (§2.1).
    const profile = artistProfileRef.current;
    const pinnedLabel =
      pinned?.kind === "artist" && profile
        ? artistRingLabel(profile, artistRingRef.current)
        : (pinned?.label ?? "");
    const picks =
      pinned && pinnedBucket
        ? Array.from({ length: REFILL_TOPICS }, () => ({
            id: pinnedBucket,
            label: pinnedLabel,
            bucket: pinnedBucket,
            reason: pinnedReason,
          }))
        : Array.from({ length: REFILL_TOPICS }, () =>
            rm.pickDiscover({ interest: interestRef.current, personalize }),
          );
    // An artist's own work is a small, FINITE, ordered set (18 works for Van
    // Gogh), so it has to be paged through in sequence: a random offset would
    // land past the end and look like an exhausted oeuvre after one drift. The
    // widened rings are large, so they sample randomly like everything else.
    const sequential = pinned?.kind === "artist" && artistRingRef.current === 0;
    const base = artistOffsetRef.current;
    if (sequential) artistOffsetRef.current += REFILL_TOPICS * DISCOVER_LIMIT;
    const batches = await Promise.all(
      picks.map(async (pick, i): Promise<{ cards: BufferedCard[]; ok: boolean }> => {
        try {
          const res = await fetch(
            discoverUrl(rid, {
              bucket: pick.bucket,
              // Whole windows again (the sequential artist path already pages by
              // DISCOVER_LIMIT, which is the same idea).
              offset: sequential
                ? base + i * DISCOVER_LIMIT
                : randomOffset(
                    Math.random,
                    opts.deep ? DEEP_OFFSET_MAX : 400,
                    DISCOVER_LIMIT,
                  ),
              limit: DISCOVER_LIMIT,
            }),
            { signal: AbortSignal.timeout(6000) },
          );
          if (!res.ok) return { cards: [], ok: false };
          const cards = (await res.json()) as Card[];
          if (!Array.isArray(cards)) return { cards: [], ok: false };
          return {
            cards: cards
              .filter((c) => c?.pageTitle && !seenRef.current.has(cardId(c)))
              .map((card) => ({
                card,
                topic: { id: pick.id, label: pick.label },
                reason: pick.reason,
              })),
            // ANSWERED, even when the answer was "nothing left here". That is
            // the whole distinction: `ok` is about reaching the source, not
            // about liking what it said.
            ok: true,
          };
        } catch {
          return { cards: [], ok: false };
        }
      }),
    );
    // Quiet only when NOT ONE of the parallel picks got through. One good answer
    // means the source is up and the emptiness is real. OR-ed in rather than
    // assigned: `nextDriftCard` owns the clearing (see `upstreamQuietRef`), so a
    // later producer in the same attempt cannot wipe out a failure this one saw.
    if (batches.length > 0 && batches.every((b) => !b.ok)) {
      upstreamQuietRef.current = true;
    }
    return interleave(batches.map((b) => b.cards));
  }

  // Resolve a page's tracked topics — from the client cache, else the topics API
  // (Lift Wing). Returns [] on any failure (the like still records, model just
  // doesn't move). Cached so re-reacting costs nothing. An empty cached value is
  // treated as a miss and re-fetched: `[]` is also what a throttled/failed
  // lookup returns, so trusting it would freeze that page's topics forever
  // (older builds did cache empties; this self-heals them).
  async function resolveTopics(title: string): Promise<string[]> {
    try {
      const cached = await getCachedTopics(title);
      if (cached && cached.length > 0) return cached;
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

  // Thumbs up / thumbs down on a card. Optimistically flips the button, persists
  // the reaction, then adjusts the interest weights: undo the previous reaction
  // (if any) and apply the new one, so switching or clearing is consistent.
  // Threads are untouched.
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
    tourSignal("reacted"); // the tour's "try a reaction" step advances on this

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
  // throttling only makes things worse. Instead `nextDriftCard` falls back to a
  // morelike thread neighbour (which stays healthy). Leaves the buffer empty on
  // failure; the caller handles that.
  async function refillRandomBuffer(): Promise<void> {
    const batch = await fetchDiscoverBatch();
    if (batch.length > 0) {
      randomBufferRef.current.push(...batch);
      return;
    }
    const focused = focusIn(realmRef.current);
    // A field drift samples the top ~400 pages of its topic, so a long stay in
    // one field can leave a refill holding nothing but pages already seen. The
    // field itself is nowhere near empty (tens of thousands of pages), so reach
    // deeper once before the caller has to tell the reader anything.
    if (focused?.kind === "field") {
      const deeper = await fetchDiscoverBatch(realmRef.current, { deep: true });
      if (deeper.length > 0) {
        randomBufferRef.current.push(...deeper);
        return;
      }
    }
    // An artist drift that comes back empty has read the current ring dry (an
    // oeuvre is finite: Van Gogh is 18 works here). Step outward — their
    // movement, then their period and medium — and try again, rather than
    // dead-ending on an artist we simply hold little of. Widening is announced
    // on the banner, never silent (§2.1). Threads stay untouched.
    if (focused?.kind !== "artist") return;
    const profile = artistProfileRef.current;
    if (!profile) return;
    while (true) {
      const next = nextArtistRing(profile, artistRingRef.current);
      if (next === null) return; // ladder exhausted: the caller falls back
      artistRingRef.current = next;
      setMetArtistRing(next);
      const wider = await fetchDiscoverBatch();
      if (wider.length > 0) {
        randomBufferRef.current.push(...wider);
        return;
      }
    }
  }

  function showHint(message: string, duration = 3000) {
    setHint(message);
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHint(null), duration);
  }

  // Enter "you're caught up on this section" once per session: a persistent banner
  // suffix (transparency, §2.1) plus a single longer-lived notice that says you've
  // read the section's current stories and are now being shown ones you've seen.
  // Inlines the hint (rather than calling showHint) so it stays a stable reference
  // for the mount effect that opens a caught-up section.
  function enterCaughtUp() {
    if (caughtUpRef.current) return;
    caughtUpRef.current = true;
    setCaughtUp(true);
    setHint(
      "You're all caught up on this section. Showing stories you've read before. Check back later for new ones.",
    );
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHint(null), 6000);
  }

  // ----- "in the news" pool (Phase 23) -----
  // One page of a news section's ranked pool, split into UNSEEN cards (returned to
  // buffer + serve) and already-seen ones (remembered for the caught-up revisit).
  // `status` lets the caller page correctly: "ok" = a normal page (keep paging if
  // it held no unseen card), "end" = an empty page ⇒ the ranked pool is exhausted,
  // "error" = a transient fetch failure (stop this attempt, retry next drift).
  // Advances the paging offset by the REQUESTED size, not the returned count: the
  // route filters junk after slicing its ranking, so a short page still means we
  // consumed that many ranked slots. Every valid story (read or not) becomes a
  // widening-orbit seed, so the neighbourhood still has anchors once you're caught
  // up. Graceful: any failure degrades to "error" and the caller falls back (§4).
  async function fetchCurrentPage(
    section: string,
  ): Promise<{ fresh: CurrentCard[]; status: "ok" | "end" | "error" }> {
    const offset = currentOffsetRef.current;
    currentOffsetRef.current = offset + CURRENT_PAGE;
    try {
      const res = await fetch(
        `/api/wiki/current?section=${encodeURIComponent(section)}&offset=${offset}&limit=${CURRENT_PAGE}`,
        { signal: AbortSignal.timeout(8000) },
      );
      // "error" means we could not reach the news pool, which is a different
      // sentence from "this section is read out" and reaches the reader as a
      // different ending. See `upstreamQuietRef`; the caller's `status` is about
      // paging, and cannot carry this.
      if (!res.ok) return quietly({ fresh: [], status: "error" });
      const batch = (await res.json()) as CurrentCard[];
      if (!Array.isArray(batch)) return quietly({ fresh: [], status: "error" });
      const fresh: CurrentCard[] = [];
      for (const c of batch) {
        if (!c?.card?.pageTitle) continue;
        currentSeedsRef.current.push(c.card.pageTitle);
        if (seenRef.current.has(cardId(c.card))) {
          // Already read → keep it (ranked, de-duplicated) for the caught-up
          // revisit ring. Inlined rather than calling rememberRevisit so this
          // stays a stable reference for the mount effect (openCurrentSection).
          const rev = currentRevisitRef.current;
          const id = cardId(c.card);
          if (!rev.some((r) => cardId(r.card) === id)) rev.push(c);
        } else {
          fresh.push(c);
        }
      }
      return { fresh, status: batch.length === 0 ? "end" : "ok" };
    } catch {
      return quietly({ fresh: [], status: "error" });
    }
  }

  /** Mark this attempt as "we could not reach a source" and pass the result
   *  through. One helper so all three of `fetchCurrentPage`'s failure exits say
   *  it, which is what stops the next one being added without it. */
  function quietly<T>(result: T): T {
    upstreamQuietRef.current = true;
    return result;
  }

  function takeCurrentCard(): CurrentCard | null {
    const buf = currentBufferRef.current;
    while (buf.length > 0) {
      const c = buf.shift()!;
      if (c?.card?.pageTitle && !seenRef.current.has(cardId(c.card))) return c;
      // A buffered card that became seen (e.g. via a thread) is still a valid
      // caught-up revisit later, so keep it rather than dropping it on the floor.
      if (c?.card?.pageTitle) rememberRevisit(c);
    }
    return null;
  }

  // Remember an already-seen current article for the caught-up revisit ring,
  // in ranked (arrival) order, de-duplicated by card id.
  function rememberRevisit(c: CurrentCard) {
    const buf = currentRevisitRef.current;
    const id = cardId(c.card);
    if (!buf.some((r) => cardId(r.card) === id)) buf.push(c);
  }

  // Recycle the revisit ring: serve the best-ranked seen card that isn't the one
  // you're already on, rotating it to the back so a caught-up section keeps gently
  // wandering its own current stories instead of dead-ending. Null only if the ring
  // is empty (or holds nothing but the current card).
  function takeRevisitCard(): CurrentCard | null {
    const buf = currentRevisitRef.current;
    const curId = current ? cardId(current.card) : "";
    for (let i = buf.length; i > 0; i--) {
      const c = buf.shift()!;
      buf.push(c);
      if (c.card.pageTitle && cardId(c.card) !== curId) return c;
    }
    return null;
  }

  // ----- page orbit (Phase 18) -----
  // Take the lowest-ring unseen card from the orbit pool (or null if dry).
  function takeOrbitCard(): OrbitCard | null {
    const st = orbitRef.current;
    if (!st) return null;
    const { state, card } = takeFromPool(st, seenRef.current);
    orbitRef.current = state;
    return card;
  }

  // One orbit refill: expand up to 2 frontier titles by fetching their morelike
  // (the healthy, non-burst-limited endpoint), then fold the results into the
  // pool + frontier. Widens the ring the deeper the frontier goes. Graceful:
  // any fetch failure just contributes nothing; the caller handles a dry pool.
  async function refillOrbit(): Promise<void> {
    const st = orbitRef.current;
    if (!st) return;
    const toExpand = nextToExpand(st, 2);
    if (toExpand.length === 0) return;
    const fetched = await Promise.all(
      toExpand.map(async (f) => {
        try {
          const res = await fetch(relatedUrl("encyclopedia", f.title), {
            signal: AbortSignal.timeout(6000),
          });
          if (!res.ok) return { f, cands: [] as RelatedCandidate[], ok: false };
          const cands = (await res.json()) as RelatedCandidate[];
          return { f, cands: Array.isArray(cands) ? cands : [], ok: true };
        } catch {
          return { f, cands: [] as RelatedCandidate[], ok: false };
        }
      }),
    );
    let next = orbitRef.current;
    if (!next) return;
    for (const { f, cands, ok } of fetched) {
      // Only fold in (and mark expanded) a title whose fetch SUCCEEDED. A
      // transient failure (429 / timeout) leaves it on the frontier to retry, so
      // one unlucky refill can't strand the orbit; a genuine dead-end (ok but no
      // candidates) is still marked expanded and simply contributes nothing.
      if (ok) next = ingestMorelike(next, f.title, f.ring, cands, seenRef.current);
    }
    orbitRef.current = next;
    // ⚠️ AND SAY SO WHEN NOTHING GOT THROUGH. Leaving the frontier for a later
    // retry (above) keeps the orbit alive, but it tells the FEED nothing, and the
    // feed is what has to choose between "you have read this area dry" and "we
    // could not reach the source". Without this the first is what an orbit said
    // at a 503, on its very first refill, permanently. See `upstreamQuietRef`.
    // An exhausted FRONTIER is not this case and must not set it: that is a real
    // answer about the pool, and it reaches the reader as `pool-dry`, correctly.
    if (fetched.length > 0 && fetched.every((x) => !x.ok)) {
      upstreamQuietRef.current = true;
    }
  }

  // "Drift around this" (Phase 18): re-anchor a page orbit on the current card
  // mid-session. Doesn't navigate — the card you're on becomes the new seed; the
  // next drift begins spiraling out from it. Threads stay free (the way out).
  /** The orbit control is a toggle: tapping it while already circling THIS page
   *  releases the focus (the same thing the banner's "Drift freely" does), so the
   *  lit button can always be un-lit by the control that lit it. */
  function toggleOrbitHere(card: Card) {
    const here = focusIn("encyclopedia");
    if (here?.kind === "orbit" && here.seedTitle === card.pageTitle) {
      releaseFocus("encyclopedia");
      return;
    }
    startOrbitHere(card);
    tourSignal("orbited"); // the tour's "Circle one idea" step advances on this
  }

  function startOrbitHere(card: Card) {
    const f: Focus = {
      kind: "orbit",
      seedTitle: card.pageTitle,
      seedLabel: card.displayTitle,
    };
    // Nested INSIDE whatever broader focus is already set here, not instead of
    // it: finding a page worth circling while inside a field is the ordinary way
    // this happens, and letting the orbit go should return you to that field
    // rather than to a free drift you never asked for.
    applyFocusStack(pushFocus(focusStackRef.current, f));
    orbitRef.current = initOrbit(card.pageTitle, card.displayTitle);
    randomBufferRef.current = [];
    // Any "in the news" pool is left INTACT: an orbit anchored inside a news
    // drift is nested inside it, so releasing the orbit picks that section back
    // up where it was. (Its widening orbit state is the one thing lost, since
    // the two share `orbitRef`; it simply rebuilds from the stories it served.)
    writeFocusUrl(focusStackRef.current);
  }

  /**
   * Let go of the focus steering `rid` ("Drift freely" / tapping a lit orbit
   * control again), revealing whatever broader focus it was entered inside —
   * back to "Within Mathematics" after circling a page you found there — or a
   * free drift if there was none. Only the released focus's own machinery is
   * dropped; a revealed parent keeps its pool and carries straight on.
   */
  function releaseFocus(rid: RealmId) {
    const released = focusForRealm(focusStackRef.current, rid);
    if (!released) return;
    applyFocusStack(releaseFocusIn(focusStackRef.current, rid));
    if (released.kind === "orbit") orbitRef.current = null;
    if (released.kind === "current") {
      orbitRef.current = null; // the widening half of a news drift
      currentBufferRef.current = [];
      currentSeedsRef.current = [];
      currentOffsetRef.current = 0;
      currentDryRef.current = false;
      currentRevisitRef.current = [];
      caughtUpRef.current = false;
      setCaughtUp(false);
    }
    if (released.kind === "artist") {
      artistRingRef.current = 0;
      setMetArtistRing(0);
      artistOffsetRef.current = 0;
    }
    // Buffered cards were chosen under the promise just released, so drop the
    // ones from that realm; another realm's leftovers are still good.
    randomBufferRef.current = randomBufferRef.current.filter(
      (bc) => realmOfSource(bc.card.source) !== rid,
    );
    writeFocusUrl(focusStackRef.current);
  }

  /** Rewrite the URL to spell the focus stack the session is actually in, so a
   *  reload resumes it. The session-watching effect must read the rewrite as
   *  "already applied", not as a new session to start: entering or releasing a
   *  focus continues THIS drift, it does not ask to begin again somewhere else. */
  function writeFocusUrl(stack: Focus[]) {
    try {
      const u = new URL(window.location.href);
      writeFocusParams(u.searchParams, stack);
      appliedKeyRef.current = sessionKey(u.searchParams);
      window.history.replaceState(null, "", `${u.pathname}${u.search}`);
    } catch {
      /* URL API unavailable — non-fatal; the stack is still right in memory */
    }
  }

  /** Jump to a stop on the rail. The index is a position along the CURRENT
   *  branch, which is the only line the rail draws. */
  function jumpTo(index: number) {
    if (ended || busyRef.current || holdNav) return;
    const target = path[index];
    if (target === undefined || target === pos) return;
    setPos(target);
  }

  /** Step onto one of the ways this stop was left (Phase 30).
   *
   *  `tip` has to move with `pos`, through `tipOf`, or the branch being read is
   *  still the old one: the rail draws `pathTo(tip)` and looks for `pos` on it,
   *  and a tip on a different line leaves `pos` off the path entirely. */
  function onWay(index: number) {
    if (ended || busyRef.current || holdNav) return;
    if (index === pos || index < 0 || index >= history.length) return;
    setPos(index);
    setTip(tipOf(history, index));
  }

  function onThread(thread: Thread) {
    if (ended || busyRef.current || !current || holdNav) return;
    // The day's allowance (Phase 32). Checked HERE, before anything is fetched,
    // so a spent day costs the upstream sources nothing. The session closes into
    // the trail map rather than into a wall: the reward belongs at the exit.
    if (dayIsSpent()) {
      endSession("limit");
      return;
    }
    // A stop that already has a way out of it is being left a SECOND way, which
    // is a branch. Said now, on the move itself, rather than discovered on the
    // map afterwards (§2.1).
    const branch = (kids[pos]?.length ?? 0) > 0;
    setFollowing({ label: thread.label, branch });
    window.setTimeout(() => setFollowing(null), branch ? 1600 : 950);
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
        // The quoted reason travels with the step (Phase 28), which is what
        // turns a saved trail from a list of titles into something that reads:
        // each hop carries the sentence that justified it.
        ...(thread.bridge ? { bridge: thread.bridge.sentence } : {}),
      },
      "thread",
    );
  }


  /** Remember which saved trail this session maps to, so re-saving after more
   *  drifting updates it rather than duplicating it. Exposed as a function
   *  rather than as the ref itself: a ref on a hook's public surface is a
   *  private detail that becomes permanent the moment somebody uses it. */
  function onTrailSaved(t: SessionTrail) {
    sessionTrailRef.current = t;
  }

  // A flat object on purpose. The shell destructures or reads it name by name,
  // so every one of these reads in its JSX exactly as it did when this all lived
  // in one component — which is what made the extraction reviewable.
  //
  // ⚠️ NOTHING IS EXPORTED HERE THAT NOTHING CALLS. Phase 7 removed nine names
  // that only the card-at-a-time shell consumed (`advance`, `goBack`, `isBusy`,
  // `showAd`, `dir`, `ways`, `current`, `threads`, `threadsLoading`,
  // `dayIsSpent`). Several are still computed INSIDE this hook and must stay —
  // `threads` in particular, because `nextDriftCard`'s degraded fallback reads it
  // from render scope — but an export nothing consults is worse than none: the
  // pre-Phase-7 audit found three of them in lib/feedqueue, including one the
  // documentation called load-bearing, and their presence is what stopped anyone
  // looking.
  return {
    // the trail, and where on it the reader is standing
    history,
    pos,
    tip,
    path,
    pathPos,
    branchAt,
    waysFrom,
    endless,
    // the card on screen
    reactions,
    // realm and focus
    realm,
    realmMeta,
    otherRealmMeta,
    crossEnabled,
    banner,
    bannerRealm,
    revealed,
    bannerSuffix,
    orbitingThisCard,
    // the guided tour's two feed-facing bits: whether it is running (so an ad
    // is never slipped in mid-tour) and whether it has frozen navigation while
    // the reader "looks around" a card.
    tourActive,
    holdNav,
    // what the session is doing right now
    initialLoading,
    error,
    advancing,
    hint,
    following,
    meter,
    dayDone,
    // ending it
    ended,
    setEnded,
    endReason,
    endExisting,
    endSession,
    onTrailSaved,
    // the moves. Advancing and going back are not among them: in a scroller they
    // are scrolling, and the shell does them without asking the engine.
    nextDriftCard,
    /** Did the last `nextDriftCard` attempt fail to REACH a source, rather than
     *  come back with nothing? True for every producer — discover, the orbit
     *  ring and the news pool — not just discover. Read synchronously, and a
     *  function rather than the ref itself for the reason given on
     *  `onTrailSaved`. See `upstreamQuietRef` for the contract. */
    sourceQuiet: () => upstreamQuietRef.current,
    commitCard,
    threadsOf,
    threadsPendingFor,
    ensureThreads,
    returnToBuffer,
    jumpTo,
    onWay,
    onThread,
    crossRealm,
    openDoor,
    markExpanded,
    handleReact,
    toggleOrbitHere,
    releaseFocus,
  };
}
