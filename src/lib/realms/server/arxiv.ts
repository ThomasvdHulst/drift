// Server-side arXiv adapter (Papers realm, Phase 17). No API key; arXiv etiquette
// is 1 request / 3 s on a single connection + a descriptive User-Agent, so this
// uses its OWN gate (separate from Wikimedia/AIC). Only CC0 descriptive metadata
// is read; the PDF/source is NEVER rehosted (cards link out to arxiv.org).

import { makeGate, fetchText } from "@/lib/upstream";
import type { Card, RelatedCandidate } from "@/lib/types";
import {
  parseArxivAtom,
  isUsableEntry,
  arxivToCard,
  arxivToCandidate,
  type ArxivEntry,
} from "../arxiv";
import { arxivBucketById, FIELD_STYLES, categoryGroupOf } from "../arxiv.categories";

const API = "https://export.arxiv.org/api/query";
const UA =
  process.env.ARXIV_USER_AGENT ||
  "Drift/0.1 (local hobby project; thomasvdhulst03@gmail.com)";
// arXiv asks for 1 request every 3 seconds on a single connection.
const arxivGate = makeGate(3000);

function headers() {
  return { "Api-User-Agent": UA, "User-Agent": UA };
}

async function search(params: Record<string, string>): Promise<ArxivEntry[]> {
  const url = `${API}?${new URLSearchParams(params).toString()}`;
  const xml = await fetchText(url, {
    headers: headers(),
    gate: arxivGate,
    timeoutMs: 8000,
  });
  return parseArxivAtom(xml).filter(isUsableEntry);
}

export async function arxivDiscover(
  bucketId: string,
  offset: number,
  limit: number,
): Promise<Card[]> {
  const bucket = arxivBucketById(bucketId);
  if (!bucket) return [];
  const lim = Math.min(Math.max(limit, 1), 20);
  // A bounded random start into the category's date-sorted results gives variety
  // across sessions without paging so deep that queries get slow / sparse.
  const SPREAD = 300;
  const start = Math.max(0, offset % SPREAD);
  const base = {
    search_query: bucket.query,
    max_results: String(lim),
    sortBy: "submittedDate",
    sortOrder: "descending",
  };
  let entries = await search({ ...base, start: String(start) });
  if (entries.length === 0 && start > 0) {
    entries = await search({ ...base, start: "0" });
  }
  return entries.map(arxivToCard);
}

export async function arxivRelated(id: string): Promise<RelatedCandidate[]> {
  const [self] = await search({ id_list: id, max_results: "1" });
  if (!self) return [];
  const out: RelatedCandidate[] = [];
  const used = new Set<string>([self.id]);
  const add = (list: ArxivEntry[], label: string, facet: string, eyebrow: string) => {
    for (const e of list) {
      if (used.has(e.id)) continue;
      used.add(e.id);
      out.push(arxivToCandidate(e, label, facet, eyebrow));
    }
  };

  // "More in {field}" — other recent papers in the same primary category.
  const cat = self.primaryCategory ?? self.categories[0];
  if (cat) {
    try {
      const fieldLabel = FIELD_STYLES[categoryGroupOf(cat)].label;
      add(
        await search({
          search_query: `cat:${cat}`,
          max_results: "5",
          sortBy: "submittedDate",
          sortOrder: "descending",
        }),
        `${fieldLabel} · ${cat}`,
        `category:${cat}`,
        "More in",
      );
    } catch {
      /* facet best-effort */
    }
  }

  // "More by {author}" — other papers by the first author (last-name match).
  const firstAuthor = self.authors[0];
  if (firstAuthor) {
    const lastName = firstAuthor.split(/\s+/).filter(Boolean).pop();
    if (lastName) {
      try {
        add(
          await search({ search_query: `au:${lastName}`, max_results: "5" }),
          firstAuthor,
          `author:${lastName}`,
          "More by",
        );
      } catch {
        /* facet best-effort */
      }
    }
  }
  return out;
}

export async function arxivSummary(id: string): Promise<Card | null> {
  const [e] = await search({ id_list: id, max_results: "1" });
  return e ? arxivToCard(e) : null;
}

// arXiv abstracts are a single block already shown in full on the card, so
// "read more" has nothing further to reveal (the real "more" is the linked PDF).
export async function arxivExtended(
  id: string,
): Promise<{ extract: string; hasMore: boolean } | null> {
  const [e] = await search({ id_list: id, max_results: "1" });
  return e ? { extract: e.summary, hasMore: false } : null;
}
