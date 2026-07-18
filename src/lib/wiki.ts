import type { Card, RelatedCandidate } from "./types";

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
export function actionPageToCard(page: ActionPage): Card {
  const pageTitle = page.title ?? "";
  return {
    pageTitle,
    displayTitle: pageTitle,
    description: page.description,
    extract: page.extract ?? "",
    imageUrl: page.thumbnail?.source,
    sourceUrl:
      page.canonicalurl ?? page.fullurl ?? titleToSourceUrl(pageTitle),
    source: "wikipedia",
  };
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
      extract: p.extract,
      imageUrl: p.thumbnail?.source,
      source: "wikipedia" as const,
    }))
    .filter((c) => c.pageTitle.length > 0);
}

/**
 * Turn a batch of random Action API pages into cards for the drift buffer.
 * Drops junk, puts imaged cards first, and lets only a limited fraction of
 * imageless "text-only gems" through (spec §5 allows ~20% imageless). If a batch
 * happens to have no imaged pages at all, we still return the imageless ones —
 * a text card beats a dead drift. Pure + unit-tested; the route just fetches.
 */
export function selectCardBatch(
  pages: ActionPage[],
  opts: { maxImagelessRatio?: number } = {},
): Card[] {
  const maxRatio = opts.maxImagelessRatio ?? 0.25;
  const clean = pages.filter((p) => !isJunkPage(p));
  const imaged = clean.filter((p) => !!p.thumbnail?.source);
  const imageless = clean.filter((p) => !p.thumbnail?.source);
  const cap =
    imaged.length === 0
      ? imageless.length
      : Math.floor((imaged.length * maxRatio) / (1 - maxRatio));
  return [...imaged, ...imageless.slice(0, cap)].map(actionPageToCard);
}

/** Build a full Card from a related candidate (no extra fetch needed). For
 *  non-Wikipedia realms the candidate already carries its own `source` and a
 *  ready `sourceUrl` — respect them; only synthesize the Wikipedia URL. */
export function candidateToCard(c: RelatedCandidate): Card {
  const source = c.source ?? "wikipedia";
  return {
    pageTitle: c.pageTitle,
    displayTitle: c.displayTitle || c.pageTitle,
    description: c.description,
    extract: c.extract ?? "",
    imageUrl: c.imageUrl,
    sourceUrl:
      source === "wikipedia" ? titleToSourceUrl(c.pageTitle) : c.sourceUrl ?? "",
    source,
    // Carry the Phase-14 rich fields so landing on an art card keeps its museum
    // label / zoom / blur / alt (absent on Wikipedia candidates).
    ...(c.zoomUrl ? { zoomUrl: c.zoomUrl } : {}),
    ...(c.blurDataUrl ? { blurDataUrl: c.blurDataUrl } : {}),
    ...(c.imageAlt ? { imageAlt: c.imageAlt } : {}),
    ...(c.facts ? { facts: c.facts } : {}),
    ...(c.cover ? { cover: c.cover } : {}),
  };
}
