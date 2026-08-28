// ---------------------------------------------------------------------------
// The API surface the HTTP bot driver talks to, and the buckets it may ask for.
//
// WHY THIS FILE EXISTS AT ALL, given src/lib/realms/index.ts already builds
// these URLs. A plain Node script cannot import the app's modules: they use
// extensionless relative specifiers ("../interest"), which the bundler resolves
// and Node's ESM loader does not. Copying four one-line builders is the cheapest
// correct answer — but a copy that nobody checks is a copy that rots, and a
// rotted copy here would mean the load test measures a fiction while reporting
// success.
//
// So `src/lib/loadbot.test.ts` imports BOTH this file and the real builders and
// asserts they agree, on every `npm run test`. Change a builder in the app and
// this goes red. That test is the reason this duplication is allowed.
// ---------------------------------------------------------------------------

/** GET a batch of drift-buffer cards for one bucket. */
export function discoverUrl(realm, p) {
  return `/api/realm/${realm}/discover?bucket=${encodeURIComponent(p.bucket)}&offset=${p.offset}&limit=${p.limit}`;
}

/** GET the in-realm threads for a card. */
export function relatedUrl(realm, id) {
  return `/api/realm/${realm}/related?id=${encodeURIComponent(id)}`;
}

/** GET the cross-realm doorway for a card (Phase 15). `{}` when there is none. */
export function doorwayUrl(realm, id) {
  return `/api/doorway?realm=${realm}&id=${encodeURIComponent(id)}`;
}

/** GET one card. `extended` is what "Read more" asks for. */
export function summaryUrl(realm, id, opts = {}) {
  const q = opts.extended ? "&extended=1" : opts.full ? "&full=1" : "";
  return `/api/realm/${realm}/summary?id=${encodeURIComponent(id)}${q}`;
}

/** The Encyclopedia-only random fallback, used when discover comes back empty. */
export const RANDOM_URL = "/api/wiki/random";

// ---------------------------------------------------------------------------
// Buckets. Pinned as subsets of the app's own registries by the same test — a
// bucket the server does not recognise is rejected with a 400 by the discover
// route's allowlist, which would look in the report like a working request that
// simply found nothing.
// ---------------------------------------------------------------------------

/** Encyclopedia buckets: the `keyword` of every entry in src/lib/topics.ts. */
export const ENCYCLOPEDIA_BUCKETS = [
  "architecture",
  "biology",
  "books",
  "business-and-economics",
  "chemistry",
  "computing",
  "earth-and-environment",
  "education",
  "engineering",
  "films",
  "food-and-drink",
  "history",
  "linguistics",
  "literature",
  "mathematics",
  "medicine-and-health",
  "military-and-warfare",
  "music",
  "performing-arts",
  "philosophy-and-religion",
  "physics",
  "politics-and-government",
  "society",
  "space",
  "sports",
  "technology",
  "transportation",
  "visual-arts",
];

/** Gallery buckets: the `id` of every entry in src/lib/realms/met.buckets.ts. */
export const GALLERY_BUCKETS = [
  "africa-oceania-americas",
  "egypt",
  "arms-armor",
  "asian",
  "drawings-prints",
  "costume",
  "european-paintings",
  "greek-roman",
  "impressionism",
  "islamic",
  "ukiyo-e",
  "medieval",
  "instruments",
  "photographs",
];

export function bucketsFor(realm) {
  return realm === "gallery" ? GALLERY_BUCKETS : ENCYCLOPEDIA_BUCKETS;
}

// ---------------------------------------------------------------------------
// The feed's own discover constants, copied for the same reason and pinned by
// the same test. Getting these wrong is the single easiest way to make the whole
// report wrong: the buffer size decides how often a drift costs a network call,
// which is most of the difference between "2.4 requests per card" and a number
// that has nothing to do with the real app.
// ---------------------------------------------------------------------------

/** Parallel discover calls per refill (drift/useDriftSession.ts REFILL_TOPICS). */
export const REFILL_TOPICS = 3;
/** Cards asked for per discover call (drift/useDriftSession.ts DISCOVER_LIMIT). */
export const DISCOVER_LIMIT = 4;
/** Cards in a "Surprise me" seed batch (drift/useDriftSession.ts SEED_LIMIT). */
export const SEED_LIMIT = 12;

/**
 * A window-aligned random offset — `randomOffset` in src/lib/discover.ts.
 *
 * The alignment is the whole point and must not be simplified away: it is what
 * makes two readers who land on the same stretch of a bucket share ONE upstream
 * call. An unaligned offset here would tile the cache differently from the real
 * app and would understate the hit ratio the report exists to measure.
 */
export function randomOffset(rng = Math.random, max = 400, step = 1) {
  const size = Math.max(1, Math.floor(step));
  const pages = Math.floor(max / size);
  return Math.floor(rng() * (pages + 1)) * size;
}
