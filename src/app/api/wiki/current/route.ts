import { NextResponse } from "next/server";
import { wikiQuery, CARD_PROPS } from "@/lib/wiki-server";
import { actionPageToCard, isJunkPage, type ActionPage } from "@/lib/wiki";
import {
  sectionById,
  dayPageTitles,
  parseCurrentEvents,
  rankCurrent,
  type CurrentEntry,
} from "@/lib/current";
import { cacheHeaders, CACHE_MEDIUM, NO_STORE } from "@/lib/cache-headers";

// GET /api/wiki/current?section=<slug>&offset=<n>&limit=<n>
// → `{ card, daysAgo }[]` for the Wikipedia articles behind that section's
// recent news, best-first. `daysAgo` is how recently the article was linked from
// a news story, which the feed turns into the honest "In the news · 3 days ago"
// chip (§2.1: the card always says why it appeared).
//
// Source + licensing: Wikipedia's own `Portal:Current events` day pages. We read
// only the LINK TARGETS out of them; no headline, summary or external source is
// stored or served, so this adds no licensing exposure over the Encyclopedia
// realm it already ships (see lib/current.ts for the full note).
//
// Graceful like every optional dependency (§4): any upstream failure returns []
// with NO_STORE, never a 500, so the feed falls back instead of breaking.

// A month is the sweet spot, measured: 7 days starves the quiet sections
// (Science and technology drops to ~20 articles) while 30 keeps all ten viable
// and still fits the Action API's 50-title limit in ONE request.
const WINDOW_DAYS = 30;
// If a section is unusually quiet, look back further once before giving up.
const WIDE_WINDOW_DAYS = 60;
const MIN_SEEDS = 8;
// The Action API caps `exlimit` at 20, so a page of the pool is at most 20.
const MAX_LIMIT = 20;
const TITLES_PER_QUERY = 50;

// Parsed day-page entries are identical for all ten sections, so one instance
// serving ten section requests should read Wikipedia once, not ten times. Short
// TTL because today's page keeps being edited. (The edge cache in front of this
// route is the real saving; this just avoids silly repetition within an instance.)
const POOL_TTL_MS = 15 * 60 * 1000;
let poolCache: { key: string; at: number; entries: CurrentEntry[] } | null = null;

async function fetchDayPages(titles: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < titles.length; i += TITLES_PER_QUERY) {
    const raw = await wikiQuery({
      titles: titles.slice(i, i + TITLES_PER_QUERY).join("|"),
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      format: "json",
      formatversion: "2",
    });
    const pages =
      (raw as {
        query?: {
          pages?: {
            title?: string;
            missing?: boolean;
            revisions?: { slots?: { main?: { content?: string } } }[];
          }[];
        };
      })?.query?.pages ?? [];
    // Re-key by title: the API does not preserve the requested order, and an
    // entry's position in `titles` IS its age in days (dayPageTitles is newest
    // first), which the ranking weights by.
    const byTitle = new Map(
      pages.map((p) => [p.title ?? "", p.revisions?.[0]?.slots?.main?.content ?? ""]),
    );
    for (const t of titles.slice(i, i + TITLES_PER_QUERY)) out.push(byTitle.get(t) ?? "");
  }
  return out;
}

/** Every tracked wikilink from the last `days` of Portal:Current events. */
async function loadEntries(days: number): Promise<CurrentEntry[]> {
  const titles = dayPageTitles(new Date(), days);
  const key = `${days}:${titles[0]}`;
  if (poolCache && poolCache.key === key && Date.now() - poolCache.at < POOL_TTL_MS) {
    return poolCache.entries;
  }
  const wikitexts = await fetchDayPages(titles);
  const entries = wikitexts.flatMap((w, daysAgo) =>
    w ? parseCurrentEvents(w, daysAgo) : [],
  );
  poolCache = { key, at: Date.now(), entries };
  return entries;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const section = sectionById(url.searchParams.get("section"));
  if (!section) {
    return NextResponse.json(
      { error: "unknown section" },
      { status: 400, headers: NO_STORE },
    );
  }

  const offsetNum = Number(url.searchParams.get("offset"));
  const offset =
    Number.isFinite(offsetNum) && offsetNum >= 0 ? Math.min(offsetNum, 1000) : 0;
  const limitNum = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitNum) && limitNum > 0
      ? Math.min(limitNum, MAX_LIMIT)
      : MAX_LIMIT;

  try {
    let ranked = rankCurrent(await loadEntries(WINDOW_DAYS), section.id);
    if (ranked.length < MIN_SEEDS) {
      ranked = rankCurrent(await loadEntries(WIDE_WINDOW_DAYS), section.id);
    }
    const page = ranked.slice(offset, offset + limit);
    if (page.length === 0) {
      return NextResponse.json([], { headers: NO_STORE });
    }

    const raw = await wikiQuery({
      titles: page.map((r) => r.title).join("|"),
      redirects: "1",
      exlimit: "max", // without this only the FIRST page gets its extract
      ...CARD_PROPS,
    });
    const query = (raw as {
      query?: {
        pages?: ActionPage[];
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
      };
    })?.query;

    // Follow normalization + redirects so a requested title still maps to the
    // page that came back, and keep the ranked order: the ranking is the whole
    // point here, so we deliberately do NOT reshuffle imaged-first the way
    // selectCardBatch does for random discovery.
    const resolve = new Map<string, string>();
    for (const r of [...(query?.normalized ?? []), ...(query?.redirects ?? [])]) {
      resolve.set(r.from, r.to);
    }
    const finalTitle = (t: string) => {
      let cur = t;
      for (let hop = 0; hop < 4; hop++) {
        const next = resolve.get(cur);
        if (!next || next === cur) break;
        cur = next;
      }
      return cur;
    };
    const byTitle = new Map((query?.pages ?? []).map((p) => [p.title ?? "", p]));

    const cards = page
      .map((r) => ({ page: byTitle.get(finalTitle(r.title)), daysAgo: r.daysAgo }))
      .filter(
        (e): e is { page: ActionPage; daysAgo: number } =>
          !!e.page && !e.page.missing && !isJunkPage(e.page),
      )
      .map((e) => ({ card: actionPageToCard(e.page), daysAgo: e.daysAgo }));

    return NextResponse.json(cards, {
      // Only cache a real batch: an empty result is more likely a transient
      // upstream hiccup than a genuinely quiet section, and caching that would
      // freeze the section empty for the whole edge population.
      headers: cards.length ? cacheHeaders(CACHE_MEDIUM) : NO_STORE,
    });
  } catch (err) {
    console.error("[api/wiki/current]", err);
    return NextResponse.json([], { status: 200, headers: NO_STORE });
  }
}
