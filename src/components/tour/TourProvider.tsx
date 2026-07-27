"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getSettings, setSettings, subscribeStore } from "@/lib/storage";
import { getSyncStatus, onSyncStatus } from "@/lib/sync/replicator";
import {
  firstStep,
  stepById,
  indexOf,
  totalSteps,
  nextStep as nextStepAfter,
  advancesOn,
  advancesOnRoute,
  isOnStepRoute,
  type TourStep,
  type TourEvent,
} from "@/lib/tour/steps";
import { TourOverlay, TourPeekBar } from "./TourOverlay";
import { WelcomeModal } from "./WelcomeModal";

// ---------------------------------------------------------------------------
// The guided tour (Phase 20). A layout-mounted controller that drives a calm,
// optional, interactive walkthrough of the core loop. It survives client-side
// route changes (the App Router keeps the layout mounted), so one tour flows
// across / -> /drift -> /trails/:id -> /atlas -> /interests. Steps live in
// src/lib/tour/steps.ts; forced steps advance on the real action (a route change
// or a `signal()` from the drift page). Fully skippable; honors §2 (agency) and
// §4 (works with the cloud off). Mounted inside AuthGate, so it never renders on
// the signed-out Landing.
// ---------------------------------------------------------------------------

interface TourContextValue {
  active: boolean;
  step: TourStep | null;
  index: number;
  total: number;
  // True while the user is "looking around" (peek mode): the drift page holds its
  // navigation (swipe / thread / End / cross) so the user can read without
  // accidentally leaving the card they're studying.
  holdNav: boolean;
  peeking: boolean;
  start: () => void;
  stop: () => void;
  next: () => void;
  peek: () => void;
  resumePeek: () => void;
  signal: (event: TourEvent) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

// Resume an in-progress tour across a hard reload (a nice-to-have; the durable
// "done" state lives in synced settings, not here).
const SESSION_KEY = "drift-tour-step";

function readSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
function writeSession(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode: resume-on-reload simply won't work, which is harmless */
  }
}

// Resolve once the initial cloud pull has settled (so a returning device whose
// local settings are momentarily empty doesn't get a false welcome), or after a
// short timeout / a remote settings merge. Immediate when already idle.
function waitForSyncSettle(timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (getSyncStatus() === "idle") {
      resolve();
      return;
    }
    let settled = false;
    const cleanups: Array<() => void> = [];
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanups.forEach((c) => c());
      resolve();
    };
    cleanups.push(onSyncStatus((s) => s === "idle" && finish()));
    cleanups.push(
      subscribeStore((e) => e.store === "settings" && e.source === "remote" && finish()),
    );
    const t = setTimeout(finish, timeoutMs);
    cleanups.push(() => clearTimeout(t));
  });
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { user, loading, cloudConfigured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [active, setActive] = useState(false);
  const [stepId, setStepId] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  // "Look around" peek: the coach + scrim step aside so the user can read the app.
  const [peeking, setPeeking] = useState(false);

  const step = stepId ? (stepById(stepId) ?? null) : null;

  // ----- lifecycle -----
  const finishTour = useCallback(() => {
    setActive(false);
    setStepId(null);
    setPeeking(false);
    writeSession(null);
    // Mark done so the welcome never auto-offers again (synced across devices).
    void setSettings({ tourStatus: "done" });
  }, []);

  const advance = useCallback(() => {
    if (!stepId) return;
    const nxt = nextStepAfter(stepId, { cloud: cloudConfigured });
    setPeeking(false); // a new step always starts with the coach shown
    if (!nxt) {
      finishTour();
      return;
    }
    setStepId(nxt.id);
    writeSession(nxt.id);
  }, [stepId, cloudConfigured, finishTour]);

  const start = useCallback(() => {
    setWelcomeOpen(false);
    setPeeking(false);
    const first = firstStep();
    setActive(true);
    setStepId(first.id);
    writeSession(first.id);
    // The route-orchestration effect escorts us to the first step's route if
    // we're not already there.
  }, []);

  const stop = useCallback(() => finishTour(), [finishTour]);
  const next = useCallback(() => advance(), [advance]);

  /**
   * "Skip this step" — the escape hatch on a forced step. It cannot just call
   * `advance()`, because some later steps are anchored to a route you can only
   * REACH by doing the thing that was skipped: the trail view needs a trail you
   * saved and opened. Those steps are marked `match: "prefix"`, and the route
   * orchestrator below deliberately pauses instead of navigating to them, so the
   * overlay would simply stop rendering and the tour would appear to end early
   * (it really did: skipping "open your trail" swallowed the trail, Atlas,
   * Interests and outro steps). So a skip walks forward to the next step we can
   * actually show.
   */
  const skipStep = useCallback(() => {
    if (!stepId) return;

    // Can this step actually be shown from where we now stand?
    const showable = (s: TourStep): boolean => {
      // Anchored to a route only the skipped action could have reached.
      if ((s.routeMatch ?? "exact") === "prefix" && !isOnStepRoute(s, pathname)) {
        return false;
      }
      // On THIS route but pointing at something that is not on screen, because
      // the action that would have revealed it is the one just skipped: skipping
      // "End when you like" leaves "Your trail" and "Keep it close" describing a
      // trail map the user never opened. Only checked for the current route;
      // a step on another route gets its chance once we navigate there (its
      // target may legitimately still be loading).
      if (s.target && isOnStepRoute(s, pathname)) {
        return !!document.querySelector(`[data-tour="${s.target}"]`);
      }
      return true;
    };

    let cursor = stepId;
    for (let guard = 0; guard < totalSteps + 1; guard++) {
      const nxt = nextStepAfter(cursor, { cloud: cloudConfigured });
      if (!nxt) break;
      if (showable(nxt)) {
        setPeeking(false);
        setStepId(nxt.id);
        writeSession(nxt.id);
        return;
      }
      cursor = nxt.id;
    }
    finishTour();
  }, [stepId, cloudConfigured, pathname, finishTour]);
  const peek = useCallback(() => setPeeking(true), []);
  const resumePeek = useCallback(() => setPeeking(false), []);

  const signal = useCallback(
    (event: TourEvent) => {
      if (!active) return;
      const cur = stepId ? stepById(stepId) : null;
      if (cur && advancesOn(cur, event)) advance();
    },
    [active, stepId, advance],
  );

  const dismissWelcome = useCallback(() => {
    setWelcomeOpen(false);
    void setSettings({ tourStatus: "done" });
  }, []);

  // ----- resume across a hard reload -----
  const decidedRef = useRef(false);
  useEffect(() => {
    if (decidedRef.current) return;
    const resumed = readSession();
    if (resumed && stepById(resumed)) {
      decidedRef.current = true;
      // Defer off the effect body (React 19 render-purity rule).
      queueMicrotask(() => {
        setActive(true);
        setStepId(resumed);
      });
    }
  }, []);

  // ----- auto-offer the welcome once per account -----
  useEffect(() => {
    if (loading) return; // auth still resolving
    if (cloudConfigured && !user) return; // signed out: the Landing shows instead
    if (decidedRef.current) return; // already resumed or decided this mount
    decidedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const s = await getSettings();
        if (s.tourStatus === "done") return;
      } catch {
        /* storage unavailable: fall through and offer */
      }
      if (cancelled) return;
      // Local (no cloud): decide now. Cloud: wait for the initial pull to settle
      // so a returning device doesn't get a false welcome, then re-check.
      if (cloudConfigured) {
        await waitForSyncSettle();
        if (cancelled) return;
        try {
          const s2 = await getSettings();
          if (s2.tourStatus === "done") return;
        } catch {
          /* fall through */
        }
      }
      if (!cancelled) setWelcomeOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, cloudConfigured]);

  // Flag the tour on <html> for the length of it. globals.css uses this to step
  // the storage notice aside: both are bottom-anchored on a phone, and the notice
  // was landing on top of the very controls the tour spotlights. An attribute
  // rather than context because the notice is mounted in the ROOT layout, outside
  // this provider (it has to appear on the signed-out landing too).
  useEffect(() => {
    const root = document.documentElement;
    if (active || welcomeOpen) root.setAttribute("data-tour-active", "");
    else root.removeAttribute("data-tour-active");
    return () => root.removeAttribute("data-tour-active");
  }, [active, welcomeOpen]);

  // ----- route orchestration -----
  // Keep the user on the active step's route: advance on a forced navigation,
  // otherwise escort back to a concrete route if they've strayed. A prefix-route
  // step (reached only mid-flow) just pauses the overlay if we're not on it.
  useEffect(() => {
    if (!active || !step) return;
    if (advancesOnRoute(step, pathname)) {
      // Defer the state change off the effect body (React 19 render-purity rule).
      queueMicrotask(() => advance());
      return;
    }
    if (isOnStepRoute(step, pathname)) return;
    if ((step.routeMatch ?? "exact") === "prefix") return; // pause, don't navigate
    router.push(step.route);
  }, [active, stepId, pathname, step, advance, router]);

  const value = useMemo<TourContextValue>(
    () => ({
      active,
      step,
      index: stepId ? indexOf(stepId) : -1,
      total: totalSteps,
      holdNav: peeking,
      peeking,
      start,
      stop,
      next,
      peek,
      resumePeek,
      signal,
    }),
    [active, step, stepId, peeking, start, stop, next, peek, resumePeek, signal],
  );

  const onRoute = active && step ? isOnStepRoute(step, pathname) : false;

  return (
    <TourContext.Provider value={value}>
      {children}
      {welcomeOpen && (
        <WelcomeModal onStart={start} onDismiss={dismissWelcome} />
      )}
      {active && step && onRoute && !peeking && (
        <TourOverlay
          key={step.id}
          step={step}
          index={stepId ? indexOf(stepId) : 0}
          total={totalSteps}
          onNext={next}
          onSkipStep={skipStep}
          onSkip={stop}
          onPeek={step.explore ? peek : undefined}
        />
      )}
      {active && step && onRoute && peeking && (
        <TourPeekBar onResume={resumePeek} onSkip={stop} />
      )}
    </TourContext.Provider>
  );
}

/** Access the tour controller. Safe everywhere the provider wraps the tree; a
 *  stray call outside it gets an inert no-op controller (so nothing crashes). */
export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    return {
      active: false,
      step: null,
      index: -1,
      total: totalSteps,
      holdNav: false,
      peeking: false,
      start: () => {},
      stop: () => {},
      next: () => {},
      peek: () => {},
      resumePeek: () => {},
      signal: () => {},
    };
  }
  return ctx;
}
