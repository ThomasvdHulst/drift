// Pure helpers for the CDN Cache-Control headers on the content proxy routes.
//
// Why this exists: every card costs live upstream calls (a summary + its
// threads), and once deployed ALL users egress through Vercel's shared IP, so
// they share ONE Wikimedia rate budget (see docs/beta-readiness.md, Q3). These
// proxy responses are deterministic by their query params and carry NO per-user
// data, so they're safe to cache PUBLICLY at Vercel's edge. Caching collapses
// overlapping requests across users — five people reading the same page cost one
// upstream fetch, not five — which is the real scaling lever.
//
// IMPORTANT: only apply these to SUCCESSFUL, non-degraded responses. The routes
// fall back to [] / {} / { topics: [] } on a throttle or upstream error; caching
// one of those as if it were real would freeze an empty result in place. Every
// error / empty branch must send NO_STORE instead.

export interface CacheProfile {
  /** Seconds the shared CDN may serve this as fresh (Vercel reads s-maxage). */
  sMaxAge: number;
  /** Seconds the CDN may serve a stale copy while it revalidates in the background. */
  swr: number;
}

// Deterministic content that changes rarely (a page summary, its threads, its
// topic labels): fresh for a day, serve-stale-while-revalidate for a week.
export const CACHE_STABLE: CacheProfile = { sMaxAge: 86_400, swr: 604_800 };

// Deterministic but higher-cardinality / a touch more churn (search
// suggestions, artist lookups): fresh for an hour, stale for a day.
export const CACHE_MEDIUM: CacheProfile = { sMaxAge: 3_600, swr: 86_400 };

// For an answer we BELIEVE but do not want to freeze: fresh for ten minutes,
// stale for an hour. It exists for "we looked and there is nothing there" —
// specifically the cross-realm doorway, which finds nothing about half the time.
// Those misses used to be NO_STORE, on the reasoning that a miss might be a
// transient failure rather than a real absence. That reasoning is right and the
// conclusion was too strong: it made the most repeated lookup in the app the one
// that never cached, so every reader re-asked it for every card. Ten minutes
// keeps a transient failure transient while stopping the repetition.
export const CACHE_SHORT: CacheProfile = { sMaxAge: 600, swr: 3_600 };

/**
 * Cache-Control value: the browser always revalidates (max-age=0) while the
 * shared CDN caches for s-maxage and may serve stale during revalidation. The
 * app also keeps its own in-memory client caches, so browser HTTP caching is
 * intentionally disabled; the win we want is the shared edge cache.
 */
export function cacheControl(p: CacheProfile): string {
  return `public, max-age=0, s-maxage=${p.sMaxAge}, stale-while-revalidate=${p.swr}`;
}

// ---------------------------------------------------------------------------
// The guard (compliance audit M-10).
//
// `Cache-Control: public` plus `s-maxage` on a shared edge is the standard
// mechanism by which authenticated responses leak between users. Today no route
// carrying one of these reads the session, so the risk is structural rather than
// actual: the day someone adds a personalised thread ordering or an
// interests-weighted batch to a cached route, the first user's response is
// served to everyone for up to 24 hours, and stale for a further 7 days. That is
// a personal data breach under Article 4(12) GDPR and notifiable under 33.
//
// A comment saying "do not do that" would not have survived. So the request is a
// REQUIRED argument: to cache anything you have to hand over the request that
// asked for it, and this looks at it. A route that is about to serve
// user-specific data cannot reach `cacheControl` without passing the very object
// that proves it.
//
// Failure mode is deliberately asymmetric. In development it THROWS, loudly, at
// the moment the mistake is made. In production it degrades to `no-store` and
// logs: a route that suddenly refuses to cache is a performance problem, and
// serving one reader's data to another is not a problem you fix later.
// ---------------------------------------------------------------------------

/** Cookie names that mean a Supabase session is present. Supabase names its
 *  auth cookie `sb-<project-ref>-auth-token`, sometimes chunked with a `.0`
 *  suffix, so this matches the shape rather than one literal name. */
const SESSION_COOKIE = /(^|;\s*)sb-[a-z0-9-]+-auth-token(\.\d+)?=/i;

/** Whether this request carries anything that identifies a signed-in user. */
export function carriesUserSession(request: Request): boolean {
  if (request.headers.get("authorization")) return true;
  const cookie = request.headers.get("cookie");
  return !!cookie && SESSION_COOKIE.test(cookie);
}

/**
 * Spread into a successful response to enable edge caching.
 *
 * Pass the request that asked for it. If it carries a session, this refuses:
 * see the block above for why the argument is not optional.
 */
export function cacheHeaders(
  p: CacheProfile,
  request: Request,
): { "Cache-Control": string } {
  if (carriesUserSession(request)) {
    const message =
      "[cache-headers] refusing to set a public, shared-CDN cache on a response to a request carrying a user session. " +
      "If this route must be both personalised and cached, use `Cache-Control: private, max-age=…` and never s-maxage.";
    if (process.env.NODE_ENV !== "production") throw new Error(message);
    console.error(message, new URL(request.url).pathname);
    return NO_STORE;
  }
  return { "Cache-Control": cacheControl(p) };
}

/** For error / degraded / empty responses: never cache a transient failure. */
export const NO_STORE: { "Cache-Control": string } = { "Cache-Control": "no-store" };
