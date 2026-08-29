// Which feed shell renders a drift session (continuous-feed Phase 3).
//
// Two shells consume the same `useDriftSession` engine: the card-at-a-time feed
// Drift has always had, and the continuous scroll-snap feed. This module is the
// single source of truth for which one a reader gets.
//
// OFF by default, and off means byte-for-byte the app that shipped: the flag is
// read in one place and the classic shell is what a missing or malformed value
// resolves to.
//
// Pure + injectable, the same shape as lib/ads.ts and lib/limits.ts, and for the
// same reason: Next only inlines `process.env.NEXT_PUBLIC_*` for the browser on
// a STATIC member access, so the live reader hands a plain object to a parser
// that tests can call with anything.

export type FeedMode = "classic" | "continuous";

type FeedEnv = { NEXT_PUBLIC_FEED_CONTINUOUS?: string };

/** Is the continuous shell built into this deployment at all? */
export function parseContinuousEnabled(env: FeedEnv): boolean {
  return env.NEXT_PUBLIC_FEED_CONTINUOUS === "1";
}

/** The live switch, read from the statically-inlined NEXT_PUBLIC_ var. */
export function continuousEnabled(): boolean {
  return parseContinuousEnabled({
    NEXT_PUBLIC_FEED_CONTINUOUS: process.env.NEXT_PUBLIC_FEED_CONTINUOUS,
  });
}

/**
 * Which shell to render.
 *
 * `?feed=classic` sends a reader back to the card-at-a-time feed, which is what
 * makes the two comparable on ONE build: you can flip between them mid-session
 * instead of rebuilding and losing your place.
 *
 * ⚠️ THE OVERRIDE ONLY WORKS WHILE THE FLAG IS ON, AND ONLY IN THAT DIRECTION.
 * A URL is untrusted input and the continuous shell is unfinished, so no
 * parameter may switch it ON: with the flag off this returns "classic" whatever
 * the URL says, and a deployment that has not opted in cannot be talked into
 * serving the new feed by anyone who guesses the parameter name.
 */
export function feedMode(opts: {
  enabled: boolean;
  param?: string | null;
}): FeedMode {
  if (!opts.enabled) return "classic";
  return opts.param === "classic" ? "classic" : "continuous";
}
