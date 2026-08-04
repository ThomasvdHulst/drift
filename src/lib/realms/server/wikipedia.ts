// Server-side Wikipedia content adapter: the Encyclopedia realm's discover /
// related / summary / extended implementations, behind plain functions so the
// generic /api/realm/[realm]/* routes stay source-agnostic.

import {
  wikiQuery,
  wikiParse,
  CARD_PROPS,
  fetchImageCredits,
} from "@/lib/wiki-server";
import {
  htmlBlocks,
  htmlToText,
  infoboxFacts,
  takeBlocks,
  blocksToText,
  type Block,
  type Fact,
} from "@/lib/wikihtml";
import {
  relatedToCandidates,
  firstPage,
  actionPageToCard,
  selectCardBatch,
  topicSearch,
  type ActionPage,
} from "@/lib/wiki";
import { fileKey } from "@/lib/imagecredit";
import { topParagraphs } from "@/lib/extract";
import { preprocessMath } from "@/lib/mathtext";
import { leadLinks, pickBridges } from "@/lib/bridge";
import type { Bridge, Card, ExtendedBody, RelatedCandidate } from "@/lib/types";

/**
 * The article's own lead, turned into "why is this thread here?" answers
 * (Phase 28): for each candidate the lead actually links to, the sentence it is
 * linked in. See lib/bridge.ts for the rules the quote has to pass.
 *
 * Costs ONE extra Wikimedia call per card, and buys the app its first honest
 * answer to the question principle §2.1 promises. It is also entirely optional,
 * so it is fetched on the terms an optional thing deserves: a short timeout, no
 * retry, every failure swallowed. Threads are never delayed or lost for it.
 */
const BRIDGE_TIMEOUT_MS = 2500;

async function leadBridges(
  title: string,
  candidateTitles: string[],
): Promise<Map<string, Bridge>> {
  if (candidateTitles.length === 0) return new Map();
  try {
    const parsed = await wikiParse(
      { page: title, section: "0" },
      { retries: 0, timeoutMs: BRIDGE_TIMEOUT_MS },
    );
    const html = (parsed as { parse?: { text?: string } })?.parse?.text;
    if (!html) return new Map();
    const links = leadLinks(html);
    // The card shows the lead's first sentences, so the opening paragraph is
    // what the reader is already looking at: `avoid` demotes it, and bridges
    // come from further down the lead wherever the lead offers a choice.
    const firstParagraph = htmlBlocks(html).find((b) => b.kind === "p");
    return pickBridges(candidateTitles, links, {
      avoid: firstParagraph?.kind === "p" ? firstParagraph.text : undefined,
    });
  } catch {
    return new Map(); // no bridges; the chips read exactly as they did before
  }
}

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
    piprop: "thumbnail|name",
    pilicense: "free", // never a fair-use file; see CARD_PROPS in lib/wiki-server.ts
    pithumbsize: "800",
    ppprop: "disambiguation",
    format: "json",
    formatversion: "2",
  });
  const candidates = relatedToCandidates(raw);
  // A thread chip shows a thumbnail, and pulling it LANDS the candidate as a
  // card, so its image needs the same credit the card path fetches. One batched
  // call for all 20 candidates.
  const credits = await fetchImageCredits(
    candidates.map((c) => c.imageFile ?? "").filter(Boolean),
  );
  // Relevance order matters here: when two candidates can only be explained by
  // the same sentence, `pickBridges` gives it to the earlier one.
  const bridges = await leadBridges(
    title,
    candidates.map((c) => c.pageTitle),
  );
  return candidates.map((c) => {
    const credit = c.imageFile ? credits.get(fileKey(c.imageFile)) : undefined;
    const bridge = bridges.get(c.pageTitle);
    return credit || bridge
      ? { ...c, ...(credit ? { imageCredit: credit } : {}), ...(bridge ? { bridge } : {}) }
      : c;
  });
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
  const credits = page.pageimage
    ? await fetchImageCredits([page.pageimage])
    : undefined;
  return actionPageToCard(page, credits);
}

/**
 * The body a card reveals on "Read more": paragraphs AND the tables between them,
 * plus the page's infobox as label/value facts (Phase 26).
 *
 * Built from the article's real HTML, section by section, because `prop=extracts`
 * keeps prose and drops everything else — which is how a paragraph reading "as the
 * table below shows" ended up on a card with no table anywhere.
 *
 * The walk is deliberately incremental: the LEAD alone usually carries 3 to 6
 * paragraphs, so filling the same 8-paragraph budget the plaintext path uses takes
 * one or two more sections, at 12 to 40KB each, rather than the 174 to 824KB the
 * whole page would cost. It stops the moment the budget is full, and never makes
 * more than `MAX_SECTIONS` requests. The route caches the answer for a day, so a
 * second reader of the same page costs nothing at all.
 *
 * Any failure falls back to the plaintext path (§4): a reader can never end up
 * with less than they had before this existed.
 */
const MAX_SECTIONS = 4; // the lead + up to 3 body sections
const MIN_BLOCK_PARAGRAPHS = 2; // fewer than this and we do not trust the parse

export async function wikiExtended(title: string): Promise<ExtendedBody | null> {
  try {
    const rich = await wikiExtendedBlocks(title);
    if (rich) return rich;
  } catch {
    /* fall through to the plaintext body */
  }
  return wikiExtendedText(title);
}

/** The HTML path: ordered blocks + infobox facts, or null to fall back. */
async function wikiExtendedBlocks(title: string): Promise<ExtendedBody | null> {
  const blocks: Block[] = [];
  let facts: Fact[] = [];

  for (let section = 0; section < MAX_SECTIONS; section++) {
    const parsed = await wikiParse({ page: title, section: String(section) });
    const data = parsed as {
      parse?: { text?: string; title?: string };
      error?: { code?: string };
    };
    // `nosuchsection` just means the article ended; anything else on the FIRST
    // request means we have nothing, so let the caller fall back.
    if (data.error || !data.parse?.text) {
      if (section === 0) return null;
      break;
    }
    const html = data.parse.text;
    if (section === 0) facts = infoboxFacts(html);
    // A section's own heading is not rendered (the plaintext path drops headings
    // too: readers wanted continuous prose), but it names a table that has no
    // caption of its own.
    blocks.push(...htmlBlocks(html, { caption: sectionHeading(html) }));
    const soFar = takeBlocks(blocks);
    if (soFar.hasMore) break; // budget already full: stop asking for more
  }

  const taken = takeBlocks(blocks);
  const paragraphs = taken.blocks.filter((b) => b.kind === "p").length;
  if (paragraphs < MIN_BLOCK_PARAGRAPHS) return null; // thin parse: fall back
  return {
    extract: blocksToText(taken.blocks),
    hasMore: taken.hasMore,
    blocks: taken.blocks,
    ...(facts.length > 0 ? { facts } : {}),
  };
}

/** The section's `<h2>`/`<h3>` text, used as a table's fallback caption. */
function sectionHeading(html: string): string | undefined {
  const m = /<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i.exec(html);
  const text = m ? htmlToText(m[1]) : "";
  return text || undefined;
}

/** The original plaintext body: still the fallback, unchanged. */
async function wikiExtendedText(title: string): Promise<ExtendedBody | null> {
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
 *  (CirrusSearch `articletopic:` + incoming-links floor + random offset). The
 *  search excludes list/index titles rather than filtering them afterwards; see
 *  `topicSearch` for why that is the difference between a field drift working
 *  and reporting "couldn't load". */
export async function wikiDiscoverTopic(
  keyword: string,
  offset: number,
  limit: number,
): Promise<Card[]> {
  const raw = await wikiQuery({
    generator: "search",
    gsrsearch: topicSearch(keyword),
    gsrsort: "incoming_links_desc",
    gsroffset: String(offset),
    gsrnamespace: "0",
    gsrlimit: String(limit),
    ...CARD_PROPS,
  });
  const pages =
    (raw as { query?: { pages?: ActionPage[] } })?.query?.pages ?? [];
  // ONE extra Wikimedia call for the whole batch: each image's own creator and
  // licence, which are not the article's (compliance audit B-4). An image whose
  // credit cannot be established is not displayed, so this is not optional.
  const credits = await fetchImageCredits(
    pages.map((p) => p.pageimage ?? "").filter(Boolean),
  );
  return selectCardBatch(pages, { credits });
}
