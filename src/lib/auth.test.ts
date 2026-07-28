import { describe, it, expect } from "vitest";
import {
  parseOAuthProviders,
  humanizeAuthError,
  isAlreadyRegistered,
  passwordProblem,
  passwordHint,
  describeWeakPassword,
  ALREADY_REGISTERED,
  PASSWORD_RULES,
  parseAuthLink,
  describeLinkError,
  destinationFor,
} from "./auth";

// ---------------------------------------------------------------------------
// Email-link landing (/auth/confirm). These shapes are exactly what Supabase
// redirects with, captured from the live project while diagnosing the
// "clicked the link, landed signed out" bug.
// ---------------------------------------------------------------------------

describe("parseAuthLink", () => {
  it("reads a token_hash link, the shape that works in any browser", () => {
    expect(
      parseAuthLink({ search: "?token_hash=pkce_abc123&type=signup" }),
    ).toEqual({ kind: "token_hash", tokenHash: "pkce_abc123", type: "signup" });
  });

  it("reads every email link type", () => {
    for (const type of [
      "signup",
      "recovery",
      "invite",
      "magiclink",
      "email_change",
    ] as const) {
      expect(
        parseAuthLink({ search: `?token_hash=t&type=${type}` }),
      ).toEqual({ kind: "token_hash", tokenHash: "t", type });
    }
  });

  it("falls back to signup when the type is missing or unknown", () => {
    expect(parseAuthLink({ search: "?token_hash=t" })).toMatchObject({
      type: "signup",
    });
    expect(parseAuthLink({ search: "?token_hash=t&type=nonsense" })).toMatchObject(
      { type: "signup" },
    );
  });

  // The shape the bug reporter actually saw: usedrift.org/?code=<uuid>
  it("recognises a PKCE code link", () => {
    expect(
      parseAuthLink({ search: "?code=3b2c5f44-4dd7-4035-9cae-5aed4869977b" }),
    ).toEqual({ kind: "code" });
  });

  // What the same link produces when no PKCE challenge was registered.
  it("recognises implicit tokens in the fragment", () => {
    expect(
      parseAuthLink({
        hash: "#access_token=eyJ&expires_in=3600&refresh_token=r&token_type=bearer&type=signup",
      }),
    ).toEqual({ kind: "tokens", type: "signup" });
  });

  it("finds errors in the query string or the fragment", () => {
    const q = parseAuthLink({
      search: "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    });
    expect(q.kind).toBe("error");
    expect(q.kind === "error" && q.code).toBe("otp_expired");
    expect(q.kind === "error" && q.message).toMatch(/expired/i);

    const h = parseAuthLink({
      hash: "#error=access_denied&error_code=otp_expired",
    });
    expect(h.kind).toBe("error");
  });

  it("prefers a reported error over any token in the same URL", () => {
    expect(
      parseAuthLink({
        search: "?token_hash=t&type=signup&error_code=otp_expired",
      }).kind,
    ).toBe("error");
  });

  it("returns none for an empty or irrelevant URL", () => {
    expect(parseAuthLink({})).toEqual({ kind: "none" });
    expect(parseAuthLink({ search: "", hash: "" })).toEqual({ kind: "none" });
    expect(parseAuthLink({ search: "?utm_source=x" })).toEqual({ kind: "none" });
  });

  it("tolerates the leading ? and # being present or absent", () => {
    expect(parseAuthLink({ search: "token_hash=t&type=recovery" })).toMatchObject({
      kind: "token_hash",
      type: "recovery",
    });
    expect(parseAuthLink({ hash: "access_token=a&type=recovery" })).toEqual({
      kind: "tokens",
      type: "recovery",
    });
  });
});

describe("describeLinkError", () => {
  it("explains an expired link plainly", () => {
    expect(describeLinkError("otp_expired")).toMatch(/expired/i);
    expect(describeLinkError("access_denied")).toMatch(/no longer valid/i);
  });

  it("decodes a raw description when the code is unfamiliar", () => {
    expect(describeLinkError("weird_code", "Something+odd+happened")).toBe(
      "Something odd happened",
    );
  });

  it("always says something", () => {
    expect(describeLinkError(null).length).toBeGreaterThan(0);
    expect(describeLinkError("", "").length).toBeGreaterThan(0);
  });

  it("uses no em or en dashes", () => {
    for (const c of ["otp_expired", "access_denied", "", null]) {
      expect(describeLinkError(c)).not.toMatch(/[—–]/);
    }
  });
});

describe("destinationFor", () => {
  it("sends a recovery link to the new-password screen and the rest to the feed", () => {
    expect(destinationFor("recovery")).toBe("/account/reset");
    expect(destinationFor("signup")).toBe("/");
    expect(destinationFor("magiclink")).toBe("/");
    expect(destinationFor(undefined)).toBe("/");
  });
});

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


// ---------------------------------------------------------------------------
// Sign-up: the silent "already registered" case.
//
// Shapes captured from the live project. Supabase's email-enumeration
// protection answers a sign-up for an existing CONFIRMED account with a fake
// success whose only tell is an EMPTY identities array, so the app used to
// promise a confirmation email that was never sent.
// ---------------------------------------------------------------------------

describe("isAlreadyRegistered", () => {
  it("spots the fake success returned for an existing confirmed account", () => {
    expect(isAlreadyRegistered({ identities: [] })).toBe(true);
  });

  // A real new sign-up AND a resend for an existing UNCONFIRMED account both
  // come back with one identity, and for both "check your email" is true.
  it("leaves a genuine sign-up and a genuine resend alone", () => {
    expect(isAlreadyRegistered({ identities: [{ id: "x" }] })).toBe(false);
  });

  it("says no when there is nothing to judge", () => {
    expect(isAlreadyRegistered(null)).toBe(false);
    expect(isAlreadyRegistered(undefined)).toBe(false);
    // Older/other responses may omit identities entirely: never guess from that.
    expect(isAlreadyRegistered({})).toBe(false);
    expect(isAlreadyRegistered({ identities: null })).toBe(false);
  });

  it("has one shared message, whichever way the backend refuses", () => {
    expect(humanizeAuthError({ message: "User already registered" })).toBe(
      ALREADY_REGISTERED,
    );
  });
});

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

describe("passwordProblem", () => {
  it("accepts a password that meets every rule", () => {
    expect(passwordProblem("Drift-test-pw-9134")).toBeNull();
    expect(passwordProblem("aB3aB3aB")).toBeNull();
  });

  it("rejects one that is too short, even with every character class", () => {
    expect(passwordProblem("aB3aB3a")).toBe(passwordHint());
    expect(passwordProblem("")).toBe(passwordHint());
  });

  it("rejects a missing character class", () => {
    expect(passwordProblem("alllowercase1")).toBe(passwordHint()); // no capital
    expect(passwordProblem("ALLUPPERCASE1")).toBe(passwordHint()); // no lower
    expect(passwordProblem("NoDigitsHere")).toBe(passwordHint()); // no number
  });

  it("states the real minimum length", () => {
    expect(passwordHint()).toContain(String(PASSWORD_RULES.minLength));
  });

  it("uses no em or en dashes", () => {
    expect(passwordHint()).not.toMatch(/[—–]/);
  });
});

describe("describeWeakPassword", () => {
  // The verbatim refusal from the live project: it spells out both alphabets.
  const RAW =
    "Password should be at least 8 characters. Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.";

  it("replaces the alphabet dump with something readable", () => {
    const out = describeWeakPassword(RAW);
    expect(out).toBe(
      "Please choose a password of at least 8 characters, with a lower case letter, a capital letter and a number.",
    );
    expect(out).not.toContain("abcdefghij");
  });

  it("reads the length out of the message, so it follows the server's rule", () => {
    expect(describeWeakPassword("Password should be at least 12 characters.")).toContain(
      "at least 12 characters",
    );
  });

  it("names only the classes actually required", () => {
    const out = describeWeakPassword(
      "Password should be at least 6 characters. Password should contain at least one character of each: 0123456789.",
    );
    expect(out).toContain("a number");
    expect(out).not.toContain("capital");
  });

  it("routes through humanizeAuthError, by code or by message", () => {
    expect(humanizeAuthError({ message: RAW, status: 422 })).not.toContain("abcdefghij");
    expect(
      humanizeAuthError({ message: RAW, status: 422, code: "weak_password" } as never),
    ).toContain("at least 8 characters");
  });
});
