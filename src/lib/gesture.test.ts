import { describe, it, expect } from "vitest";
import {
  CHAIN_SLACK,
  NO_PULL,
  PULL_THRESHOLD,
  edgePull,
  edgesOf,
  resolveHorizontalSwipe,
  type PullState,
} from "./gesture";

describe("resolveHorizontalSwipe (realm cross)", () => {
  it("crosses on a clearly horizontal swipe", () => {
    expect(resolveHorizontalSwipe({ deltaX: 120, deltaY: 10 })).toBe("cross");
    expect(resolveHorizontalSwipe({ deltaX: -120, deltaY: -10 })).toBe("cross"); // either direction
  });
  it("does NOT cross a mostly-vertical swipe (leaves it to the scroller)", () => {
    expect(resolveHorizontalSwipe({ deltaX: 80, deltaY: 200 })).toBe("none");
  });
  it("does NOT cross below the horizontal threshold", () => {
    expect(resolveHorizontalSwipe({ deltaX: 30, deltaY: 0 })).toBe("none");
  });
});

describe("edgesOf", () => {
  it("treats non-scrollable content as being at both edges", () => {
    expect(
      edgesOf({ scrollTop: 0, clientHeight: 500, scrollHeight: 500 }),
    ).toEqual({ scrollable: false, atTop: true, atBottom: true });
  });

  it("detects the top edge", () => {
    expect(
      edgesOf({ scrollTop: 0, clientHeight: 300, scrollHeight: 900 }),
    ).toMatchObject({ scrollable: true, atTop: true, atBottom: false });
  });

  it("detects the middle (neither edge)", () => {
    expect(
      edgesOf({ scrollTop: 300, clientHeight: 300, scrollHeight: 900 }),
    ).toMatchObject({ atTop: false, atBottom: false });
  });

  it("detects the bottom edge within tolerance", () => {
    // one px short of the true bottom still counts as "at bottom" (epsilon)
    expect(
      edgesOf({ scrollTop: 599, clientHeight: 301, scrollHeight: 900 }),
    ).toMatchObject({ atTop: false, atBottom: true });
  });
});

describe("edgePull (the scroll-chaining polyfill)", () => {
  // A card mid-article: the reader can still scroll down inside it.
  const reading = { atTop: false, atBottom: false, outerTop: 0 };
  // The same card scrolled to its end.
  const pinnedBottom = { atTop: false, atBottom: true, outerTop: 0 };
  const pinnedTop = { atTop: true, atBottom: false, outerTop: 0 };

  /** Feed a whole gesture through, one move at a time, and report the first
   *  action it produced (and how many moves it took to get there). */
  function gesture(
    moves: Array<Parameters<typeof edgePull>[1]>,
    from: PullState = NO_PULL,
  ) {
    let state = from;
    const actions: string[] = [];
    for (const m of moves) {
      const { next, action } = edgePull(state, m);
      state = next;
      actions.push(action);
    }
    return { state, actions, fired: actions.filter((a) => a !== "none") };
  }

  it("does not accrue while the article can still be read", () => {
    // Ten moves' worth of travel, far past the threshold, all mid-article.
    const moves = Array.from({ length: 10 }, () => ({ ...reading, dy: 40 }));
    const g = gesture(moves);
    expect(g.fired).toEqual([]);
    expect(g.state.pull).toBe(0);
  });

  it("hands off once the pull past the bottom clears the threshold", () => {
    const moves = Array.from({ length: 5 }, () => ({ ...pinnedBottom, dy: 30 }));
    const g = gesture(moves); // 30, 60, 90, 120 -> fires on the fourth
    expect(g.fired).toEqual(["forward"]);
    expect(g.actions.indexOf("forward")).toBe(
      Math.ceil(PULL_THRESHOLD / 30) - 1,
    );
  });

  it("hands off backwards at the top edge", () => {
    const moves = Array.from({ length: 5 }, () => ({ ...pinnedTop, dy: -30 }));
    expect(gesture(moves).fired).toEqual(["back"]);
  });

  it("fires at most once per gesture", () => {
    const moves = Array.from({ length: 20 }, () => ({ ...pinnedBottom, dy: 30 }));
    expect(gesture(moves).fired).toEqual(["forward"]);
  });

  it("STANDS DOWN when the outer scroller is already moving (Chrome, Android)", () => {
    // Native chaining starts within ~20px of pinning, so by the time the budget
    // could fill, the feed has visibly moved and the polyfill must be inert.
    const moves = Array.from({ length: 10 }, (_, i) => ({
      ...pinnedBottom,
      dy: 30,
      outerTop: i * 20,
    }));
    expect(gesture(moves).fired).toEqual([]);
  });

  it("stays stood down even if the outer scroller stops moving later", () => {
    // `outerAt` is fixed at the pinning point, so a chaining browser that runs
    // into its own snap boundary cannot hand the gesture back to us mid-way.
    const moves = [
      { ...pinnedBottom, dy: 30, outerTop: 0 },
      { ...pinnedBottom, dy: 30, outerTop: 40 },
      ...Array.from({ length: 8 }, () => ({ ...pinnedBottom, dy: 30, outerTop: 40 })),
    ];
    expect(gesture(moves).fired).toEqual([]);
  });

  it("tolerates the outer scroller jittering within the slack", () => {
    const moves = Array.from({ length: 5 }, () => ({
      ...pinnedBottom,
      dy: 30,
      outerTop: CHAIN_SLACK,
    }));
    expect(gesture(moves).fired).toEqual(["forward"]);
  });

  it("discards the budget when the finger reverses", () => {
    const g = gesture([
      { ...pinnedBottom, dy: 40 },
      { ...pinnedBottom, dy: 40 }, // 80, just short
      { atTop: false, atBottom: false, outerTop: 0, dy: -40 }, // back into the text
      { ...pinnedBottom, dy: 40 },
      { ...pinnedBottom, dy: 40 }, // 80 again, still short
    ]);
    expect(g.fired).toEqual([]);
  });

  it("discards the budget when the article can move again", () => {
    // "Read more" landing mid-gesture, or a lazy image growing the region: the
    // reader is no longer at an edge, so the pull stops counting.
    const g = gesture([
      { ...pinnedBottom, dy: 50 },
      { ...reading, dy: 50 },
      { ...pinnedBottom, dy: 50 },
    ]);
    expect(g.fired).toEqual([]);
    expect(g.state.pull).toBe(50);
  });

  it("leaves a horizontal gesture to the realm cross", () => {
    const moves = Array.from({ length: 6 }, () => ({
      ...pinnedBottom,
      dy: 30,
      totalX: 200,
      totalY: 120,
    }));
    expect(gesture(moves).fired).toEqual([]);
  });

  it("still hands off on a vertical gesture that drifted sideways a little", () => {
    const moves = Array.from({ length: 6 }, () => ({
      ...pinnedBottom,
      dy: 30,
      totalX: 40,
      totalY: 180,
    }));
    expect(gesture(moves).fired).toEqual(["forward"]);
  });

  it("a card whose text fits still hands off (both edges at once)", () => {
    // `edgesOf` reports a non-scrollable region as at BOTH edges. Every engine
    // picks the outer scroller for such a card, so in practice the stand-down
    // guard fires first — but the decision itself must not be undefined.
    const fits = { atTop: true, atBottom: true, outerTop: 0 };
    const moves = Array.from({ length: 5 }, () => ({ ...fits, dy: 30 }));
    expect(gesture(moves).fired).toEqual(["forward"]);
  });

  it("respects a caller-supplied threshold (the wheel's own budget)", () => {
    const moves = Array.from({ length: 4 }, () => ({
      ...pinnedBottom,
      dy: 100,
      threshold: 240,
    }));
    // 100, 200, 300 -> fires on the third, not on the second as it would at 96.
    expect(gesture(moves).actions).toEqual(["none", "none", "forward", "none"]);
  });
});
