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

async function searchMeta(
  params: Record<string, string>,
): Promise<{ arts: ArticArtwork[]; totalPages: number }> {
  const url = `${API}/artworks/search?${new URLSearchParams(params).toString()}`;
  const raw = (await fetchJson(url, {
    headers: headers(),
    gate: articGate,
    timeoutMs: 6000,
  })) as { data?: ArticArtwork[]; pagination?: { total_pages?: number } };
  const data = raw?.data;
  return {
    arts: Array.isArray(data) ? data : [],
    totalPages: Math.max(1, raw?.pagination?.total_pages ?? 1),
  };
}

async function search(params: Record<string, string>): Promise<ArticArtwork[]> {
  return (await searchMeta(params)).arts;
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

// Public-domain + a structured field `match` (a movement / classification /
// subject). Cleaner than full-text for distinctive fields. Field + value come
// from our bucket definitions (never user input).
function pdMatch(field: string, value: string, limit: number, extra: Record<string, string> = {}) {
  return {
    "query[bool][must][0][term][is_public_domain]": "true",
    [`query[bool][must][1][match][${field}]`]: value,
    fields: ARTIC_FIELDS,
    limit: String(limit),
    ...extra,
  };
}

export async function articDiscover(
  bucketId: string,
  offset: number,
  limit: number,
): Promise<Card[]> {
  const bucket = articBucketById(bucketId);
  if (!bucket) return [];
  const lim = Math.min(Math.max(limit, 1), 20);
  const base = bucket.filter
    ? pdMatch(bucket.filter.field, bucket.filter.value, lim)
    : pdText(bucket.q, lim);
  // Vary which slice we draw from (results are relevance-sorted). Sample deeper
  // than before (page ≤ SPREAD) for real variety across sessions; if that page
  // overshoots the set (now that we know total_pages), fall back to a valid one.
  const SPREAD = 30;
  const pageWithin = (max: number) => 1 + (offset % Math.max(1, Math.min(SPREAD, max)));
  const first = await searchMeta({ ...base, page: String(pageWithin(SPREAD)) });
  let arts = first.arts;
  if (arts.length === 0 && first.totalPages > 1) {
    arts = (await searchMeta({ ...base, page: String(pageWithin(first.totalPages)) })).arts;
  }
  return arts.filter(isUsableArtwork).map(articToCard);
}

export async function articRelated(id: string): Promise<RelatedCandidate[]> {
  const art = await detail(id);
  if (!art) return [];
  const out: RelatedCandidate[] = [];
  const usedIds = new Set<string>([String(art.id)]);
  // `eyebrow` = the facet character shown above the label ("MORE BY" / "THE
  // MOVEMENT" / …); `label` = the destination entity (artist / movement / …).
  const add = (list: ArticArtwork[], label: string, facet: string, eyebrow: string) => {
    for (const a of list) {
      if (!isUsableArtwork(a) || usedIds.has(String(a.id))) continue;
      usedIds.add(String(a.id));
      out.push(articToCandidate(a, label, facet, eyebrow));
    }
  };

  // Directions with character (mirrors the Encyclopedia's deeper/broader/tangent):
  //   artist = deeper into an oeuvre, movement = the broader context, subject = a
  //   lateral tangent, place = a fallback. Each facet is best-effort and only
  //   contributes a chip if it actually finds other works (so a single-work artist
  //   yields no dead chip). Order sets the default trio; selectFacetThreads takes
  //   one per distinct facet.
  if (art.artist_id && art.artist_title) {
    try {
      let byArtist = await search(pdTerm("artist_id", String(art.artist_id), 4));
      if (byArtist.length === 0) byArtist = await search(pdText(art.artist_title, 4));
      add(byArtist, art.artist_title, `artist:${art.artist_id}`, "More by");
    } catch {
      /* facet best-effort */
    }
  }
  if (art.style_title) {
    try {
      add(await search(pdText(art.style_title, 4)), art.style_title, `style:${art.style_title}`, "The movement");
    } catch {
      /* facet best-effort */
    }
  }
  const subject = (art.subject_titles ?? []).map((s) => s.trim()).filter(Boolean)[0];
  if (subject) {
    try {
      add(await search(pdText(subject, 4)), subject, `subject:${subject}`, "The subject");
    } catch {
      /* facet best-effort */
    }
  }
  if (art.place_of_origin) {
    try {
      add(await search(pdText(art.place_of_origin, 4)), art.place_of_origin, `place:${art.place_of_origin}`, "Also from");
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
