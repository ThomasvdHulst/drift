// ---------------------------------------------------------------------------
// A per-caller token bucket for the API routes that cost more upstream than they
// cost to send (pre-flyer review, findings 02 and 03).
//
// WHY THIS EXISTS, AND WHY IT IS NOT ON EVERY ROUTE. The content routes are
// public on purpose: they carry no user data, so the CDN can cache them, which
// is the whole scaling lever (lib/cache-headers.ts). Being public also means
// signing up gates nothing, and `AuthGate` is a client component, so there is no
// door in front of `/api`.
//
// For most routes that is fine, because the gate in `upstream.ts` already bounds
// what reaches the source: one Wikimedia call per request, spaced 300 ms apart,
// is 3.3/s no matter how hard anyone pushes. The gate is the protection.
//
// It stops being enough where ONE inbound request becomes SEVERAL outbound ones,
// because then the attacker's cost and the source's cost come apart. Measured on
// 27 August 2026 with scripts/bots/upstream-count.mjs:
//
//     3 × /api/wiki/links (distinct titles)  →  18 en.wikipedia.org requests
//     5 × /api/img/met/…  (distinct names)   →  10 images.metmuseum.org requests
//     5 × /api/doorway    (distinct ids)     →   5 collectionapi requests
//
// So `wiki/links` multiplies by six and the image proxy by two, while the
// doorway is 1:1 and needs nothing. Both multipliers also defeat the edge cache
// trivially, by varying a free-text parameter, so every request is a miss.
//
// The effect is not theoretical. Twelve concurrent `wiki/links` calls took a
// normal card fetch from 0.47 s to 7.53 s and its threads to 12.41 s, because
// the shared gate is one queue and a real reader waits in it. Forty junk image
// requests took a real artwork from 0.32 s to 8.66 s.
//
// HONEST LIMIT, in the spirit of the SQL migrations'. This is one bucket per warm
// serverless instance, not a global one, so it is a speed bump rather than a
// guarantee, and it counts an ADDRESS rather than a person. That is the right
// trade here: the job is to stop one loud client from spending a shared upstream
// budget that every reader draws on, not to defeat somebody with a proxy pool.
// ---------------------------------------------------------------------------

export interface RateVerdict {
  /** Whether the request may proceed. */
  ok: boolean;
  /** Whole seconds to wait before a token exists again. Zero when `ok`. */
  retryAfterSec: number;
}

export interface RateLimiter {
  /** Spend one token for `key`. An empty key always passes: see below. */
  take(key: string, now?: number): RateVerdict;
  /** Buckets currently held. Exposed for the tests, not for callers. */
  size(): number;
}

export interface RateOptions {
  /** Tokens a caller may spend at once, from cold. Sized to a real burst. */
  burst: number;
  /** Tokens handed back per minute, i.e. the sustained rate. */
  perMinute: number;
  /** Buckets kept before the idle ones are swept. Bounds the memory. */
  maxKeys?: number;
}

/**
 * A token bucket per key.
 *
 * A BUCKET RATHER THAN A COUNTER, because real reading is bursty and abuse is
 * sustained. Opening a trail map asks for a dozen thumbnails in one moment; a
 * fixed "N per minute" counter either refuses that or is set so high it refuses
 * nothing. A bucket lets the burst through and then meters what follows, which
 * is the shape of the thing being limited.
 *
 * ⚠️ AN EMPTY KEY IS ALWAYS ALLOWED. `clientIpFromHeaders` returns "" when no
 * trustworthy address header is present, and bucketing every such caller
 * together would let one script lock the route for everybody who shares that
 * fate. Same rule, and the same reason, as the contact form's throttle.
 */
export function makeRateLimiter(opts: RateOptions): RateLimiter {
  const { burst, perMinute } = opts;
  const maxKeys = opts.maxKeys ?? 5_000;
  const perMs = perMinute / 60_000;
  /** How long a fully spent bucket takes to refill, for the idle sweep. */
  const fullRefillMs = burst / perMs;

  const buckets = new Map<string, { tokens: number; at: number }>();

  function sweep(now: number): void {
    for (const [k, b] of buckets) {
      if (now - b.at >= fullRefillMs) buckets.delete(k);
      if (buckets.size <= maxKeys) break;
    }
    // A sweep that freed nothing (every bucket is active) must still not let the
    // map grow without limit. Dropping the oldest is safe: a dropped bucket
    // simply starts full again, which errs towards letting a reader through.
    if (buckets.size > maxKeys) {
      const oldest = [...buckets.entries()]
        .sort((a, b) => a[1].at - b[1].at)
        .slice(0, buckets.size - maxKeys);
      for (const [k] of oldest) buckets.delete(k);
    }
  }

  return {
    take(key: string, now: number = Date.now()): RateVerdict {
      if (!key) return { ok: true, retryAfterSec: 0 };

      const b = buckets.get(key);
      const tokens = b
        ? Math.min(burst, b.tokens + (now - b.at) * perMs)
        : burst;

      if (tokens < 1) {
        // Report the wait honestly, so `Retry-After` means what it says.
        const waitMs = (1 - tokens) / perMs;
        buckets.set(key, { tokens, at: now });
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil(waitMs / 1000)) };
      }

      buckets.set(key, { tokens: tokens - 1, at: now });
      if (buckets.size > maxKeys) sweep(now);
      return { ok: true, retryAfterSec: 0 };
    },
    size: () => buckets.size,
  };
}

// ---------------------------------------------------------------------------
// The two buckets in use, sized from what the real callers actually do.
// ---------------------------------------------------------------------------

/**
 * `/api/wiki/links`, the six-to-one amplifier.
 *
 * The real caller is `UnopenedPage`, which fires ONCE when a trail exit opens
 * (`stopsToProbe` gives it 3 to 8 titles) and never during a drift. So a reader
 * who ended five trails in a minute would be extraordinary, and twelve is far
 * past anything a person does. This is deliberately the tightest limit in the
 * app, because this is the route where one request costs the most elsewhere.
 */
export const linksLimiter = makeRateLimiter({ burst: 12, perMinute: 12 });

/**
 * `/api/img/met/…`, the two-to-one amplifier.
 *
 * ⚠️ THIS IS THE BACKSTOP, NOT THE FIX. The fix for a loop over invented names
 * is that a miss is now a CACHEABLE 404 rather than an uncached 502, so the edge
 * absorbs the repeat instead of the museum. This bucket only bounds the case the
 * cache cannot help with, a loop over endlessly NEW names, and it is deliberately
 * loose because the failure it can cause is worse than the one it prevents: a
 * refused image is a visibly broken card, while an over-spent museum budget is
 * already caught by `imageGate` (120 ms, so ~500/min for the whole process) and
 * by `imageBreaker`.
 *
 * Sized so no honest reader can meet it. The genuine burst is the trail map,
 * which draws one 160px thumbnail per Gallery node, so a long trail is a dozen
 * or two at once; 150 is several maps back to back. It also has to survive
 * several readers sharing one address, which an office or a mobile carrier's
 * NAT routinely means. In production nearly all of these are CDN hits that never
 * reach the origin at all, so the bucket is rarely touched.
 */
export const imageLimiter = makeRateLimiter({ burst: 150, perMinute: 150 });
