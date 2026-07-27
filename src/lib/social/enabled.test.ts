import { describe, it, expect } from "vitest";
import { parseSocialFlag } from "./enabled";

describe("parseSocialFlag", () => {
  it("enables the social layer only for an explicit 1", () => {
    expect(parseSocialFlag("1")).toBe(true);
    expect(parseSocialFlag(" 1 ")).toBe(true);
  });

  // Opt-in on purpose: an unset or malformed env var must leave friends and
  // sharing hidden, never switch them on by accident.
  it("stays off for anything else", () => {
    for (const raw of [
      undefined,
      null,
      "",
      "  ",
      "0",
      "true",
      "yes",
      "on",
      "enabled",
      "2",
    ]) {
      expect(parseSocialFlag(raw), String(raw)).toBe(false);
    }
  });
});
