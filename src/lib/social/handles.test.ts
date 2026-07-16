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
});
