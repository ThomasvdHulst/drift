// Server-only Wikimedia fetch helper (imported only by API route handlers).
// Setting a descriptive Api-User-Agent is required by Wikimedia etiquette and is
// the reason we proxy these calls through Next.js route handlers rather than the
// browser. Everything goes through the MediaWiki Action API (see wiki.ts).
//
// The generic request-spacing gate + retry now live in upstream.ts; this file is
// the Wikimedia-specific wrapper (Action API URL + Api-User-Agent + its own gate).

import { makeGate, fetchJson } from "./upstream";

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

// Wikimedia 429s bursty callers; serialize ALL Wikimedia calls and keep them
// ≥ MIN_GAP_MS apart. (Its own gate — Gallery/Library sources have separate ones.)
const MIN_GAP_MS = 300;
const wikiGate = makeGate(MIN_GAP_MS);

/**
 * Fetch JSON from the Action API, spaced through the Wikimedia gate and retrying
 * transient 429/503 responses. Signature/behaviour unchanged from before the
 * upstream.ts extraction (its unit tests still pin this).
 */
export function wikiQuery(
  params: Record<string, string>,
  opts: { retries?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<unknown> {
  const ua = wikiUserAgent();
  const url = `${API}?${new URLSearchParams({ action: "query", ...params }).toString()}`;
  return fetchJson(url, {
    headers: { "Api-User-Agent": ua, "User-Agent": ua },
    gate: wikiGate,
    retries: opts.retries,
    sleep: opts.sleep,
  });
}
