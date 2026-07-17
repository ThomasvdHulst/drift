import { describe, it, expect } from "vitest";
import { edgesOf, resolveSwipe, isWheelReadingScroll } from "./gesture";

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

describe("resolveSwipe", () => {
  const inside = {
    threshold: 50,
    insideRegion: true,
    atTopStart: true,
    atBottomStart: true,
  };

  it("ignores swipes below the threshold", () => {
    expect(resolveSwipe({ ...inside, deltaY: 20 })).toBe("none");
    expect(resolveSwipe({ ...inside, deltaY: -20 })).toBe("none");
  });

  it("outside any region: up advances, down goes back", () => {
    const outside = {
      threshold: 50,
      insideRegion: false,
      atTopStart: false,
      atBottomStart: false,
    };
    expect(resolveSwipe({ ...outside, deltaY: 80 })).toBe("advance");
    expect(resolveSwipe({ ...outside, deltaY: -80 })).toBe("back");
  });

  it("inside at the bottom edge: swipe up advances (overscroll)", () => {
    expect(
      resolveSwipe({ ...inside, atTopStart: false, atBottomStart: true, deltaY: 80 }),
    ).toBe("advance");
  });

  it("inside mid-content: swipe up reads (none), never advances", () => {
    expect(
      resolveSwipe({ ...inside, atTopStart: false, atBottomStart: false, deltaY: 80 }),
    ).toBe("none");
  });

  it("inside at the top edge: swipe down goes back (overscroll)", () => {
    expect(
      resolveSwipe({ ...inside, atTopStart: true, atBottomStart: false, deltaY: -80 }),
    ).toBe("back");
  });

  it("inside mid-content: swipe down reads (none), never goes back", () => {
    expect(
      resolveSwipe({ ...inside, atTopStart: false, atBottomStart: false, deltaY: -80 }),
    ).toBe("none");
  });

  it("a non-scrollable card (both edges) swipes freely both ways", () => {
    expect(resolveSwipe({ ...inside, deltaY: 80 })).toBe("advance");
    expect(resolveSwipe({ ...inside, deltaY: -80 })).toBe("back");
  });
});

describe("isWheelReadingScroll", () => {
  const base = {
    insideRegion: true,
    scrollable: true,
    atTop: false,
    atBottom: false,
  };

  it("never reads outside a region", () => {
    expect(isWheelReadingScroll({ ...base, insideRegion: false, deltaY: 10 })).toBe(
      false,
    );
  });

  it("never reads a non-scrollable region", () => {
    expect(isWheelReadingScroll({ ...base, scrollable: false, deltaY: 10 })).toBe(
      false,
    );
  });

  it("scrolling down mid-content reads", () => {
    expect(isWheelReadingScroll({ ...base, deltaY: 10 })).toBe(true);
  });

  it("scrolling down at the bottom hands off to advance", () => {
    expect(isWheelReadingScroll({ ...base, atBottom: true, deltaY: 10 })).toBe(false);
  });

  it("scrolling up mid-content reads", () => {
    expect(isWheelReadingScroll({ ...base, deltaY: -10 })).toBe(true);
  });

  it("scrolling up at the top hands off to back", () => {
    expect(isWheelReadingScroll({ ...base, atTop: true, deltaY: -10 })).toBe(false);
  });
});
