import { describe, it, expect } from "vitest";
import { parseOAuthProviders, humanizeAuthError } from "./auth";

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

describe("humanizeAuthError", () => {
  it('turns the opaque "{}" (supabase 5xx) into calm, context-specific copy', () => {
    // What actually happens today: a failed confirmation email is a 500 that
    // supabase-js surfaces as message "{}".
    expect(humanizeAuthError({ message: "{}" }, "signup")).toMatch(/confirmation email/i);
    expect(humanizeAuthError({ message: "{}" }, "reset")).toMatch(/reset email/i);
    expect(humanizeAuthError({ message: "{}" }, "generic")).toMatch(/our end/i);
  });

  it("treats any 5xx / AuthRetryableFetchError as a server-side problem", () => {
    expect(humanizeAuthError({ status: 500, message: "" }, "signup")).toMatch(
      /confirmation email/i,
    );
    expect(
      humanizeAuthError({ name: "AuthRetryableFetchError", message: "{}" }, "reset"),
    ).toMatch(/reset email/i);
  });

  it("passes through informative 4xx messages unchanged", () => {
    expect(
      humanizeAuthError({ status: 400, message: "Invalid login credentials" }, "generic"),
    ).toBe("Invalid login credentials");
    expect(
      humanizeAuthError({ status: 422, message: "User already registered" }, "signup"),
    ).toBe("User already registered");
  });

  it("handles empty / missing errors gracefully", () => {
    expect(humanizeAuthError(null, "generic")).toMatch(/our end/i);
    expect(humanizeAuthError({}, "signup")).toMatch(/confirmation email/i);
  });
});
