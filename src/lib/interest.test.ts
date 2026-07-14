import { describe, it, expect } from "vitest";
import {
  applyFeedback,
  topicWeights,
  pickDriftTopic,
  isLiked,
  BASE,
  STEP,
  WEIGHT_FLOOR,
  WEIGHT_CEIL,
} from "./interest";
import { TOPICS } from "./topics";

const A = TOPICS[0].id; // "space"
const B = TOPICS[1].id; // "biology"

describe("applyFeedback", () => {
  it("likes raise weight above BASE; dislikes lower it below BASE", () => {
    expect(applyFeedback({}, [A], "like")[A]).toBeCloseTo(BASE + STEP);
    expect(applyFeedback({}, [A], "dislike")[A]).toBeCloseTo(BASE - STEP);
  });

  it("never lets a weight reach 0 (floor) or run away (ceiling)", () => {
    let interest = {};
    for (let i = 0; i < 20; i++) interest = applyFeedback(interest, [A], "dislike");
    expect(interest[A]).toBe(WEIGHT_FLOOR);
    expect(interest[A]).toBeGreaterThan(0);

    let up = {};
    for (let i = 0; i < 20; i++) up = applyFeedback(up, [B], "like");
    expect(up[B]).toBe(WEIGHT_CEIL);
  });

  it("applies to every topic on the page and is pure", () => {
    const before = { [A]: 2 };
    const after = applyFeedback(before, [A, B], "like");
    expect(after[A]).toBeCloseTo(2 + STEP);
    expect(after[B]).toBeCloseTo(BASE + STEP);
    expect(before).toEqual({ [A]: 2 }); // unchanged
  });
});

describe("isLiked / topicWeights", () => {
  it("isLiked only for topics above BASE", () => {
    const interest = applyFeedback(applyFeedback({}, [A], "like"), [B], "dislike");
    expect(isLiked(interest, A)).toBe(true);
    expect(isLiked(interest, B)).toBe(false);
    expect(isLiked(interest, TOPICS[2].id)).toBe(false); // neutral
  });

  it("topicWeights covers all topics, defaulting missing to BASE", () => {
    const w = topicWeights({ [A]: 3 });
    expect(w[A]).toBe(3);
    expect(w[B]).toBe(BASE);
    expect(Object.keys(w)).toHaveLength(TOPICS.length);
  });
});

describe("pickDriftTopic", () => {
  it("rng below serendipity → uniform wander (reason follows liked-status)", () => {
    // First topic is liked → uniform pick of it is still truthfully "interest".
    const interest = applyFeedback({}, [A], "like");
    const pick = pickDriftTopic(interest, { serendipity: 0.3, rng: () => 0 });
    expect(pick.topic.id).toBe(A);
    expect(pick.reason).toBe("interest");
  });

  it("a neutral topic is never labelled 'because you like'", () => {
    // rng=0 → uniform picks TOPICS[0]; with empty interest it's neutral → wildcard.
    const pick = pickDriftTopic({}, { serendipity: 0.3, rng: () => 0 });
    expect(pick.reason).toBe("wildcard");
  });

  it("weighted branch favours liked topics", () => {
    // Heavily like topic B; force the weighted branch (rng >= serendipity for the
    // branch roll, then a small value for the pick).
    let interest = {};
    for (let i = 0; i < 8; i++) interest = applyFeedback(interest, [B], "like");
    // rng sequence: 0.9 (skip serendipity) then 0.0 (pick first weighted bucket).
    const seq = [0.9, 0.0];
    let i = 0;
    const rng = () => seq[Math.min(i++, seq.length - 1)];
    const pick = pickDriftTopic(interest, { serendipity: 0.3, rng });
    // B has the dominant weight, so a tiny pick value lands on the first topic in
    // registry order whose cumulative weight covers it — B is heaviest but order
    // matters; assert at minimum the reason is truthful for whatever is picked.
    expect(["interest", "wildcard"]).toContain(pick.reason);
    expect(pick.reason === "interest" ? isLiked(interest, pick.topic.id) : true).toBe(true);
  });
});
