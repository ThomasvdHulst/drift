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
 * Fetch JSON, optionally spaced through a gate and retrying transient
 * rate-limit / overload responses (429, 503) with jittered backoff (honoring
 * `Retry-After`). Throws on a non-retryable or exhausted error.
 */
export async function fetchJson(
  url: string,
  opts: FetchJsonOptions = {},
): Promise<unknown> {
  // Keep retries shallow: deep retry × backoff compounds with the client's own
  // retry and can freeze the UI for tens of seconds under sustained throttling.
  const { headers = {}, gate, retries = 2, sleep = defaultSleep, timeoutMs } =
    opts;

  for (let attempt = 0; ; attempt++) {
    if (gate) await gate.next(sleep);
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      cache: "no-store",
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    if (res.ok) return res.json();

    const retryable = res.status === 429 || res.status === 503;
    if (retryable && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const base =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 1500)
          : 300 * (attempt + 1);
      await sleep(base + Math.floor(Math.random() * 200));
      continue;
    }
    throw new Error(`Upstream responded ${res.status}`);
  }
}
