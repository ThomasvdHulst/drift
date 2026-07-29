import { TOPICS, type Topic, type TopicId } from "./topics";
import { pickRandom } from "./pick";

// ---------------------------------------------------------------------------
// Pure topic-sampling + list helpers for the "interesting random" drift buffer.
// No network here (the /api/realm/[realm]/discover route fetches). RNG is injected for
// deterministic tests. `uniformTopic` is the cold-start pick (M8); the interest
// model (M9) supplies weights to `weightedTopic`.
// ---------------------------------------------------------------------------

/**
 * A bounded random offset into a topic's incoming-links-sorted results. Kept
 * small so drifted cards stay recognizable/interesting (deep offsets get
 * obscure) while still varying which popular pages surface.
 *
 * `step` is the size of the window the caller is about to ask for, and passing it
 * is what makes the result CACHEABLE. Left to itself this returns any integer in
 * 0..400, so a 4-card window could start at 0, 1, 2, 3… — 401 different URLs per
 * topic, roughly 11,000 across the registry, which is why the shared edge cache
 * almost never saw the same discover URL twice and every reader paid for their
 * own upstream call. Aligned to the window size the offsets land on whole pages
 * (0, 4, 8 …), so windows TILE instead of overlapping: the same range, the same
 * cards, about a fifth of the URLs, and no page half-served at two offsets.
 *
 * The default of 1 keeps the old behaviour for any caller that has no window.
 */
export function randomOffset(
  rng: () => number = Math.random,
  max = 400,
  step = 1,
): number {
  const size = Math.max(1, Math.floor(step));
  const pages = Math.floor(max / size);
  return Math.floor(rng() * (pages + 1)) * size;
}

/** Uniformly-random topic over the whole registry (cold start / serendipity). */
export function uniformTopic(rng: () => number = Math.random): Topic {
  return pickRandom(TOPICS, rng)!; // TOPICS is a non-empty static registry
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
