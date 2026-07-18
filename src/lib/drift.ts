import type { Thread } from "./types";

// ---------------------------------------------------------------------------
// "Drift" = advancing without choosing a thread. By default every drift is an
// INDEPENDENT random jump: two consecutive scrolls are unrelated, so passive
// scrolling never gets stuck circling one subject (the old behaviour chained
// 3–4 near-identical pages — same topic, different year — because a drift used
// to follow one of the current card's morelike neighbours ~half the time, and a
// neighbour of a neighbour stays in the same tight cluster).
//
// The one exception is an explicit signal: when you ♥-like a card you're saying
// "keep me in this stream", so the NEXT drift follows one of that card's related
// threads. Relatedness is now tied to a transparent, user-chosen positive signal
// (§2.1) instead of an opaque coin flip — like to stay, just scroll to wander.
// RNG is injected for deterministic tests.
// ---------------------------------------------------------------------------

export type DriftChoice =
  | { type: "thread"; thread: Thread }
  | { type: "random" };

export interface DriftOptions {
  rng?: () => number;
  // Whether the user explicitly ♥-liked the current card. Only then does a drift
  // follow one of the card's related threads ("stay in this stream"); otherwise
  // every drift is a fully-independent random jump.
  likedCurrent?: boolean;
}

export function pickDriftNext(
  untappedThreads: Thread[],
  opts: DriftOptions = {},
): DriftChoice {
  const { rng = Math.random, likedCurrent = false } = opts;

  // Liked → stay in the stream by following a (random) related thread. If the
  // threads haven't loaded yet, fall through to a random jump.
  if (likedCurrent && untappedThreads.length > 0) {
    return { type: "thread", thread: pickRandomThread(untappedThreads, rng)! };
  }
  return { type: "random" };
}

/**
 * Pick a uniformly-random thread from the list, or null if empty. Used both by
 * the liked-follow drift above and as the degraded fallback when a random-card
 * fetch fails (a random thread keeps the degraded path varied vs. always the
 * top one). Lives here (not inline in the component) so it stays pure +
 * unit-testable and out of React's render-purity path.
 */
export function pickRandomThread(
  threads: Thread[],
  rng: () => number = Math.random,
): Thread | null {
  if (threads.length === 0) return null;
  const idx = Math.min(Math.floor(rng() * threads.length), threads.length - 1);
  return threads[idx];
}
