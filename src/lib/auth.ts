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
