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

export interface Gate {
  /** Wait for this caller's turn, keeping starts at least `minGapMs` apart. */
  next(sleep: (ms: number) => Promise<void>): Promise<void>;
}

/** A per-host request-spacing gate. Serializes callers and keeps consecutive
 *  request starts ≥ minGapMs apart. At human pace this adds no latency; it only
 *  smooths bursts (prefetch + threads firing together, fast scrolling). */
export function makeGate(minGapMs: number): Gate {
  let chain: Promise<void> = Promise.resolve();
  let lastStartAt = 0;
  return {
    next(sleep) {
      const mine = chain.then(async () => {
        const wait = Math.max(0, lastStartAt + minGapMs - Date.now());
        if (wait > 0) await sleep(wait);
        lastStartAt = Date.now();
      });
      chain = mine.catch(() => {});
      return mine;
    },
  };
}

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  gate?: Gate;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
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
  const { headers = {}, gate, retries = 2, sleep = defaultSleep, timeoutMs } =
    opts;

  for (let attempt = 0; ; attempt++) {
    if (gate) await gate.next(sleep);
    const res = await fetch(url, {
      headers: { ...defaultHeaders, ...headers },
      cache: "no-store",
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    if (res.ok) return res;

    const retryable = res.status === 429 || res.status === 503;
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
        throw new Error(`Upstream responded ${res.status}`);
      }
      // Honour the stated wait in full when there is one. The old code capped it
      // at 1500 ms, which is not honouring it: being told "wait 5 seconds" and
      // returning after 1.5 is just a faster way to be refused again (audit C-3).
      const base = stated ?? 300 * (attempt + 1);
      await sleep(base + Math.floor(Math.random() * 200));
      continue;
    }
    throw new Error(`Upstream responded ${res.status}`);
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
