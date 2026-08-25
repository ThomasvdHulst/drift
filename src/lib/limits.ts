// ---------------------------------------------------------------------------
// The daily reading allowance (Phase 32).
//
// WHAT IS BEING COUNTED, AND WHY IT IS "STOPS". A stop is a card entering the
// trail — the same number the feed already shows the reader and the same one the
// trail map is built from (lib/stats.ts). Counting anything else would be
// counting something invisible, and principle §2.1 says the reader always knows
// why the app did what it did.
//
// Threads are deliberately NOT counted separately. Pulling a thread already
// produces a stop, so metering it a second time would make the DELIBERATE move
// cost twice what a passive drift costs. That is precisely backwards for an app
// whose whole argument is that steering beats being fed.
//
// WHAT THIS FILE IS NOT. There is no notion here of "buy more reading". The
// allowance exists because a day's reading should end (principle §2.3: sessions
// have a shape, and the reward sits at the exit). The supporter unlock lifts it
// because the project costs money to run. Those are two separate justifications
// and the copy must never merge them into "pay to scroll more".
//
// Pure + injectable, like lib/ads.ts: Next only inlines process.env.NEXT_PUBLIC_*
// for the browser on a STATIC member access, so `dailyLimit()` reads the literal
// and hands a plain object to `parseDailyLimit`, which tests can call with any.
// ---------------------------------------------------------------------------

/** How few stops must remain before the reader is told. See `shouldWarn`. */
export const WARN_AT = 10;

type LimitEnv = { NEXT_PUBLIC_FREE_DAILY_STOPS?: string };

/**
 * The free allowance, or `null` for "no limit at all".
 *
 * Unset, empty, zero, negative or unparseable all mean null, which is the
 * MEASURE-FIRST state: the app still counts every stop, so there is real data to
 * choose a number from, but nobody is ever stopped. Picking the number before
 * knowing what an ordinary day looks like would be guessing, and a limit that
 * turns out to sit just above the nudge reads as engineered to sell.
 */
export function parseDailyLimit(env: LimitEnv): number | null {
  const n = Number(env.NEXT_PUBLIC_FREE_DAILY_STOPS);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

/** The live allowance, read from the statically-inlined NEXT_PUBLIC_ var. */
export function dailyLimit(): number | null {
  return parseDailyLimit({
    NEXT_PUBLIC_FREE_DAILY_STOPS: process.env.NEXT_PUBLIC_FREE_DAILY_STOPS,
  });
}

/**
 * Today's date in Europe/Amsterdam, as `YYYY-MM-DD`.
 *
 * The server decides the day (in `record_stop()`, from the database clock) and
 * this has to agree with it, or the local mirror would carry yesterday's count
 * into today for the hours the two disagree. UTC is not good enough: it rolls
 * over at 01:00 or 02:00 Dutch time, which is the middle of an evening's reading.
 *
 * `en-CA` is the trick that makes this one line — it formats as ISO, so no
 * manual zero-padding of month and day.
 */
export function amsterdamDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Where a reader stands today. Mirrors what `supporter_status()` returns. */
export interface MeterState {
  /** Stops recorded today (Europe/Amsterdam), as far as we know. */
  stops: number;
  /** True once the supporter unlock is held: the meter stops applying. */
  supporter: boolean;
}

/** True when the meter does not apply to this reader at all. */
export function unmetered(state: MeterState, limit: number | null): boolean {
  return limit === null || state.supporter;
}

/**
 * Stops left today, or `null` when the meter does not apply.
 *
 * Never negative: a reader who somehow got past the limit (an offline stretch
 * that reconciled, a second tab) is at zero, not at minus three.
 */
export function stopsRemaining(
  state: MeterState,
  limit: number | null,
): number | null {
  if (unmetered(state, limit)) return null;
  return Math.max(0, limit! - state.stops);
}

/** True when today's reading is done and the session should close. */
export function limitReached(state: MeterState, limit: number | null): boolean {
  return stopsRemaining(state, limit) === 0;
}

/**
 * Whether to show the quiet "N stops left today" line.
 *
 * Only near the end, and never at zero (at zero the session has closed and the
 * trail map is saying it already). A permanent "23 / 50" gauge would be scarcity
 * furniture — the fuel-gauge dynamic every slot machine uses — so the reader is
 * left alone until the number is actually about to matter.
 */
export function shouldWarn(state: MeterState, limit: number | null): boolean {
  const left = stopsRemaining(state, limit);
  return left !== null && left > 0 && left <= WARN_AT;
}
