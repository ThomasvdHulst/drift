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

// Deterministic but higher-cardinality / a touch more churn (discover batches,
// search suggestions, cross-realm doorways): fresh for an hour, stale for a day.
export const CACHE_MEDIUM: CacheProfile = { sMaxAge: 3_600, swr: 86_400 };

/**
 * Cache-Control value: the browser always revalidates (max-age=0) while the
 * shared CDN caches for s-maxage and may serve stale during revalidation. The
 * app also keeps its own in-memory client caches, so browser HTTP caching is
 * intentionally disabled; the win we want is the shared edge cache.
 */
export function cacheControl(p: CacheProfile): string {
  return `public, max-age=0, s-maxage=${p.sMaxAge}, stale-while-revalidate=${p.swr}`;
}

/** Spread into a NextResponse.json success response to enable edge caching. */
export function cacheHeaders(p: CacheProfile): { "Cache-Control": string } {
  return { "Cache-Control": cacheControl(p) };
}

/** For error / degraded / empty responses: never cache a transient failure. */
export const NO_STORE: { "Cache-Control": string } = { "Cache-Control": "no-store" };
