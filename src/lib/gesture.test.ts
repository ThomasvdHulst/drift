import { describe, it, expect } from "vitest";
import { resolveHorizontalSwipe } from "./gesture";

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
