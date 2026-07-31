// Server-side Art Institute of Chicago adapter (Gallery realm). No API key; the
// AIC etiquette is a descriptive `AIC-User-Agent`. Public-domain only. Uses its
// own request-spacing gate (separate from Wikimedia's).

import { makeGate, fetchJson } from "@/lib/upstream";
import type { Card, RelatedCandidate } from "@/lib/types";
import {
  articImageUrl,
  articToCard,
  articToCandidate,
  isUsableArtwork,
  ARTIC_FIELDS,
  type ArticArtwork,
} from "../artic";
import { articBucketById } from "../artic.buckets";
import {
  ARTIC_ERAS,
  articEraById,
  parseFormBucket,
  worksInSlice,
  type ArticEra,
  type ArticForm,
} from "../artic.forms";
import {
  isMovement,
  movementHolds,
  parseArtistBucket,
  rankArtists,
  type ArtistMatch,
  type ArtistProfile,
  type ArtistRing,
} from "../artic.artist";
import {
  artworkEuPublicDomain,
  artistsOutOfCopyright,
  attributedArtistIds,
  type ArticAgent,
} from "../artic.publicdomain";

const API = "https://api.artic.edu/api/v1";
const UA =
  process.env.ARTIC_USER_AGENT ||
  "Drift/1.0 (https://www.usedrift.org; thomasvdhulst03@gmail.com)";
const articGate = makeGate(250);

function headers() {
  return { "AIC-User-Agent": UA, "User-Agent": UA };
}

/**
 * The Art Institute states the licence of every API response in `info.license_text`,
 * and its own api-data repository asks callers to check it: "Note that all content
 * may have different licensing terms. Please be mindful of the `info.license_text`
 * and `info.license_links` fields within each JSON data file."
 *
 * Drift was not reading it, and was relying on `is_public_domain` alone plus an
 * assumption about the terms (compliance audit Mi-1, Q-12). Since the museum's
 * grant for commercial use is bounded BY the CC0 designation, a response that does
 * not carry it is a response Drift may not use. So this refuses rather than
 * assumes: no CC0 statement, no cards.
 */
function isCC0Response(raw: unknown): boolean {
  const text = (raw as { info?: { license_text?: unknown } })?.info?.license_text;
  if (typeof text !== "string") return false;
  return /creative commons zero|\bcc0\b/i.test(text);
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
  if (!isCC0Response(raw)) {
    console.warn("[artic] response is not CC0-designated; refusing to use it");
    return { arts: [], totalPages: 1 };
  }
  const data = raw?.data;
  return {
    arts: Array.isArray(data) ? data : [],
    totalPages: Math.max(1, raw?.pagination?.total_pages ?? 1),
  };
}

async function search(params: Record<string, string>): Promise<ArticArtwork[]> {
  return (await searchMeta(params)).arts;
}

// ---------------------------------------------------------------------------
// The EU public-domain gate (compliance audit M-4).
//
// `is_public_domain` is the museum's US determination: 95 years from
// publication. Europe runs on life of the author plus 70, so the museum's flag
// admits plenty of work that is still in copyright here. The rules live in
// artic.publicdomain.ts; this half fetches the artist records they need.
//
// COST. One extra request per batch, not per artwork: `/agents?ids=a,b,c` takes
// a list. Artist records are pure biography and change only when the museum
// re-catalogues, so they are cached for the life of the serverless instance and
// a long session usually pays for the lookup once. A cold instance re-measures,
// which is the same bargain `profileCache` below already makes.
//
// FAILURE. A lookup that fails yields no agents, and an artist we cannot resolve
// counts as "death date unknown", which sends the work to the pre-1830 date
// proxy. So an upstream hiccup narrows the Gallery to old work rather than
// emptying it.
// ---------------------------------------------------------------------------

const agentCache = new Map<number, ArticAgent>();

/** Look up artist records for these ids, using the cache and asking upstream
 *  only for the ones missing. Never throws. */
async function fetchAgents(ids: number[]): Promise<Map<number, ArticAgent>> {
  const out = new Map<number, ArticAgent>();
  const missing: number[] = [];
  for (const id of ids) {
    const hit = agentCache.get(id);
    if (hit) out.set(id, hit);
    else missing.push(id);
  }
  if (missing.length === 0) return out;

  // The museum caps a multi-id request; chunk rather than risk a silent truncation.
  const CHUNK = 50;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const chunk = missing.slice(i, i + CHUNK);
    try {
      const url = `${API}/agents?ids=${chunk.join(",")}&fields=id,title,birth_date,death_date&limit=${chunk.length}`;
      const raw = await fetchJson(url, {
        headers: headers(),
        gate: articGate,
        timeoutMs: 6000,
      });
      if (!isCC0Response(raw)) continue;
      for (const a of ((raw as { data?: ArticAgent[] })?.data ?? [])) {
        if (!a || !Number.isFinite(a.id)) continue;
        agentCache.set(a.id, a);
        out.set(a.id, a);
      }
    } catch {
      // Leave them unresolved; the date proxy decides.
    }
  }
  return out;
}

/**
 * Keep only the artworks that are out of copyright in the EU. This is the one
 * place the rule is applied, so every seam that produces a Gallery card goes
 * through it and none can be added later that skips it.
 */
async function euPublicDomain(arts: ArticArtwork[]): Promise<ArticArtwork[]> {
  if (arts.length === 0) return arts;
  const ids = new Set<number>();
  for (const a of arts) for (const id of attributedArtistIds(a)) ids.add(id);
  const agents = await fetchAgents([...ids]);
  const kept = arts.filter((a) => artworkEuPublicDomain(a, agents).ok);
  if (kept.length !== arts.length) {
    console.info(
      `[artic] EU public-domain filter dropped ${arts.length - kept.length}/${arts.length}`,
    );
  }
  return kept;
}

/** `filter(isUsableArtwork)` plus the EU term test, which is what every card
 *  seam wants. Kept as one call so the two can never drift apart. */
async function usable(arts: ArticArtwork[]): Promise<ArticArtwork[]> {
  return euPublicDomain(arts.filter(isUsableArtwork));
}

async function detail(id: string): Promise<ArticArtwork | null> {
  const url = `${API}/artworks/${encodeURIComponent(id)}?fields=${ARTIC_FIELDS},description,provenance_text`;
  const raw = await fetchJson(url, {
    headers: headers(),
    gate: articGate,
    timeoutMs: 6000,
  });
  if (!isCC0Response(raw)) {
    console.warn("[artic] detail response is not CC0-designated; refusing it");
    return null;
  }
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

// Public-domain + one art form + an optional period (Phase 24). Clause order
// deliberately mirrors scripts/probe-artic-forms.mjs exactly — including the
// `exists: image_id` gate — so the counts baked into artic.forms.ts describe
// precisely the set this draws from, and a slice we promised has N works really
// does. Form/era values come from our own registry, never from user input.
function pdForm(
  form: ArticForm,
  era: ArticEra | null,
  limit: number,
  page: number,
) {
  return {
    "query[bool][must][0][term][is_public_domain]": "true",
    "query[bool][must][1][exists][field]": "image_id",
    "query[bool][must][2][match_phrase][artwork_type_title]": form.aicType,
    ...(era
      ? {
          "query[bool][must][3][range][date_start][gte]": String(era.from),
          "query[bool][must][4][range][date_start][lte]": String(era.to),
        }
      : {}),
    fields: ARTIC_FIELDS,
    limit: String(limit),
    page: String(page),
  };
}

// How deep into a form+era slice we're willing to sample. Bigger than the
// themed buckets' SPREAD because these slices are much bigger (7,401 prints from
// 1850 to 1899): capping at 30 pages there would show you the same few hundred
// works forever. Bounded so a long session still wanders rather than paging
// linearly into the tail.
const FORM_SPREAD = 60;

async function formDiscover(
  form: ArticForm,
  era: ArticEra | null,
  offset: number,
  lim: number,
): Promise<Card[]> {
  // The baked count tells us how many pages exist without asking upstream first,
  // so a small slice (134 sculptures) never wastes a request on a page past the
  // end while a large one still gets sampled deeply.
  const works = worksInSlice(form.id, era?.id ?? "all");
  const maxPage = Math.max(1, Math.min(FORM_SPREAD, Math.ceil(works / lim)));
  const page = 1 + (offset % maxPage);
  const first = await searchMeta(pdForm(form, era, lim, page));
  let arts = first.arts;
  // Counts can age (AIC re-catalogues); if our page overshot the real set, retry
  // once within the true page count rather than returning an empty drift.
  if (arts.length === 0 && first.totalPages > 1) {
    const retry = 1 + (offset % Math.min(FORM_SPREAD, first.totalPages));
    if (retry !== page) {
      arts = (await searchMeta(pdForm(form, era, lim, retry))).arts;
    }
  }
  return (await usable(arts)).map(articToCard);
}

// ----- "drift an artist" (Phase 24, M-G3) -----

type Bucket = { key: string; doc_count: number };

/** A count-only search that also returns aggregations. AIC's search endpoint is
 *  an Elasticsearch passthrough, so `aggs[...]` works — but note it aggregates
 *  the structured `query` ONLY and ignores the free-text `q`, which is why
 *  artist resolution below counts hits by hand instead. */
async function searchAggs(
  params: Record<string, string>,
): Promise<{ total: number; aggs: Record<string, { buckets?: Bucket[] }> }> {
  const url = `${API}/artworks/search?${new URLSearchParams({ ...params, limit: "0" })}`;
  const raw = (await fetchJson(url, {
    headers: headers(),
    gate: articGate,
    timeoutMs: 6000,
  })) as {
    pagination?: { total?: number };
    aggregations?: Record<string, { buckets?: Bucket[] }>;
  };
  return { total: raw?.pagination?.total ?? 0, aggs: raw?.aggregations ?? {} };
}

// A `must` clause as (path, value) — e.g. ["term][artist_id", "40610"]. Built as
// a LIST and indexed sequentially by `mustParams` below, because these queries
// assemble a variable number of clauses (an artist may have a medium but no
// period). Hand-numbering them left gaps like must[0], must[1], must[3], which
// upstream parses into a sparse array.
type Must = [path: string, value: string];

const PD_MUST: Must[] = [
  ["term][is_public_domain", "true"],
  ["exists][field", "image_id"],
];

function mustParams(clauses: Must[]): Record<string, string> {
  const out: Record<string, string> = {};
  clauses.forEach(([path, value], i) => {
    out[`query[bool][must][${i}][${path}]`] = value;
  });
  return out;
}

/** Public-domain + has-image, the gate every artist query shares. */
function pdArtistBase(): Record<string, string> {
  return mustParams(PD_MUST);
}

const byArtist = (id: string) => mustParams([...PD_MUST, ["term][artist_id", id]]);

/** Everything by this artist EXCEPT their own work is what a widened ring wants. */
const notArtist = (id: string) => ({
  "query[bool][must_not][0][term][artist_id]": id,
});

// Profiles are pure derived data and change only when AIC re-catalogues, but
// every buffer refill on a widened ring needs one. A small in-process cache
// keeps a long artist session down to a single profile lookup. Best-effort: a
// cold serverless instance simply re-measures.
const profileCache = new Map<string, { at: number; profile: ArtistProfile | null }>();
const PROFILE_TTL_MS = 30 * 60 * 1000;

/**
 * Measure an artist from their own public-domain works: how many there are, the
 * movement that actually characterises them, and the period + medium most of
 * their work sits in. Rings 1 and 2 widen into these.
 *
 * The era comes from a RANGE aggregation over our own era ladder rather than
 * min/max on `date_start`, because single outliers wreck min/max: Hokusai's
 * minimum is the year 19, and Dürer's maximum is an 1864 later impression of a
 * 1500s plate. Bucketing by era gives Hokusai 1800-1849 and Dürer the 1500s,
 * which is what a reader would say.
 */
export async function articArtistProfile(
  artistId: string,
): Promise<ArtistProfile | null> {
  const hit = profileCache.get(artistId);
  if (hit && Date.now() - hit.at < PROFILE_TTL_MS) return hit.profile;

  const params: Record<string, string> = {
    ...byArtist(artistId),
    "aggs[style][terms][field]": "style_title.keyword",
    "aggs[style][terms][size]": "6",
    "aggs[form][terms][field]": "artwork_type_title.keyword",
    "aggs[form][terms][size]": "3",
    "aggs[era][range][field]": "date_start",
  };
  ARTIC_ERAS.forEach((era, i) => {
    params[`aggs[era][range][ranges][${i}][key]`] = era.id;
    params[`aggs[era][range][ranges][${i}][from]`] = String(era.from);
    params[`aggs[era][range][ranges][${i}][to]`] = String(era.to + 1); // `to` is exclusive
  });

  let profile: ArtistProfile | null = null;
  try {
    const { total, aggs } = await searchAggs(params);
    if (total > 0) {
      // One artwork gives us the artist's name as AIC spells it.
      const sample = await search({
        ...byArtist(artistId),
        fields: "id,artist_title",
        limit: "1",
      });
      const name = (sample[0]?.artist_title ?? "").trim();
      const top = (key: string) =>
        (aggs[key]?.buckets ?? []).filter((b) => b.doc_count > 0);
      const movement = top("style").find(
        (b) => isMovement(b.key) && movementHolds(b.doc_count, total),
      )?.key;
      const era = [...top("era")].sort((a, b) => b.doc_count - a.doc_count)[0]?.key;
      const form = top("form")[0]?.key;
      profile = {
        id: Number(artistId),
        name: name || "This artist",
        works: total,
        ...(movement ? { movement } : {}),
        ...(era ? { era } : {}),
        ...(form ? { form } : {}),
      };
    }
  } catch {
    return null; // transient upstream failure: don't poison the cache
  }
  profileCache.set(artistId, { at: Date.now(), profile });
  return profile;
}

/**
 * Resolve a typed name to artists we actually hold, with a true count each.
 *
 * Two steps because AIC's aggregations ignore the free-text `q`: sample the
 * relevance-ranked hits for the query, tally + name-gate them in `rankArtists`
 * (pure, tested), then count each survivor exactly. Returns [] when nothing
 * genuinely matches, which is the honest answer for an artist still in
 * copyright — see artic.artist.ts.
 */
export async function articArtistSearch(
  query: string,
): Promise<{ id: number; name: string; works: number; thumbnail?: string }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const hits = await search({
    q,
    ...pdArtistBase(),
    fields: "id,artist_id,artist_title,image_id",
    limit: "60",
  });
  const ranked: ArtistMatch[] = rankArtists(hits, q);
  if (ranked.length === 0) return [];

  // Drop artists still in copyright in the EU BEFORE offering them. Their works
  // would be filtered out of the feed anyway, so offering the name would promise
  // a drift that arrives empty, which is a worse answer than "no match". This is
  // also the one place the rule can be applied to an artist directly rather than
  // work by work.
  const cleared = artistsOutOfCopyright([
    ...(await fetchAgents(ranked.map((a) => a.id))).values(),
  ]);
  const eligible = ranked.filter((a) => cleared.has(a.id));
  if (eligible.length === 0) return [];

  return (
    await Promise.all(
      eligible.map(async (a) => {
        try {
          const { total } = await searchAggs(byArtist(String(a.id)));
          if (total === 0) return null;
          // Reuse a thumbnail already in hand rather than fetching again.
          const face = hits.find(
            (h) => h.artist_id === a.id && h.image_id,
          )?.image_id;
          return {
            id: a.id,
            name: a.name,
            works: total,
            ...(face ? { thumbnail: articImageUrl(face, 200) } : {}),
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter((a): a is NonNullable<typeof a> => !!a);
}

/**
 * One page of an artist drift at a given ring: their own work (0), their
 * movement (1), or their period and medium (2). Rings 1 and 2 exclude the artist
 * themselves, so widening always shows you something new rather than recycling
 * the oeuvre you just read.
 */
export async function articArtistDiscover(
  artistId: string,
  ring: ArtistRing,
  offset: number,
  limit: number,
): Promise<Card[]> {
  const lim = Math.min(Math.max(limit, 1), 20);
  const must: Must[] = [...PD_MUST];
  let exclude: Record<string, string> = {};

  if (ring === 0) {
    must.push(["term][artist_id", artistId]);
  } else {
    const profile = await articArtistProfile(artistId);
    if (!profile) return [];
    // A widened ring excludes the artist, so it always shows something NEW
    // rather than recycling the oeuvre you have just read.
    exclude = notArtist(artistId);
    if (ring === 1) {
      if (!profile.movement) return [];
      must.push(["match_phrase][style_title", profile.movement]);
    } else {
      const era = articEraById(profile.era);
      if (!profile.form && !era) return [];
      if (profile.form) must.push(["match_phrase][artwork_type_title", profile.form]);
      if (era) {
        must.push(["range][date_start][gte", String(era.from)]);
        must.push(["range][date_start][lte", String(era.to)]);
      }
    }
  }

  // Ring 0 is small and finite (Van Gogh is 18 works), so page through it in
  // order and let the caller widen when it runs out. The outer rings are large,
  // so sample them the way a form slice is sampled.
  const params = {
    ...mustParams(must),
    ...exclude,
    fields: ARTIC_FIELDS,
    limit: String(lim),
  };
  const page =
    ring === 0
      ? 1 + Math.floor(offset / lim)
      : 1 + (offset % FORM_SPREAD);
  const res = await searchMeta({ ...params, page: String(page) });
  let arts = res.arts;
  if (arts.length === 0 && ring > 0 && res.totalPages > 1) {
    const retry = 1 + (offset % Math.min(FORM_SPREAD, res.totalPages));
    if (retry !== page) arts = (await searchMeta({ ...params, page: String(retry) })).arts;
  }
  return (await usable(arts)).map(articToCard);
}

export async function articDiscover(
  bucketId: string,
  offset: number,
  limit: number,
): Promise<Card[]> {
  const lim = Math.min(Math.max(limit, 1), 20);
  // An artist drift (Phase 24 M-G3) rides the same seam, carrying its ring.
  const artist = parseArtistBucket(bucketId);
  if (artist) {
    return articArtistDiscover(artist.artistId, artist.ring, offset, lim);
  }
  // A "drift a form and a period" bucket (Phase 24) rides the same seam as the
  // themed buckets; it just resolves through a different registry.
  const slice = parseFormBucket(bucketId);
  if (slice) return formDiscover(slice.form, slice.era, offset, lim);

  const bucket = articBucketById(bucketId);
  if (!bucket) return [];
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
  return (await usable(arts)).map(articToCard);
}

export async function articRelated(id: string): Promise<RelatedCandidate[]> {
  const art = await detail(id);
  if (!art) return [];
  const out: RelatedCandidate[] = [];
  const usedIds = new Set<string>([String(art.id)]);
  // `eyebrow` = the facet character shown above the label ("MORE BY" / "THE
  // MOVEMENT" / …); `label` = the destination entity (artist / movement / …).
  // `usable` is async because it may need artist records to decide the EU term,
  // so the facets below await it. A thread chip is a promise of somewhere to go;
  // pointing one at work Drift may not show in Europe would be a dead end.
  const add = async (
    list: ArticArtwork[],
    label: string,
    facet: string,
    eyebrow: string,
  ) => {
    for (const a of await usable(list)) {
      if (usedIds.has(String(a.id))) continue;
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
      await add(byArtist, art.artist_title, `artist:${art.artist_id}`, "More by");
    } catch {
      /* facet best-effort */
    }
  }
  if (art.style_title) {
    try {
      await add(await search(pdText(art.style_title, 4)), art.style_title, `style:${art.style_title}`, "The movement");
    } catch {
      /* facet best-effort */
    }
  }
  const subject = (art.subject_titles ?? []).map((s) => s.trim()).filter(Boolean)[0];
  if (subject) {
    try {
      await add(await search(pdText(subject, 4)), subject, `subject:${subject}`, "The subject");
    } catch {
      /* facet best-effort */
    }
  }
  if (art.place_of_origin) {
    try {
      await add(await search(pdText(art.place_of_origin, 4)), art.place_of_origin, `place:${art.place_of_origin}`, "Also from");
    } catch {
      /* facet best-effort */
    }
  }
  return out;
}

export async function articSummary(id: string): Promise<Card | null> {
  const art = await detail(id);
  if (!art) return null;
  const [kept] = await usable([art]);
  return kept ? articToCard(kept) : null;
}

// ----- cross-realm doorway helpers (Phase 15) -----

/** The bridge fields for a Gallery→Encyclopedia doorway (artist / movement /
 *  place, to resolve onto Wikipedia). null if the artwork is missing. */
export async function articArtworkMeta(id: string): Promise<{
  artist_title?: string;
  style_title?: string;
  place_of_origin?: string;
} | null> {
  const art = await detail(id);
  if (!art) return null;
  return {
    artist_title: art.artist_title,
    style_title: art.style_title,
    place_of_origin: art.place_of_origin,
  };
}

/** The top usable public-domain artwork for a free-text term, plus the fields the
 *  reverse-doorway gate needs (title / subject tags / score). null if none. */
export async function articTopMatch(term: string): Promise<{
  card: Card;
  title?: string;
  term_titles?: string[];
  score?: number;
} | null> {
  const arts = await search(
    pdText(term, 5, { fields: `${ARTIC_FIELDS},term_titles` }),
  );
  const [art] = await usable(arts);
  if (!art) return null;
  return {
    card: articToCard(art),
    title: art.title,
    term_titles: art.term_titles,
    score: art._score,
  };
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
