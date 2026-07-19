// Server-side Wikipedia content adapter. This is the existing route logic
// relocated behind functions so both the Encyclopedia and Today realms can share
// it (Today's cards *are* Wikipedia articles). No behaviour change — the generic
// /api/realm/[realm]/* routes call these instead of the old /api/wiki/* routes.

import { wikiQuery, CARD_PROPS } from "@/lib/wiki-server";
import {
  relatedToCandidates,
  firstPage,
  actionPageToCard,
  selectCardBatch,
  type ActionPage,
} from "@/lib/wiki";
import { topParagraphs } from "@/lib/extract";
import { preprocessMath } from "@/lib/mathtext";
import type { Card, RelatedCandidate } from "@/lib/types";

/** morelike related candidates for a title (client selects the diverse 3). */
export async function wikiRelated(title: string): Promise<RelatedCandidate[]> {
  const raw = await wikiQuery({
    generator: "search",
    gsrsearch: `morelike:${title}`,
    gsrnamespace: "0",
    gsrlimit: "20",
    prop: "pageimages|description|extracts|pageprops",
    exintro: "1",
    explaintext: "1",
    exsentences: "2",
    piprop: "thumbnail",
    pithumbsize: "800",
    ppprop: "disambiguation",
    format: "json",
    formatversion: "2",
  });
  return relatedToCandidates(raw);
}

/** A Card for an exact title (seed entry / canonical lookup). `full` drops the
 *  sentence cap so the extract is the whole intro. null if the page is missing. */
export async function wikiSummary(
  title: string,
  opts: { full?: boolean } = {},
): Promise<Card | null> {
  const props = { ...CARD_PROPS };
  if (opts.full) delete (props as Record<string, string>).exsentences;
  const raw = await wikiQuery({ titles: title, redirects: "1", ...props });
  const page = firstPage(raw);
  if (!page || page.missing || !page.title) return null;
  return actionPageToCard(page);
}

/** The first several BODY paragraphs for "Read more". null if page missing. */
export async function wikiExtended(
  title: string,
): Promise<{ extract: string; hasMore: boolean } | null> {
  const raw = await wikiQuery({
    titles: title,
    redirects: "1",
    prop: "extracts",
    explaintext: "1",
    exsectionformat: "wiki",
    format: "json",
    formatversion: "2",
  });
  const page = firstPage(raw);
  if (!page || page.missing) return null;
  // Convert <math> garble → clean inline LaTeX markers BEFORE paragraph slicing:
  // the garble's stray newlines would otherwise corrupt topParagraphs' splitting.
  const { text, hasMore } = topParagraphs(preprocessMath(page.extract ?? ""));
  return { extract: text, hasMore };
}

/** A batch of popular, on-topic, varied cards for the Encyclopedia drift buffer
 *  (CirrusSearch `articletopic:` + incoming-links floor + random offset). */
export async function wikiDiscoverTopic(
  keyword: string,
  offset: number,
  limit: number,
): Promise<Card[]> {
  const raw = await wikiQuery({
    generator: "search",
    gsrsearch: `articletopic:${keyword}`,
    gsrsort: "incoming_links_desc",
    gsroffset: String(offset),
    gsrnamespace: "0",
    gsrlimit: String(limit),
    ...CARD_PROPS,
  });
  const pages =
    (raw as { query?: { pages?: ActionPage[] } })?.query?.pages ?? [];
  return selectCardBatch(pages);
}
