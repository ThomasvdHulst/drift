import { describe, it, expect } from "vitest";
import { feedMode, parseContinuousEnabled } from "./feedmode";

describe("parseContinuousEnabled", () => {
  it("is on only for an exact 1", () => {
    expect(parseContinuousEnabled({ NEXT_PUBLIC_FEED_CONTINUOUS: "1" })).toBe(true);
  });

  // Off means the app that shipped, so every ambiguous value resolves that way
  // rather than being generously interpreted.
  it("is off for anything else", () => {
    for (const v of [undefined, "", "0", "true", "yes", "2", " 1"]) {
      expect(parseContinuousEnabled({ NEXT_PUBLIC_FEED_CONTINUOUS: v })).toBe(false);
    }
  });
});

describe("feedMode", () => {
  it("gives the continuous shell when the flag is on", () => {
    expect(feedMode({ enabled: true })).toBe("continuous");
    expect(feedMode({ enabled: true, param: null })).toBe("continuous");
  });

  // The point of the override: compare the two feeds on one build, mid-session,
  // without rebuilding and losing your place.
  it("lets ?feed=classic send you back", () => {
    expect(feedMode({ enabled: true, param: "classic" })).toBe("classic");
  });

  // ⚠️ A URL is untrusted input and the continuous shell is unfinished. No
  // parameter may switch it ON, so a deployment that has not opted in cannot be
  // talked into serving it by anyone who guesses the parameter name.
  it("cannot be switched ON by a URL", () => {
    for (const v of ["continuous", "classic", "1", "", null, undefined]) {
      expect(feedMode({ enabled: false, param: v })).toBe("classic");
    }
  });

  it("ignores a value it does not recognise", () => {
    expect(feedMode({ enabled: true, param: "banana" })).toBe("continuous");
    expect(feedMode({ enabled: true, param: "CLASSIC" })).toBe("continuous");
  });
});
