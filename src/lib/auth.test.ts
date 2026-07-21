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

  it("restates the common 4xx messages in Drift's voice", () => {
    // These are the two errors a real person hits most often, so they must not
    // reach the screen as raw Supabase strings.
    expect(
      humanizeAuthError({ status: 400, message: "Invalid login credentials" }, "generic"),
    ).toMatch(/do not match/i);
    expect(
      humanizeAuthError({ status: 422, message: "User already registered" }, "signup"),
    ).toMatch(/already an account/i);
  });

  it("passes through an unrecognized 4xx message unchanged", () => {
    // A message we haven't restated must never be swallowed.
    expect(
      humanizeAuthError({ status: 400, message: "Some new upstream rule" }, "generic"),
    ).toBe("Some new upstream rule");
  });

  it("handles empty / missing errors gracefully", () => {
    expect(humanizeAuthError(null, "generic")).toMatch(/our end/i);
    expect(humanizeAuthError({}, "signup")).toMatch(/confirmation email/i);
  });
});
