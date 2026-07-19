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
  return msg;
}
