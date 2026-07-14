import type { Thread } from "./types";

// ---------------------------------------------------------------------------
// "Drift" = advancing without choosing a thread. Per spec §8.2 it is a
// *semi-random* next card: roughly half the time it follows one of the current
// card's untapped related threads (instant, on-theme, no fetch), and half the
// time it jumps to a fully-random card — "feels organic, still surprising."
// RNG is injected for deterministic tests.
// ---------------------------------------------------------------------------

// Probability that a drift follows a related thread rather than a fully-random
// jump. The spec calls for a roughly even split. (An earlier build raised this
// to 0.85 to dodge Wikimedia burst rate-limits on the random endpoint — but that
// made drifting feel trapped on one subject, the "everything is Alaska" problem.
// The burst limiter is a non-issue at human drift pace, so we're back to ~50%.)
export const DRIFT_THREAD_BIAS = 0.5;

// Hard cap on how many drifts in a row may follow a related thread before the
// next drift is forced fully-random. Guarantees the subject changes at least
// this often even on an unlucky run of thread rolls, so a passive drifter can
// never get stuck circling one cluster.
export const MAX_THEME_RUN = 3;

export type DriftChoice =
  | { type: "thread"; thread: Thread }
  | { type: "random" };

export interface DriftOptions {
  rng?: () => number;
  // How many drifts in a row have already followed a related thread. Once this
  // reaches MAX_THEME_RUN, the next drift is forced random regardless of the roll.
  consecutiveThemeDrifts?: number;
}

export function pickDriftNext(
  untappedThreads: Thread[],
  opts: DriftOptions = {},
): DriftChoice {
  const { rng = Math.random, consecutiveThemeDrifts = 0 } = opts;

  const runCapped = consecutiveThemeDrifts >= MAX_THEME_RUN;
  if (!runCapped && untappedThreads.length > 0 && rng() < DRIFT_THREAD_BIAS) {
    return { type: "thread", thread: pickRandomThread(untappedThreads, rng)! };
  }
  return { type: "random" };
}

/**
 * Pick a uniformly-random thread from the list, or null if empty. Used both by
 * the drift roll above and as the degraded fallback when a random-card fetch
 * fails (a random thread keeps the degraded path varied vs. always the top one).
 * Lives here (not inline in the component) so it stays pure + unit-testable and
 * out of React's render-purity path.
 */
export function pickRandomThread(
  threads: Thread[],
  rng: () => number = Math.random,
): Thread | null {
  if (threads.length === 0) return null;
  const idx = Math.min(Math.floor(rng() * threads.length), threads.length - 1);
  return threads[idx];
}
