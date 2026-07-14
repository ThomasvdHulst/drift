// Server-only Wikimedia fetch helper (imported only by API route handlers).
// Setting a descriptive Api-User-Agent is required by Wikimedia etiquette and is
// the reason we proxy these calls through Next.js route handlers rather than the
// browser. Everything goes through the MediaWiki Action API (see wiki.ts).

const DEFAULT_UA = "Drift/0.1 (local hobby project)";
const API = "https://en.wikipedia.org/w/api.php";

export function wikiUserAgent(): string {
  return process.env.WIKI_USER_AGENT || DEFAULT_UA;
}

/** Shared props that turn any page (random, by-title, or related) into a Card. */
export const CARD_PROPS: Record<string, string> = {
  prop: "extracts|pageimages|description|info|pageprops",
  exintro: "1",
  explaintext: "1",
  exsentences: "3",
  piprop: "thumbnail",
  pithumbsize: "800",
  inprop: "url",
  ppprop: "disambiguation",
  format: "json",
  formatversion: "2",
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// Global request-spacing gate. Wikimedia 429s bursty callers, and retrying into
// a rate limit doesn't help — so we serialize ALL upstream calls and keep them
// at least MIN_GAP_MS apart. At human drift pace this adds no latency; it only
// smooths out bursts (prefetch + threads firing together, fast scrolling).
const MIN_GAP_MS = 300;
let gateChain: Promise<void> = Promise.resolve();
let lastStartAt = 0;

function nextSlot(sleep: (ms: number) => Promise<void>): Promise<void> {
  const mine = gateChain.then(async () => {
    const wait = Math.max(0, lastStartAt + MIN_GAP_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastStartAt = Date.now();
  });
  gateChain = mine.catch(() => {});
  return mine;
}

/**
 * Fetch JSON from the Action API, spaced through the global gate and retrying
 * transient rate-limit / overload responses (429, 503) with jittered backoff
 * (honoring `Retry-After`). Prevents the "dead Drift onward button" that a 429
 * used to cause.
 */
export async function wikiQuery(
  params: Record<string, string>,
  opts: { retries?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<unknown> {
  // Keep retries shallow: deep retry × backoff compounds with the client's own
  // retry and can freeze the UI for tens of seconds under sustained throttling.
  const { retries = 2, sleep = defaultSleep } = opts;
  const ua = wikiUserAgent();
  const url = `${API}?${new URLSearchParams({ action: "query", ...params }).toString()}`;

  for (let attempt = 0; ; attempt++) {
    await nextSlot(sleep);
    const res = await fetch(url, {
      headers: { "Api-User-Agent": ua, "User-Agent": ua, Accept: "application/json" },
      cache: "no-store",
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
    throw new Error(`Wikimedia responded ${res.status}`);
  }
}
