// Server-only generic upstream fetch helper (imported only by API route
// handlers / server adapters). Provides a reusable request-spacing GATE plus a
// bounded 429/503 retry with jittered backoff — the mechanism that fixed the
// "dead button" Wikimedia rate-limit problem. Each content source gets its OWN
// gate (different hosts, different limits), so Gallery/Library traffic never
// throttles Wikipedia and vice-versa. `wiki-server.ts` wraps this for Wikimedia.

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * What one caller asks of the gate. Both fields exist for the same reason: one
 * shared window, callers that are not equally important.
 *
 * On The Met a card with no thread chips still reads, but a room with no cards
 * is broken and the feed has nothing to fall back to. So threads and the
 * doorway declare themselves `optional`, and the essential work is protected
 * from them in two different ways — one about TIME, one about VOLUME.
 */
export interface GateTicket {
  /**
   * Refuse rather than hold THIS caller longer than this, overriding the gate's
   * own ceiling. Callers are strictly serialised, so one that sits waiting five
   * seconds also delays everyone queued behind it; giving up at 1.2s hands back
   * the time as well as the slot. A refusal charges nothing (see below), so the
   * budget declined here really is still there for the next caller.
   */
  maxWaitMs?: number;
  /**
   * This is OPTIONAL work and must leave the gate's `reserve` alone.
   *
   * ⚠️ WITHOUT THIS, YIELDING ON TIME IS NOT ENOUGH, and the difference was
   * measured rather than reasoned. On 30 August two rooms plus five cards' worth
   * of threads spent all 30 slots in four seconds, and the next reader to open a
   * room got ZERO cards. Those threads never waited, so they never yielded —
   * they simply arrived first and ate the window. A ceiling cannot fix that;
   * only a floor can. This is the same failure as the three Gallery bots that
   * ended "no seed card" in the 25-reader rehearsal.
   */
  optional?: boolean;
}

export interface Gate {
  /** Wait for this caller's turn, keeping starts at least `minGapMs` apart. */
  next(sleep: (ms: number) => Promise<void>, ticket?: GateTicket): Promise<void>;
}

export interface GateOptions {
  /**
   * A rolling budget on top of the spacing: at most `burst` starts in any
   * `windowMs`. Omit both and the gate is spacing only, as it always was.
   *
   * WHY A SECOND RATE. Spacing alone cannot express the shape of a real edge.
   * The Met's is a bucket, not a metronome: it accepts a burst and then refuses
   * until it refills (measured, CLAUDE.md §4 — 403 after 83 requests at 20/s,
   * clear again after ~31s of quiet). A 50 ms gate is 20 requests a second, so
   * anything sustained drained that bucket and everything after it was refused.
   *
   * And a refusal is strictly worse than a wait: it costs a request, it earns
   * nothing, it feeds the breaker, and CLAUDE.md §4 records that repeated
   * tripping shrinks the museum's budget for a DAY. So the gate now knows the
   * budget it is spending and waits at the edge of it instead.
   */
  burst?: number;
  windowMs?: number;
  /**
   * The longest this gate will HOLD a caller waiting for budget before refusing.
   *
   * Waiting out the window is only better than a 403 while somebody is still
   * listening. The feed aborts a discover batch after 6 seconds, so a gate that
   * quietly held one for thirty would spend the museum's budget on a batch
   * nobody receives — the worst of both. Past this, refuse without making the
   * request: that costs the museum nothing, says so in one line, and the feed
   * degrades the way it already does for an empty batch (a thread neighbour).
   */
  maxWaitMs?: number;
  /**
   * Slots in every window that `optional` callers may not take.
   *
   * A floor under the essential work, not a quota on the optional work: an
   * optional caller sees a burst of `burst - reserve` and is refused past it,
   * while everything else still sees the whole `burst`. So threads cost nothing
   * extra while the window is quiet, and stop eating it once they have had the
   * larger share. Sized so a room can always land: a Gallery discover is 8 to 12
   * records, and returning half a room beats returning none.
   */
  reserve?: number;
}

/** Thrown when a gate refuses rather than holding a caller past `maxWaitMs`.
 *  A distinct type for the same reason as `CircuitOpenError`: choosing not to
 *  ask is healthy degradation, not a crash, and must not be logged as one. */
export class GateBudgetError extends Error {
  constructor(waitMs: number) {
    super(`Rate budget exhausted; would wait ${Math.round(waitMs)}ms`);
    this.name = "GateBudgetError";
  }
}

/** True when this error is our OWN budget refusing, rather than an upstream. */
export function isBudgetExhausted(err: unknown): err is GateBudgetError {
  return err instanceof GateBudgetError;
}

/** A per-host request-spacing gate. Serializes callers and keeps consecutive
 *  request starts ≥ minGapMs apart. At human pace this adds no latency; it only
 *  smooths bursts (prefetch + threads firing together, fast scrolling).
 *
 *  With `burst`/`windowMs` it also holds a rolling window, so a source with a
 *  bucket-shaped limit is never asked for more than it grants. */
export function makeGate(minGapMs: number, opts: GateOptions = {}): Gate {
  const { burst, windowMs, maxWaitMs } = opts;
  // Clamped here rather than checked at every use: a reserve at or above the
  // burst would leave optional callers an allowance of zero, and the index that
  // finds their blocking slot would run off the end of the window. One slot has
  // to stay available to them for the arithmetic below to mean anything.
  const reserve = burst
    ? Math.max(0, Math.min(opts.reserve ?? 0, burst - 1))
    : 0;
  let chain: Promise<void> = Promise.resolve();
  let lastStartAt = 0;
  // Start times inside the current window, oldest first. Bounded by `burst`.
  const recent: number[] = [];

  return {
    next(sleep, ticket = {}) {
      // The caller's own ceiling wins when it states one, so a low-priority
      // caller can yield the window without changing it for anybody else.
      const ceiling = ticket.maxWaitMs ?? maxWaitMs;
      const mine = chain.then(async () => {
        let wait = Math.max(0, lastStartAt + minGapMs - Date.now());
        if (burst && windowMs) {
          // Optional work may not touch the reserve. Everything else sees the
          // whole budget, so the floor costs nothing while the window is quiet.
          const allowed = ticket.optional ? Math.max(0, burst - reserve) : burst;
          // Drop anything that has aged out, then wait for the slot THIS caller
          // needs to free up. For a full-budget caller that is the oldest entry;
          // for an optional one it is the one `allowed` back from the end, which
          // is what holds the reserve open.
          const cutoff = Date.now() - windowMs;
          while (recent.length && recent[0] <= cutoff) recent.shift();
          if (recent.length >= allowed) {
            const blocking = recent[recent.length - allowed];
            wait = Math.max(wait, blocking + windowMs - Date.now());
          }
        }
        if (ceiling !== undefined && wait > ceiling) throw new GateBudgetError(wait);
        if (wait > 0) await sleep(wait);
        lastStartAt = Date.now();
        if (burst && windowMs) {
          const cutoff = lastStartAt - windowMs;
          while (recent.length && recent[0] <= cutoff) recent.shift();
          recent.push(lastStartAt);
        }
      });
      chain = mine.catch(() => {});
      return mine;
    },
  };
}

// ---------------------------------------------------------------------------
// The circuit breaker.
//
// WHY THIS EXISTS. `retryOn: [403]` with `retries: 2` means every refusal costs
// THREE requests, at precisely the moment we are being told to stop. A 25-reader
// load rehearsal drew 1,470 refusals from the museum against ~3,181 requests,
// and CLAUDE.md §4 records what that does: repeated tripping shrinks their
// budget hard, down to six requests after a day of heavy use. The retry is not
// wrong for a one-off blip; it is catastrophic for a sustained one, because it
// feeds the thing that is starving us.
//
// So: after a run of refusals, stop asking entirely for a while. The museum was
// measured to recover after about 31 seconds of quiet, and the Gallery's baked
// pools (met.pools.json) exist precisely so a room still reads while we are not
// asking.
//
// Opt-in per source, exactly like `retryOn`, and deliberately NOT wired to
// Wikimedia: its 429s are rare, carry `Retry-After`, and are already handled
// correctly. A breaker there would only be a new way to fail.
// ---------------------------------------------------------------------------

/**
 * Thrown when a breaker refuses a request. A distinct type, not a string to
 * match on: callers legitimately want to treat "we chose not to ask" differently
 * from "we asked and it went wrong" — the first is healthy degradation and
 * should not be logged as a crash, which is exactly the confusion it caused the
 * first time the breaker fired for real.
 */
export class CircuitOpenError extends Error {
  readonly host: string;
  constructor(host: string) {
    super(`Upstream circuit open for ${host}`);
    this.name = "CircuitOpenError";
    this.host = host;
  }
}

/** True when this error is a breaker refusing, rather than an upstream failing. */
export function isCircuitOpen(err: unknown): err is CircuitOpenError {
  return err instanceof CircuitOpenError;
}

/**
 * An upstream that answered, badly. Carries the status, because callers have to
 * be able to tell the two kinds of "no" apart:
 *
 *   404 — a healthy host answering honestly. The museum's own search hands us
 *         ids it then 404s on, and that is a settled answer we may cache.
 *   403/429/503 — we could not look. Caching THAT as an answer is what freezes
 *         "there is nothing here" onto a card until tomorrow.
 *
 * Before this the two were the same `Error("Upstream responded 404")` string,
 * so nothing downstream could distinguish them without parsing a message.
 */
export class UpstreamError extends Error {
  readonly status: number;
  readonly host: string;
  constructor(status: number, url: string) {
    super(`Upstream responded ${status}`);
    this.name = "UpstreamError";
    this.status = status;
    this.host = hostOf(url);
  }
}

/** The HTTP status behind a failure, or null if it was not an upstream answer
 *  (a timeout, a breaker refusal, a parse error). */
export function upstreamStatus(err: unknown): number | null {
  return err instanceof UpstreamError ? err.status : null;
}

export interface Breaker {
  /** Throw if the circuit is open. Called before any network work. */
  guard(url: string): void;
  /** Record how a request turned out, so the state can move. */
  record(throttled: boolean): void;
  /** For tests and logging. */
  state(): "closed" | "open" | "half-open";
}

export interface BreakerOptions {
  /** Consecutive throttles before the circuit opens. */
  threshold?: number;
  /** How long to stay open. */
  cooldownMs?: number;
  /** Injectable clock, so the state machine is testable without waiting. */
  now?: () => number;
}

/**
 * A per-source breaker.
 *
 * closed → counts CONSECUTIVE throttles; any success resets the count, because a
 *   scattering of refusals across a healthy hour is not the failure mode we care
 *   about — a run of them is.
 * open → every call throws immediately, making no request at all, until the
 *   cooldown elapses.
 * half-open → the first call through is a probe. It succeeds and we close; it
 *   fails and we open again for another cooldown, rather than letting a stream
 *   of callers all probe at once.
 */
export function makeBreaker(opts: BreakerOptions = {}): Breaker {
  const { threshold = 5, cooldownMs = 35_000, now = Date.now } = opts;
  let failures = 0;
  // When the current closed-to-traffic window started: the moment the circuit
  // opened, or the moment a probe was let through. See `guard`.
  let sinceAt = 0;
  let open = false;

  return {
    guard(url) {
      if (!open) return;
      if (now() - sinceAt >= cooldownMs) {
        // Cooldown served. Let exactly one caller through to find out — and
        // give that probe its own window by moving `sinceAt` forward, which is
        // what keeps the queue behind it from all probing at once.
        //
        // ⚠️ THE PROBE HOLDS THE SLOT FOR ONE COOLDOWN, NOT FOREVER. This used
        // to be a `probing` flag that only `record` could clear, and a probe
        // whose fetch THREW never reached `record` — a timeout, a reset
        // connection, DNS. One of those wedged the circuit open permanently, so
        // The Met stayed dead for the whole life of the server process while
        // the log repeated "circuit open" long after the host had recovered.
        // A time-boxed slot cannot wedge: the worst a lost probe costs is one
        // more cooldown.
        sinceAt = now();
        console.warn(`[upstream] ${hostOf(url)} circuit half-open, probing`);
        return;
      }
      throw new CircuitOpenError(hostOf(url));
    },
    record(throttled) {
      if (throttled) {
        failures++;
        // `failures` is never reset except by a success, so once the threshold
        // is crossed this also covers "the probe came back angry": re-open for
        // another full cooldown rather than letting the next caller try.
        if (failures >= threshold) {
          if (!open) {
            console.warn(
              `[upstream] circuit OPEN after ${failures} consecutive throttles`,
            );
          }
          open = true;
          sinceAt = now();
        }
        return;
      }
      if (open) console.warn("[upstream] circuit closed");
      failures = 0;
      open = false;
    },
    state() {
      if (!open) return "closed";
      return now() - sinceAt >= cooldownMs ? "half-open" : "open";
    },
  };
}

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  gate?: Gate;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  /**
   * Extra status codes to treat as "throttled, try again" for THIS source.
   *
   * 429 and 503 are always retried because they mean it everywhere. This exists
   * because not every upstream says so in the standard way: The Met's edge
   * answers a burst with `403` and no `Retry-After`, which is indistinguishable
   * from a real refusal by status alone but clears on its own within minutes.
   * Opt-in per source rather than global, because a blanket "retry 403" would
   * hammer a host that genuinely means no (compare the Art Institute, whose 403
   * is permanent and must NOT be retried).
   */
  retryOn?: number[];
  /**
   * A circuit breaker for THIS source. When it is open, the request throws
   * without touching the network, so a throttled host is left alone to recover
   * instead of being retried into the ground. See `makeBreaker`.
   */
  breaker?: Breaker;
  /**
   * How long the GATE may hold this particular request waiting for budget,
   * overriding the gate's own ceiling. See `Gate.next`: this is how one source
   * ranks its callers against a shared window, so the optional work (threads,
   * the doorway) yields to the work without which the screen is empty.
   */
  maxWaitMs?: number;
  /** Marks this request as optional work, so the gate keeps its `reserve` for
   *  the calls the screen cannot do without. See `GateTicket.optional`. */
  optional?: boolean;
}

/**
 * The one request core: optionally spaced through a gate, retrying transient
 * rate-limit / overload responses (429, 503) with jittered backoff (honoring
 * `Retry-After`). Returns the OK response; throws on a non-retryable or
 * exhausted error. `fetchJson` / `fetchText` are thin parsers over this, so the
 * fiddly retry policy exists in exactly one place.
 */
async function fetchUpstream(
  url: string,
  opts: FetchJsonOptions,
  defaultHeaders: Record<string, string>,
): Promise<Response> {
  // Keep retries shallow: deep retry × backoff compounds with the client's own
  // retry and can freeze the UI for tens of seconds under sustained throttling.
  const {
    headers = {},
    gate,
    retries = 2,
    sleep = defaultSleep,
    timeoutMs,
    retryOn = [],
    breaker,
    maxWaitMs,
    optional,
  } = opts;

  for (let attempt = 0; ; attempt++) {
    // Before the gate, not after: an open circuit should cost nothing at all,
    // not a turn in the queue.
    breaker?.guard(url);
    if (gate) await gate.next(sleep, { maxWaitMs, optional });
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { ...defaultHeaders, ...headers },
        cache: "no-store",
        signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
      });
    } catch (err) {
      // A fetch that THROWS — a timeout, a reset connection, DNS — produced no
      // response, so it never reached the `record` calls below and the breaker
      // was told nothing at all about it. Two reasons that is wrong:
      //
      //  - A host that has stopped answering is exactly what a breaker is for.
      //    The image host's breaker already counts a timeout for this reason,
      //    and a throttled API edge that simply hangs looks the same from here.
      //  - Silence from a probe is what wedged the circuit (see `makeBreaker`).
      //    That is now impossible either way, but the honest fix is to report
      //    the outcome rather than rely on the state machine to survive not
      //    hearing about it.
      breaker?.record(true);
      throw err;
    }
    if (res.ok) {
      breaker?.record(false);
      return res;
    }

    const retryable =
      res.status === 429 || res.status === 503 || retryOn.includes(res.status);
    // Say so, once per hit. Being rate-limited is currently invisible: the retry
    // absorbs it and the reader never notices, which is the right behaviour and
    // the wrong amount of information — the decision to raise our quota should be
    // made on evidence that we are actually near it, not on a feeling. One line
    // in the deploy logs is enough to see it coming.
    if (retryable) {
      console.warn(
        `[upstream] ${res.status} from ${hostOf(url)} (attempt ${attempt + 1}/${retries + 1})`,
      );
    }
    // Only a THROTTLE moves the breaker. A 404 is a perfectly healthy answer
    // from a healthy host — the museum returns them for ids its own search hands
    // us — and counting one would open the circuit on a source that is fine.
    breaker?.record(retryable);
    if (retryable && attempt < retries) {
      const stated = retryAfterMs(res.headers.get("retry-after"));
      if (stated !== null && stated > MAX_RETRY_WAIT_MS) {
        // The server told us how long to wait and it is longer than we are
        // willing to hold a request open. Retrying EARLY is the worst of both
        // worlds: it burns the shared rate budget and, on Wikimedia, is what
        // moves a client into a lower access class. So give up now and let the
        // caller degrade, which every caller already does.
        console.warn(
          `[upstream] ${hostOf(url)} asked for ${Math.round(stated / 1000)}s; not retrying`,
        );
        throw new UpstreamError(res.status, url);
      }
      // Honour the stated wait in full when there is one. The old code capped it
      // at 1500 ms, which is not honouring it: being told "wait 5 seconds" and
      // returning after 1.5 is just a faster way to be refused again (audit C-3).
      const base = stated ?? 300 * (attempt + 1);
      await sleep(base + Math.floor(Math.random() * 200));
      continue;
    }
    throw new UpstreamError(res.status, url);
  }
}

/**
 * How long a `Retry-After` header is asking for, in milliseconds, or null if it
 * says nothing usable. RFC 9110 allows BOTH forms and servers use both: a count
 * of seconds, or an HTTP date. Reading only the number silently treated every
 * date-form header as absent.
 */
export function retryAfterMs(
  header: string | null,
  now: number = Date.now(),
): number | null {
  const raw = (header ?? "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
  }
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return null;
  const wait = at - now;
  return wait > 0 ? wait : null;
}

/** The longest we will hold a request open waiting out a throttle. Beyond this
 *  the honest move is to fail and let the UI say so, rather than freeze. */
const MAX_RETRY_WAIT_MS = 3000;

/** Just the host, for a log line that names the source without leaking a query. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "upstream";
  }
}

/** Fetch JSON through the shared gate + retry core. */
export async function fetchJson(
  url: string,
  opts: FetchJsonOptions = {},
): Promise<unknown> {
  const res = await fetchUpstream(url, opts, { Accept: "application/json" });
  return res.json();
}

/** Fetch raw response text — for sources that speak XML rather than JSON
 *  (arXiv's Atom feed). Same gate + bounded 429/503 retry. */
export async function fetchText(
  url: string,
  opts: FetchJsonOptions = {},
): Promise<string> {
  const res = await fetchUpstream(url, opts, {});
  return res.text();
}
