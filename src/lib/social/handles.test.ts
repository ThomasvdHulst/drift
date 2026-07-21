import { describe, it, expect } from "vitest";
import { normalizeHandle, isValidHandle, handleError } from "./handles";

describe("normalizeHandle", () => {
  it("trims, drops leading @, and lowercases", () => {
    expect(normalizeHandle("  @Thomas_01 ")).toBe("thomas_01");
    expect(normalizeHandle("@@ADA")).toBe("ada");
  });
});

describe("isValidHandle", () => {
  it("accepts 3–30 chars of a-z0-9_", () => {
    expect(isValidHandle("ada")).toBe(true);
    expect(isValidHandle("thomas_01")).toBe(true);
    expect(isValidHandle("a".repeat(30))).toBe(true);
  });
  it("rejects too short / too long / bad chars", () => {
    expect(isValidHandle("ab")).toBe(false);
    expect(isValidHandle("a".repeat(31))).toBe(false);
    expect(isValidHandle("Ada")).toBe(false); // uppercase (normalize first)
    expect(isValidHandle("has space")).toBe(false);
    expect(isValidHandle("dash-no")).toBe(false);
  });
});

describe("handleError", () => {
  it("returns null for a valid handle", () => {
    expect(handleError("ada_lovelace")).toBeNull();
  });
  it("explains length + character problems", () => {
    expect(handleError("ab")).toMatch(/3 characters/);
    expect(handleError("a".repeat(31))).toMatch(/30 characters/);
    expect(handleError("bad-char")).toMatch(/lowercase letters/);
  });

  // handleError re-derives the rule as three separate checks rather than reusing
  // the regex, so the two can disagree. Sign-up would then either reject a handle
  // with no reason given, or accept one the DB constraint rejects.
  it("agrees with isValidHandle on every case", () => {
    const cases = [
      "ada",
      "thomas_01",
      "a".repeat(30),
      "a".repeat(31),
      "ab",
      "",
      "Ada",
      "has space",
      "bad-char",
      "emoji_🐙",
      "___",
      "123",
    ];
    for (const h of cases) {
      expect(handleError(h) === null).toBe(isValidHandle(h));
    }
  });
});
