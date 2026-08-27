import type { Card, RelatedCandidate } from "./types";
import { preprocessMath } from "./mathtext";
import { attributionFor } from "./licenses";
import { fileKey, type ImageCredit } from "./imagecredit";

// ---------------------------------------------------------------------------
// Pure Wikipedia helpers — no network here. Route handlers do the fetching (so
// they can set the Api-User-Agent header) and call these to normalize + filter.
//
// Everything comes from the MediaWiki Action API (not the REST API): its
// `pageimages` + `pithumbsize` returns VALID, correctly-capped thumbnail URLs.
// (An earlier version rewrote REST thumbnail URLs to a bigger width, which
// Wikimedia rejects with HTTP 400 — that's why most images failed to load.)
// The Action API also gives us reliable disambiguation detection via pageprops.
// ---------------------------------------------------------------------------

interface RawImage {
  source?: string;
  width?: number;
  height?: number;
}

export interface ActionPage {
  pageid?: number;
  title?: string;
  index?: number; // preserves generator (morelike relevance) order
  missing?: boolean;
  description?: string;
  extract?: string;
  thumbnail?: RawImage;
  /** The file name of `thumbnail`, from `piprop=name`. The key for looking up the
   *  image's own creator and licence, which are not the article's. */
  pageimage?: string;
  canonicalurl?: string;
  fullurl?: string;
  pageprops?: Record<string, string>;
}

/** Canonical desktop article URL from a title (fallback when the API omits it). */
export function titleToSourceUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(
    title.replace(/ /g, "_"),
  )}`;
}

/** A page is a disambiguation page if it carries the `disambiguation` pageprop. */
export function isDisambiguation(page: ActionPage): boolean {
  return !!page.pageprops && "disambiguation" in page.pageprops;
}

/**
 * Junk filter. Skips: no extract, disambiguation pages, and list/index/navigation
 * pages ("List of …", "Index/Outline/Glossary/Timeline of …", "… listings in …")
 * plus stray disambiguation text ("… may refer to"). The listings/index patterns
 * matter for the topic-discover feed: sorting by incoming links surfaces these
 * high-link navigation hubs (e.g. "National Register of Historic Places listings
 * in Arizona"), which are useless to browse.
 */
export function isJunk(input: {
  title: string;
  extract?: string;
  isDisambiguation?: boolean;
}): boolean {
  const { title, extract } = input;
  if (!extract || extract.trim().length === 0) return true;
  if (input.isDisambiguation) return true;
  if (/^Lists? of\b/i.test(title)) return true;
  if (/^(Index|Outline|Glossary|Timeline) of\b/i.test(title)) return true;
  if (/\blistings\b/i.test(title)) return true;
  if (/\bmay refer to\b/i.test(extract)) return true;
  return false;
}

/** Junk check for a raw Action API page. */
export function isJunkPage(page: ActionPage): boolean {
  return isJunk({
    title: page.title ?? "",
    extract: page.extract,
    isDisambiguation: isDisambiguation(page),
  });
}

/** The first page from an Action API `query.pages` array (or null). */
export function firstPage(raw: unknown): ActionPage | null {
  const pages = (raw as { query?: { pages?: ActionPage[] } })?.query?.pages;
  return Array.isArray(pages) && pages.length > 0 ? pages[0] : null;
}

/** Normalize an Action API page into a Card. */
export function actionPageToCard(
  page: ActionPage,
  credits?: Map<string, ImageCredit>,
): Card {
  const pageTitle = page.title ?? "";
  const sourceUrl =
    page.canonicalurl ?? page.fullurl ?? titleToSourceUrl(pageTitle);
  const credit = page.pageimage
    ? credits?.get(fileKey(page.pageimage))
    : undefined;
  return {
    pageTitle,
    displayTitle: pageTitle,
    description: page.description,
    extract: preprocessMath(page.extract ?? ""),
    imageUrl: page.thumbnail?.source,
    sourceUrl,
    source: "wikipedia",
    ...(credit ? { imageCredit: credit } : {}),
    ...(attributionFor("wikipedia", sourceUrl)
      ? { attribution: attributionFor("wikipedia", sourceUrl)! }
      : {}),
  };
}

/** A lightweight page suggestion for the "drift around a page" search bar. */
export type SearchSuggestion = {
  title: string;
  description: string;
  thumbnail?: string;
};

/** True for list/index/navigation titles we never want as a drift starting
 *  point (a subset of isJunk's title rules, usable without an extract). */
export function isListLikeTitle(title: string): boolean {
  return (
    /^Lists? of\b/i.test(title) ||
    /^(Index|Outline|Glossary|Timeline) of\b/i.test(title) ||
    /\blistings\b/i.test(title)
  );
}

/** The title phrases above, as CirrusSearch exclusion terms. Keep in step with
 *  `isListLikeTitle`: these are the same pages, refused a step earlier. */
export const LIST_TITLE_PHRASES = [
  "listings",
  "list of",
  "index of",
  "outline of",
  "glossary of",
  "timeline of",
] as const;

/**
 * The CirrusSearch query for one topic's discover batch: the ORES topic, minus
 * the list/index titles the junk filter would throw away anyway.
 *
 * Filtering them in the QUERY rather than after the fact is what makes a field
 * drift reliable. Sorted by incoming links, a topic's results contain long
 * *contiguous* stretches of these navigation hubs, because they are densely
 * inter-linked: `articletopic:architecture` is hundreds of "National Register of
 * Historic Places listings in …" pages deep. A whole 12-page window could
 * therefore be nothing but junk, and the batch came back EMPTY. Measured before
 * this: 6 of 12 random offsets into `architecture` yielded zero cards (and 3 of
 * 12 into `visual-arts`), which the reader met as "Couldn't load a card just
 * now" when seeding a field, or as a drift that quietly wandered out of its
 * field once the buffer ran dry. With the exclusions the same offsets yield a
 * full window of real articles (Column, Oscar Niemeyer, Brooklyn Bridge …).
 */
export function topicSearch(keyword: string): string {
  const exclusions = LIST_TITLE_PHRASES.map((p) => `-intitle:"${p}"`).join(" ");
  return `articletopic:${keyword} ${exclusions}`;
}

/**
 * The longest search-box query Drift forwards upstream.
 *
 * A MediaWiki page title cannot exceed 255 bytes, so a `prefixsearch` term
 * longer than that has no title it could possibly be a prefix of. Measured: a
 * 300 and a 400 character term both come back `{"batchcomplete":true}` with no
 * pages at all, which is a guaranteed-empty answer bought with a turn of the
 * shared Wikimedia rate budget (§4) on an endpoint the whole feed depends on.
 *
 * 300 rather than 255 because the cap is a backstop, not a validator: it should
 * sit above every real title without pretending to know the byte length of one.
 *
 * TRUNCATED, NEVER REJECTED. This is an autocomplete box. Someone who pastes
 * something long did nothing wrong, and answering a paste with a 400 is a dead
 * end; trimming it and searching anyway is what they expected. The lower bound
 * stays where it was: under two characters returns nothing rather than asking
 * Wikipedia to prefix-match the alphabet.
 */
export const SEARCH_QUERY_MAX = 300;

/**
 * The query a search request should actually send upstream, or `""` when there
 * is nothing worth asking. Pure, so the bounds are tested rather than sitting as
 * two conditions in a route handler.
 */
export function readSearchQuery(raw: string | null | undefined): string {
  const q = (raw ?? "").trim().slice(0, SEARCH_QUERY_MAX).trim();
  return q.length < 2 ? "" : q;
}

/**
 * Normalize a `prefixsearch` generator response into ordered search suggestions,
 * dropping disambiguation + list/index pages. Suggestions have no extract (just a
 * title + short description), so we can't use the full isJunk here. Pure; the
 * route just fetches.
 */
export function normalizeSearchResults(raw: unknown): SearchSuggestion[] {
  const pages = (raw as { query?: { pages?: ActionPage[] } })?.query?.pages;
  if (!Array.isArray(pages)) return [];
  return [...pages]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .filter((p) => !!p.title && !isDisambiguation(p) && !isListLikeTitle(p.title))
    .map((p) => ({
      title: p.title as string,
      description: p.description ?? "",
      ...(p.thumbnail?.source ? { thumbnail: p.thumbnail.source } : {}),
    }));
}

/** Normalize a morelike generator response into related candidates. */
export function relatedToCandidates(raw: unknown): RelatedCandidate[] {
  const pages = (raw as { query?: { pages?: ActionPage[] } })?.query?.pages;
  if (!Array.isArray(pages)) return [];
  return [...pages]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .filter((p) => !isDisambiguation(p))
    .map((p) => ({
      pageTitle: p.title ?? "",
      displayTitle: p.title ?? "",
      description: p.description,
      extract: p.extract ? preprocessMath(p.extract) : p.extract,
      imageUrl: p.thumbnail?.source,
      imageFile: p.pageimage,
      source: "wikipedia" as const,
    }))
    .filter((c) => c.pageTitle.length > 0);
}

/**
 * Turn a batch of random Action API pages into cards for the drift buffer.
 * Drops junk, puts imaged cards first, and lets only a limited fraction of
 * imageless "text-only gems" through (spec §5 wants imageless pages to stay a
 * small minority; the cap is 25% of the batch). If a batch
 * happens to have no imaged pages at all, we still return the imageless ones —
 * a text card beats a dead drift. Pure + unit-tested; the route just fetches.
 */
export function selectCardBatch(
  pages: ActionPage[],
  opts: { maxImagelessRatio?: number; credits?: Map<string, ImageCredit> } = {},
): Card[] {
  const maxRatio = opts.maxImagelessRatio ?? 0.25;
  const clean = pages.filter((p) => !isJunkPage(p));
  const imaged = clean.filter((p) => !!p.thumbnail?.source);
  const imageless = clean.filter((p) => !p.thumbnail?.source);
  const cap =
    imaged.length === 0
      ? imageless.length
      : Math.floor((imaged.length * maxRatio) / (1 - maxRatio));
  return [...imaged, ...imageless.slice(0, cap)].map((p) =>
    actionPageToCard(p, opts.credits),
  );
}

/** Build a full Card from a related candidate (no extra fetch needed). For
 *  non-Wikipedia realms the candidate already carries its own `source` and a
 *  ready `sourceUrl` — respect them; only synthesize the Wikipedia URL. */
export function candidateToCard(c: RelatedCandidate): Card {
  const source = c.source ?? "wikipedia";
  const sourceUrl =
    source === "wikipedia" ? titleToSourceUrl(c.pageTitle) : c.sourceUrl ?? "";
  const attribution = attributionFor(source, sourceUrl);
  return {
    pageTitle: c.pageTitle,
    displayTitle: c.displayTitle || c.pageTitle,
    description: c.description,
    extract: c.extract ?? "",
    imageUrl: c.imageUrl,
    sourceUrl,
    source,
    // The image's own creator + licence, resolved when the candidate was fetched
    // so pulling a thread does not cost another lookup (audit B-4).
    ...(c.imageCredit ? { imageCredit: c.imageCredit } : {}),
    ...(attribution ? { attribution } : {}),
    // Carry the Phase-14 rich fields so landing on an art card keeps its museum
    // label / zoom / blur / alt (absent on Wikipedia candidates).
    ...(c.zoomUrl ? { zoomUrl: c.zoomUrl } : {}),
    ...(c.blurDataUrl ? { blurDataUrl: c.blurDataUrl } : {}),
    ...(c.previewUrl ? { previewUrl: c.previewUrl } : {}),
    ...(c.imageAlt ? { imageAlt: c.imageAlt } : {}),
    ...(c.facts ? { facts: c.facts } : {}),
    ...(c.cover ? { cover: c.cover } : {}),
  };
}
