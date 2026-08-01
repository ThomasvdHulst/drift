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
// The published contact address.
//
// DSA Articles 11 and 12 require a point of contact for authorities and one for
// recipients of the service, both PUBLISHED and both allowing direct electronic
// communication. Article 3:15d(1)(b) BW wants an email address on the imprint
// for the same reason. `/contact`, `/privacy` and `/legal` all print this one.
//
// `contact@usedrift.org` is routed and confirmed working by the owner. It
// replaced `noreply@usedrift.org`, which also worked but read badly: an address
// beginning "noreply" tells a regulator not to write to it, which is the
// opposite of what Article 11 is for.
//
// NEXT_PUBLIC_, because the pages that print it are server-rendered public copy.
// `CONTACT_INBOX` is the separate server-side variable deciding where the
// contact FORM delivers; the two should normally be the same address.
// ---------------------------------------------------------------------------

const DEFAULT_CONTACT_ADDRESS = "contact@usedrift.org";

export function contactAddress(): string {
  return (process.env.NEXT_PUBLIC_CONTACT_ADDRESS ?? "").trim() ||
    DEFAULT_CONTACT_ADDRESS;
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

/**
 * The reading pages: real content, rendered to a signed-out visitor. This is the
 * SINGLE source of truth for that set. `AuthGate` lets these through the login
 * gate and `sitemap.ts` submits them, so a page cannot end up public but
 * unlisted, or listed but gated. Those two lists used to be maintained
 * separately, which is a standing invitation for exactly that mismatch.
 *
 * `/notes` is the index. Each published note is its own URL, allowed through by
 * `isPublicRoute` and added to the sitemap from the NOTES registry
 * (`lib/notes.ts`), so publishing one never means editing this list.
 */
export const PUBLIC_CONTENT_ROUTES = [
  "/about",
  "/how-it-works",
  "/principles",
  "/sources",
  "/faq",
  "/notes",
  "/colophon",
  "/privacy",
  "/terms",
  "/legal",
  "/install",
  "/contact",
] as const;

/**
 * Public, but nothing to index. `/auth/confirm` is where confirmation and
 * password-reset links land, so it MUST render signed out (behind the gate it
 * would show the landing page and silently swallow the token), but it is a
 * one-time landing strip with no content, so it stays out of the sitemap.
 */
export const PUBLIC_UTILITY_ROUTES = ["/auth/confirm"] as const;

/**
 * Public share links (Phase 27): `/s/<token>`.
 *
 * Prefix-matched rather than listed, because there is one URL per share and they
 * are created at runtime. Public by necessity: the whole point is that a person
 * with no Drift account can open what someone sent them.
 *
 * ⚠️ NOT indexable, and this is not a preference. Three reasons, any one of
 * which is sufficient: the content is someone's personal trail; the token is a
 * capability, so putting it in a search index hands it out; and a crawlable page
 * of Wikipedia extracts is republication, which is both the thing AdSense
 * rejected the site for once already and a far wider copyright surface than a
 * login-gated app. So `/s/` is deliberately absent from INDEXABLE_ROUTES,
 * `robots.ts` disallows it, and the page itself sends `noindex`.
 */
export const PUBLIC_SHARE_PREFIX = "/s/";

/** What search engines are pointed at: the landing page plus the reading pages.
 *  Individual notes are appended by `sitemap.ts` from the NOTES registry. */
export const INDEXABLE_ROUTES = ["/", ...PUBLIC_CONTENT_ROUTES] as const;

/** Whether a path renders without an account. The auth gate's allowlist.
 *  `/notes/<slug>` and `/s/<token>` are matched by prefix (one route per
 *  published note, one per share); deliberately with the trailing slash, so a
 *  route that merely starts with those letters is still gated. */
export function isPublicRoute(pathname: string): boolean {
  const exact: readonly string[] = [
    ...PUBLIC_CONTENT_ROUTES,
    ...PUBLIC_UTILITY_ROUTES,
  ];
  return (
    exact.includes(pathname) ||
    pathname.startsWith("/notes/") ||
    pathname.startsWith(PUBLIC_SHARE_PREFIX)
  );
}

/** Everything behind the gate: a crawler gets the sign-in screen, and the real
 *  content is one user's private data. `/api/` is machine-only. */
export const PRIVATE_ROUTES = [
  // Where email links land. Public so a signed-out visitor can redeem one, but
  // it is a one-time landing strip with nothing to index.
  "/auth/",
  "/drift",
  "/trails",
  "/atlas",
  "/interests",
  "/account",
  "/friends",
  "/inbox",
  "/api/",
] as const;
