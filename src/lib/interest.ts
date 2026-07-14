import { TOPICS, type TopicId } from "./topics";
import { uniformTopic, weightedTopic } from "./discover";
import type { Topic } from "./topics";

// ---------------------------------------------------------------------------
// The gentle, transparent interest model (pure; RNG injected for tests).
//
// A weight per topic: BASE = neutral, > BASE = you like it, < BASE = you don't.
// Explicit ♥/✕ move a card's topics by ±STEP, clamped so a weight never hits 0
// (WEIGHT_FLOOR) — no topic is ever fully excluded — and never runs away
// (WEIGHT_CEIL). Only the DRIFT topic pick is biased by this; threads are never
// touched. A serendipity floor keeps ~30% of drifts a free wander.
//
// Transparency rule (§2.1): a drift is only labelled "because you like X" when X
// is genuinely up-weighted — never merely because the weighted sampler happened
// to land there. So `pickDriftTopic` derives the reason from the chosen topic's
// actual liked-status, not from which branch produced it.
// ---------------------------------------------------------------------------

export type Interest = Record<TopicId, number>;
export type Reaction = "like" | "dislike";

export const BASE = 1;
export const STEP = 0.5;
export const WEIGHT_FLOOR = 0.1;
export const WEIGHT_CEIL = 5;
export const SERENDIPITY = 0.3;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Whether a topic is one the user has actively up-weighted (liked). */
export function isLiked(interest: Interest, id: TopicId): boolean {
  return (interest[id] ?? BASE) > BASE;
}

/**
 * Apply a ♥/✕ to a page's topics: nudge each topic's weight by ±STEP, clamped to
 * [WEIGHT_FLOOR, WEIGHT_CEIL]. Returns a new Interest (pure).
 */
export function applyFeedback(
  interest: Interest,
  topicIds: TopicId[],
  signal: Reaction,
): Interest {
  const delta = signal === "like" ? STEP : -STEP;
  const next: Interest = { ...interest };
  for (const id of topicIds) {
    next[id] = clamp((next[id] ?? BASE) + delta, WEIGHT_FLOOR, WEIGHT_CEIL);
  }
  return next;
}

/** The full sampling distribution over every topic (missing → BASE). */
export function topicWeights(interest: Interest): Record<TopicId, number> {
  const w: Record<TopicId, number> = {};
  for (const t of TOPICS) w[t.id] = interest[t.id] ?? BASE;
  return w;
}

export interface PickOptions {
  serendipity?: number;
  rng?: () => number;
}

/**
 * Pick the topic for a random drift, plus a truthful reason for the card's
 * "why this appeared" line. With probability `serendipity` we pick uniformly (a
 * free wander that keeps every topic reachable); otherwise we pick weighted by
 * the interest map (liked topics common, disliked rare but never zero). Either
 * way the reason is "interest" only if the chosen topic is actually liked.
 */
export function pickDriftTopic(
  interest: Interest,
  opts: PickOptions = {},
): { topic: Topic; reason: "interest" | "wildcard" } {
  const { serendipity = SERENDIPITY, rng = Math.random } = opts;
  const topic =
    rng() < serendipity ? uniformTopic(rng) : weightedTopic(topicWeights(interest), rng);
  const reason = isLiked(interest, topic.id) ? "interest" : "wildcard";
  return { topic, reason };
}
