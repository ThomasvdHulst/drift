import { describe, it, expect } from "vitest";
import { parseOAuthProviders } from "./auth";

describe("parseOAuthProviders", () => {
  it("returns [] for unset / empty / whitespace", () => {
    expect(parseOAuthProviders(undefined)).toEqual([]);
    expect(parseOAuthProviders(null)).toEqual([]);
    expect(parseOAuthProviders("")).toEqual([]);
    expect(parseOAuthProviders("   ")).toEqual([]);
  });

  it("parses a single provider", () => {
    expect(parseOAuthProviders("google")).toEqual(["google"]);
  });

  it("parses both, ignoring casing and whitespace", () => {
    expect(parseOAuthProviders(" Google , APPLE ")).toEqual(["google", "apple"]);
  });

  it("drops unknown tokens", () => {
    expect(parseOAuthProviders("google,github,facebook")).toEqual(["google"]);
    expect(parseOAuthProviders("nonsense")).toEqual([]);
  });

  it("de-dupes and returns a stable order (google before apple)", () => {
    expect(parseOAuthProviders("apple,google,apple")).toEqual(["google", "apple"]);
  });
});
