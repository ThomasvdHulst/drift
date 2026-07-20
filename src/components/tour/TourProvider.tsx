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
import { TourOverlay } from "./TourOverlay";
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
  start: () => void;
  stop: () => void;
  next: () => void;
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

  const step = stepId ? (stepById(stepId) ?? null) : null;

  // ----- lifecycle -----
  const finishTour = useCallback(() => {
    setActive(false);
    setStepId(null);
    writeSession(null);
    // Mark done so the welcome never auto-offers again (synced across devices).
    void setSettings({ tourStatus: "done" });
  }, []);

  const advance = useCallback(() => {
    if (!stepId) return;
    const nxt = nextStepAfter(stepId, { cloud: cloudConfigured });
    if (!nxt) {
      finishTour();
      return;
    }
    setStepId(nxt.id);
    writeSession(nxt.id);
  }, [stepId, cloudConfigured, finishTour]);

  const start = useCallback(() => {
    setWelcomeOpen(false);
    const first = firstStep();
    setActive(true);
    setStepId(first.id);
    writeSession(first.id);
    // The route-orchestration effect escorts us to the first step's route if
    // we're not already there.
  }, []);

  const stop = useCallback(() => finishTour(), [finishTour]);
  const next = useCallback(() => advance(), [advance]);

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
      start,
      stop,
      next,
      signal,
    }),
    [active, step, stepId, start, stop, next, signal],
  );

  const onRoute = active && step ? isOnStepRoute(step, pathname) : false;

  return (
    <TourContext.Provider value={value}>
      {children}
      {welcomeOpen && (
        <WelcomeModal onStart={start} onDismiss={dismissWelcome} />
      )}
      {active && step && onRoute && (
        <TourOverlay
          key={step.id}
          step={step}
          index={stepId ? indexOf(stepId) : 0}
          total={totalSteps}
          onNext={next}
          onSkip={stop}
        />
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
      start: () => {},
      stop: () => {},
      next: () => {},
      signal: () => {},
    };
  }
  return ctx;
}
