// Small, pure auth helpers (kept React/DOM-free so they're unit-testable —
// CLAUDE.md §5). The OAuth provider list is driven by an env var so the app only
// ever shows buttons for providers actually enabled in Supabase (no dead
// buttons): NEXT_PUBLIC_OAUTH_PROVIDERS="google" or "google,apple". Empty /
// unset ⇒ no OAuth UI.

export type OAuthProvider = "google" | "apple";

const KNOWN: readonly OAuthProvider[] = ["google", "apple"];

/** Parse the comma-separated env list into a de-duped, order-preserving list of
 *  known providers. Unknown tokens, blanks, and casing/whitespace are ignored. */
export function parseOAuthProviders(raw?: string | null): OAuthProvider[] {
  if (!raw) return [];
  const seen = new Set<OAuthProvider>();
  for (const token of raw.split(",")) {
    const p = token.trim().toLowerCase();
    if ((KNOWN as readonly string[]).includes(p)) seen.add(p as OAuthProvider);
  }
  return KNOWN.filter((p) => seen.has(p));
}

/** Display metadata for each provider (the label + which brand mark to draw).
 *  The SVG itself lives in the button component; this stays data-only/pure. */
export const OAUTH_META: Record<OAuthProvider, { label: string }> = {
  google: { label: "Continue with Google" },
  apple: { label: "Continue with Apple" },
};

/** Which flow an auth error came from, so the fallback copy can be specific. */
export type AuthErrorKind = "signup" | "reset" | "generic";

/** The shape of a Supabase AuthError we care about (structurally typed so this
 *  stays DOM/SDK-free and unit-testable). */
export interface AuthErrorLike {
  message?: string;
  status?: number;
  name?: string;
}

// supabase-js maps any 5xx to an AuthRetryableFetchError whose message is a
// stringified fetch Response, i.e. the literal string "{}" — the real reason
// (e.g. GoTrue's "Error sending confirmation email") is never surfaced. During an
// email-sending step a 5xx almost always means the transactional email failed to
// send (an SMTP problem), so we translate these opaque errors into calm, honest
// copy instead of showing "{}". Genuine 4xx messages (wrong password, user exists,
// weak password) are informative, so they pass through unchanged.
export function humanizeAuthError(
  error: AuthErrorLike | null | undefined,
  kind: AuthErrorKind = "generic",
): string {
  const msg = (error?.message ?? "").trim();
  const status = error?.status;
  const opaque = msg === "" || msg === "{}" || msg === "null" || msg === "undefined";
  const serverish =
    (typeof status === "number" && status >= 500) ||
    error?.name === "AuthRetryableFetchError";

  if (serverish || opaque) {
    if (kind === "signup") {
      return "We couldn't send the confirmation email just now. Please try again in a little while.";
    }
    if (kind === "reset") {
      return "We couldn't send the reset email just now. Please try again in a little while.";
    }
    return "Something went wrong on our end. Please try again in a little while.";
  }
  return FRIENDLY_4XX[msg] ?? msg;
}

// ---------------------------------------------------------------------------
// Email-link landing (the /auth/confirm route).
//
// THE BUG THIS EXISTS TO FIX. Drift signs up with the PKCE flow, which stores a
// `code_verifier` in the localStorage of the browser that started the sign-up
// and returns the user to `/?code=<uuid>`. Exchanging that code REQUIRES the
// verifier, so the confirmation link only works in the exact browser profile
// that signed up. Click it on your phone after signing up on a laptop, or in a
// private tab, or in Gmail's in-app browser, and the exchange fails: you land
// signed out with no explanation. (Password-reset links had the same flaw.)
//
// The fix is Supabase's documented one: email links carry a `token_hash`, which
// `verifyOtp` redeems with NO client-side state, so it works in ANY browser.
// This parser is what /auth/confirm uses to tell the link shapes apart, and it
// is pure so every shape can be unit-tested without a browser.
// ---------------------------------------------------------------------------

/** The `type` an email link declares (Supabase's EmailOtpType). */
export type EmailOtpType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
];

export type AuthLink =
  /** The good shape: redeemable anywhere via verifyOtp. */
  | { kind: "token_hash"; tokenHash: string; type: EmailOtpType }
  /** PKCE. supabase-js auto-exchanges it, but only where the verifier lives. */
  | { kind: "code" }
  /** Implicit flow: tokens in the fragment, picked up by detectSessionInUrl. */
  | { kind: "tokens"; type?: EmailOtpType }
  /** Supabase said no (expired link, already used, denied). */
  | { kind: "error"; code?: string; message: string }
  | { kind: "none" };

function asOtpType(raw: string | null): EmailOtpType | undefined {
  return OTP_TYPES.find((t) => t === raw);
}

/**
 * Classify an email link's landing URL. Supabase puts its answer in the query
 * string OR the fragment depending on the flow, and errors can arrive in either,
 * so both are searched. Order matters: an explicit error wins over everything,
 * then the redeemable token, then the flow-specific shapes.
 */
export function parseAuthLink(input: {
  search?: string | null;
  hash?: string | null;
}): AuthLink {
  const q = new URLSearchParams((input.search ?? "").replace(/^\?/, ""));
  const h = new URLSearchParams((input.hash ?? "").replace(/^#/, ""));
  const get = (key: string) => q.get(key) ?? h.get(key);

  const errorCode = get("error_code") ?? get("error") ?? undefined;
  if (errorCode) {
    return {
      kind: "error",
      code: errorCode,
      message: describeLinkError(errorCode, get("error_description")),
    };
  }

  const tokenHash = get("token_hash");
  if (tokenHash) {
    return {
      kind: "token_hash",
      tokenHash,
      // A link without a usable type is still redeemable as a signup, which is
      // the overwhelmingly common case and what Supabase's own default assumes.
      type: asOtpType(get("type")) ?? "signup",
    };
  }

  if (get("access_token")) return { kind: "tokens", type: asOtpType(get("type")) };
  if (q.get("code")) return { kind: "code" };
  return { kind: "none" };
}

/** Calm, plain copy for the errors Supabase puts in an email-link redirect. */
export function describeLinkError(
  code: string | null | undefined,
  description?: string | null,
): string {
  const c = (code ?? "").toLowerCase();
  if (c.includes("expired") || c === "otp_expired") {
    return "This link has expired. Links are only good for a short while, so please request a new one.";
  }
  if (c === "access_denied") {
    return "This link is no longer valid. It may already have been used. Please request a new one.";
  }
  // `error_description` arrives URL-encoded with "+" for spaces.
  const desc = (description ?? "").replace(/\+/g, " ").trim();
  return desc || "This link could not be used. Please request a new one.";
}

/** Where a successfully-redeemed link should land. A recovery link is the one
 *  that goes somewhere other than the feed: it exists to set a new password. */
export function destinationFor(type: EmailOtpType | undefined): string {
  return type === "recovery" ? "/account/reset" : "/";
}

// Supabase's own 4xx strings are accurate but clinical ("Invalid login
// credentials"), and they are the errors a real person hits most often. Restate
// the common ones in Drift's voice; anything unlisted still passes through
// verbatim, so a new upstream message is never swallowed.
const FRIENDLY_4XX: Record<string, string> = {
  "Invalid login credentials":
    "That email and password do not match. Try again, or reset your password below.",
  "User already registered":
    "There is already an account with that email. Try signing in instead.",
  "Email not confirmed":
    "Please confirm your email first. Check your inbox for the link we sent.",
  "Password should be at least 6 characters":
    "Please choose a password of at least 6 characters.",
  "New password should be different from the old password":
    "That is already your current password. Please choose a different one.",
};
