// Server-side Art Institute of Chicago adapter (Gallery realm). No API key; the
// AIC etiquette is a descriptive `AIC-User-Agent`. Public-domain only. Uses its
// own request-spacing gate (separate from Wikimedia's).

import { makeGate, fetchJson } from "@/lib/upstream";
import type { Card, RelatedCandidate } from "@/lib/types";
import {
  articToCard,
  articToCandidate,
  isUsableArtwork,
  ARTIC_FIELDS,
  type ArticArtwork,
} from "../artic";
import { articBucketById } from "../artic.buckets";

const API = "https://api.artic.edu/api/v1";
const UA =
  process.env.ARTIC_USER_AGENT ||
  "Drift/0.1 (local hobby project; thomas@onspect.nl)";
const articGate = makeGate(250);

function headers() {
  return { "AIC-User-Agent": UA, "User-Agent": UA };
}

async function search(params: Record<string, string>): Promise<ArticArtwork[]> {
  const url = `${API}/artworks/search?${new URLSearchParams(params).toString()}`;
  const raw = await fetchJson(url, {
    headers: headers(),
    gate: articGate,
    timeoutMs: 6000,
  });
  const data = (raw as { data?: ArticArtwork[] })?.data;
  return Array.isArray(data) ? data : [];
}

async function detail(id: string): Promise<ArticArtwork | null> {
  const url = `${API}/artworks/${encodeURIComponent(id)}?fields=${ARTIC_FIELDS},description,provenance_text`;
  const raw = await fetchJson(url, {
    headers: headers(),
    gate: articGate,
    timeoutMs: 6000,
  });
  const d = (raw as { data?: ArticArtwork })?.data;
  return d ?? null;
}

// Public-domain full-text search (theme term). q + a single is_public_domain term.
function pdText(q: string, limit: number, extra: Record<string, string> = {}) {
  return {
    q,
    "query[term][is_public_domain]": "true",
    fields: ARTIC_FIELDS,
    limit: String(limit),
    ...extra,
  };
}

// Public-domain exact-field match (e.g. artist_id) — bool/must so two terms are
// legal ES (a single `term` can't hold two fields).
function pdTerm(field: string, value: string, limit: number) {
  return {
    "query[bool][must][0][term][is_public_domain]": "true",
    [`query[bool][must][1][term][${field}]`]: value,
    fields: ARTIC_FIELDS,
    limit: String(limit),
  };
}

export async function articDiscover(
  bucketId: string,
  offset: number,
  limit: number,
): Promise<Card[]> {
  const bucket = articBucketById(bucketId);
  if (!bucket) return [];
  // Vary which slice of the theme we get (relevance-sorted; a modest random page
  // keeps results recognizable, not obscure).
  const page = 1 + (offset % 12);
  const arts = await search(
    pdText(bucket.q, Math.min(Math.max(limit, 1), 20), { page: String(page) }),
  );
  return arts.filter(isUsableArtwork).map(articToCard);
}

export async function articRelated(id: string): Promise<RelatedCandidate[]> {
  const art = await detail(id);
  if (!art) return [];
  const out: RelatedCandidate[] = [];
  const usedIds = new Set<string>([String(art.id)]);
  const add = (list: ArticArtwork[], label: string, facet: string) => {
    for (const a of list) {
      if (!isUsableArtwork(a) || usedIds.has(String(a.id))) continue;
      usedIds.add(String(a.id));
      out.push(articToCandidate(a, label, facet));
    }
  };

  // Three real "directions": same artist, same style, same place. Each survives
  // independently — a failing facet just contributes nothing.
  if (art.artist_id && art.artist_title) {
    try {
      let byArtist = await search(pdTerm("artist_id", String(art.artist_id), 4));
      if (byArtist.length === 0) byArtist = await search(pdText(art.artist_title, 4));
      add(byArtist, `More by ${art.artist_title}`, `artist:${art.artist_id}`);
    } catch {
      /* facet best-effort */
    }
  }
  if (art.style_title) {
    try {
      add(await search(pdText(art.style_title, 4)), `Other ${art.style_title}`, `style:${art.style_title}`);
    } catch {
      /* facet best-effort */
    }
  }
  if (art.place_of_origin) {
    try {
      add(
        await search(pdText(art.place_of_origin, 4)),
        `Also from ${art.place_of_origin}`,
        `place:${art.place_of_origin}`,
      );
    } catch {
      /* facet best-effort */
    }
  }
  return out;
}

export async function articSummary(id: string): Promise<Card | null> {
  const art = await detail(id);
  return isUsableArtwork(art) ? articToCard(art) : null;
}

export async function articExtended(
  id: string,
): Promise<{ extract: string; hasMore: boolean } | null> {
  const art = await detail(id);
  if (!art) return null;
  const strip = (s?: string | null) => (s ?? "").replace(/<[^>]+>/g, "").trim();
  const parts = [strip(art.description), strip(art.provenance_text)].filter(Boolean);
  return { extract: parts.join("\n\n"), hasMore: false };
}
