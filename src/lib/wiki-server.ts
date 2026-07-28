// Server-only Wikimedia fetch helper (imported only by API route handlers).
// Setting a descriptive Api-User-Agent is required by Wikimedia etiquette and is
// the reason we proxy these calls through Next.js route handlers rather than the
// browser. Everything goes through the MediaWiki Action API (see wiki.ts).
//
// The generic request-spacing gate + retry now live in upstream.ts; this file is
// the Wikimedia-specific wrapper (Action API URL + Api-User-Agent + its own gate).

import { makeGate, fetchJson } from "./upstream";

// A COMPLIANT User-Agent (resolvable URL + contact email) is what puts us in
// Wikimedia's ~200 req/min-per-IP bucket instead of the ~10 req/min "unidentified"
// one (their 2025 global limits now cover the Action API too). The real value is
// set via WIKI_USER_AGENT in the deploy env; this fallback is only for local dev.
const DEFAULT_UA =
  "Drift/1.0 (https://www.usedrift.org; thomasvdhulst03@gmail.com)";
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
  // FREE-LICENSED IMAGES ONLY. An article may legitimately carry a non-free file
  // under fair use (a film poster, a logo, an album sleeve), and WP:Copyrights is
  // explicit that such a file is "not under the CC BY-SA or GFDL license as such"
  // — so it is not ours to show. `pilicense` already defaults to `free`, but a
  // default is not a promise: stating it keeps the guarantee in the code, where a
  // future edit can see it. Pinned by a test in lib/licenses.test.ts.
  pilicense: "free",
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

/**
 * `action=parse`: the rendered HTML of a page or ONE of its sections. Used by the
 * "Read more" body (Phase 26), which needs the real markup because tables and
 * infoboxes exist nowhere in `prop=extracts`.
 *
 * Its own function rather than a `wikiQuery({ action: "parse" })` call, because
 * relying on a spread to quietly override `action` is the kind of cleverness that
 * breaks in a year. Same gate, so parse calls are spaced with every other
 * Wikimedia request and can never run in parallel with them (API:Etiquette asks
 * for serial requests).
 *
 * `disable*` trims the response of chrome we would only throw away: the parser
 * report, section-edit links, the table of contents.
 */
export function wikiParse(params: Record<string, string>): Promise<unknown> {
  const ua = wikiUserAgent();
  const url = `${API}?${new URLSearchParams({
    action: "parse",
    prop: "text",
    redirects: "1",
    disablelimitreport: "1",
    disableeditsection: "1",
    disabletoc: "1",
    format: "json",
    formatversion: "2",
    ...params,
  }).toString()}`;
  return fetchJson(url, {
    headers: { "Api-User-Agent": ua, "User-Agent": ua },
    gate: wikiGate,
  });
}
