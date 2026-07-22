// The canonical public origin for this deployment: where the app is actually
// reachable. Needed anywhere a link has to be absolute rather than app-relative
// — email bodies and logos (clients require absolute image URLs), and the
// sitemap / robots.txt (search engines index absolute URLs).
//
// `NEXT_PUBLIC_SITE_URL` overrides it for a different deployment; the fallback is
// the live site. Read as a static literal so Next inlines it (a computed lookup
// would come back undefined in the browser bundle).

const DEFAULT_SITE = "https://www.usedrift.org";

/** Normalise an origin: trim, drop any trailing slash, fall back if empty. */
export function normalizeSiteUrl(raw: string | undefined | null): string {
  const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_SITE;
}

/** This deployment's origin, with no trailing slash (so `${siteUrl()}/x` is safe). */
export function siteUrl(): string {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

// ---------------------------------------------------------------------------
// Which routes a search engine should see.
//
// Drift is login-gated whenever the cloud is configured (Phase 13), so most
// routes render the same sign-in screen to a crawler and hold nothing but one
// person's private trails. Submitting those would spend crawl budget on a pile
// of identical pages and invite soft-404 / duplicate-content flags, which makes
// the pages that DO have content harder to index. So the split is explicit here,
// and `sitemap.ts` + `robots.ts` both read it.
// ---------------------------------------------------------------------------

/** Routes that render real content to a signed-out visitor. `/` shows the
 *  landing page; the other three are AuthGate's PUBLIC_ROUTES allowlist. */
export const INDEXABLE_ROUTES = ["/", "/privacy", "/install", "/contact"] as const;

/** Everything behind the gate: a crawler gets the sign-in screen, and the real
 *  content is one user's private data. `/api/` is machine-only. */
export const PRIVATE_ROUTES = [
  "/drift",
  "/trails",
  "/atlas",
  "/interests",
  "/account",
  "/friends",
  "/inbox",
  "/api/",
] as const;
