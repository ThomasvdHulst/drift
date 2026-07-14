import { TOPICS, type Topic, type TopicId } from "./topics";

// ---------------------------------------------------------------------------
// Pure topic-sampling + list helpers for the "interesting random" drift buffer.
// No network here (the /api/wiki/discover route fetches). RNG is injected for
// deterministic tests. `uniformTopic` is the cold-start pick (M8); the interest
// model (M9) supplies weights to `weightedTopic`.
// ---------------------------------------------------------------------------

/** A bounded random offset into a topic's incoming-links-sorted results. Kept
 * small so drifted cards stay recognizable/interesting (deep offsets get
 * obscure) while still varying which popular pages surface. */
export function randomOffset(rng: () => number = Math.random, max = 400): number {
  return Math.floor(rng() * (max + 1));
}

/** Uniformly-random topic over the whole registry (cold start / serendipity). */
export function uniformTopic(rng: () => number = Math.random): Topic {
  const i = Math.min(Math.floor(rng() * TOPICS.length), TOPICS.length - 1);
  return TOPICS[i];
}

/**
 * Weighted-random topic. `weights` maps topic id → non-negative weight; missing
 * ids count as 0. If every weight is 0 (or the map is empty) we fall back to a
 * uniform pick, so this is always safe to call.
 */
export function weightedTopic(
  weights: Record<TopicId, number>,
  rng: () => number = Math.random,
): Topic {
  let total = 0;
  for (const t of TOPICS) total += Math.max(0, weights[t.id] ?? 0);
  if (total <= 0) return uniformTopic(rng);

  let r = rng() * total;
  for (const t of TOPICS) {
    r -= Math.max(0, weights[t.id] ?? 0);
    if (r < 0) return t;
  }
  return TOPICS[TOPICS.length - 1]; // float-rounding guard
}

/**
 * Round-robin interleave of several arrays: [a0,b0,a1,b1,…]. Used to mix a
 * refill's per-topic batches so consecutive random drifts alternate topics
 * instead of running through one topic then the next.
 */
export function interleave<T>(arrays: T[][]): T[] {
  const out: T[] = [];
  const max = arrays.reduce((m, a) => Math.max(m, a.length), 0);
  for (let i = 0; i < max; i++) {
    for (const a of arrays) if (i < a.length) out.push(a[i]);
  }
  return out;
}
