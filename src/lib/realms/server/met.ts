// ---------------------------------------------------------------------------
// The Metropolitan Museum of Art adapter (Phase 31) — the Gallery's content
// source, replacing the Art Institute of Chicago after its image host went
// behind a blanket Cloudflare block.
//
// THREE THINGS ABOUT THIS API SHAPE THE CODE BELOW, and none of them were true
// of the Art Institute:
//
//  1. SEARCH RETURNS IDS, NOT RECORDS. One search gives back the WHOLE matching
//     id array (up to ~100k ids, ~700 KB) and there is no offset or limit. That
//     sounds worse and is actually better for us: `discover(offset)` wants a
//     stable candidate pool to window into, and now we have the entire pool in
//     one request. It does mean every batch is 1 search + N object fetches, so
//     both are cached hard.
//
//  2. THEIR EDGE ANSWERS A BURST WITH 403. Not 429, and with no `Retry-After`.
//     It clears on its own within minutes. A single realistic batch is fine
//     (measured: 20 concurrent object fetches in 0.70s), but sustained scripted
//     traffic trips it, so requests are spaced through a gate and 403 is opted
//     in to the retry set. A throttled batch must return FEWER cards, never
//     throw — the discover route turns an empty result into HTTP 200 + no-store
//     so nothing freezes at the edge.
//
//  3. THERE ARE NO AGGREGATIONS AND NO STYLE FIELD. The Art Institute's artist
//     profile, its movement threads and its relevance-scored doorway were all
//     built on Elasticsearch aggregations. Those are Phase B problems; this
//     module deliberately implements only the four `ServerRealm` methods.
// ---------------------------------------------------------------------------

import type { Card, ExtendedBody, RelatedCandidate } from "@/lib/types";
import { makeGate, fetchJson } from "@/lib/upstream";
import { metBucketById } from "../met.buckets";
import {
  foldName,
  rankArtists,
  parseArtistBucket,
  type MetArtistMatch,
  type MetArtistProfile,
  type MetArtistRing,
} from "../met.artist";
import { deathYearCleared, euPublicDomainCutoff, parseDeathYear } from "../publicdomain";
import { parseFormBucket, type MetForm, type MetEra } from "../met.forms";
import pools from "../met.pools.json";
import {
  isUsableArtwork,
  metPdInput,
  metToCard,
  metToCandidate,
  metArtistQid,
  artSubjects,
  type MetObject,
} from "../met";
import { wikidataEnwikiTitles } from "@/lib/wiki-server";
import { wikiExtended } from "./wikipedia";
import { artworkEuPublicDomain } from "../publicdomain";
import type { ForwardEntities } from "@/lib/crossrealm";

const API = "https://collectionapi.metmuseum.org/public/collection/v1";

const UA =
  process.env.MET_USER_AGENT ||
  "Drift/1.0 (https://www.usedrift.org; thomasvdhulst03@gmail.com)";

/**
 * Its own gate, separate from Wikimedia's 300 ms and the other realms'.
 *
 * 50 ms is 20 requests a second: comfortably under the 80/s the museum's docs
 * ask for, and at the pace that was measured to be accepted. The docs and the
 * edge disagree (a burst of ~80 got a 403 despite the stated 80/s), so this
 * follows the edge, not the documentation.
 */
const metGate = makeGate(50);

/** The museum's edge throttles with 403. See the header note. */
const RETRY_ON = [403];

function headers() {
  return { "User-Agent": UA };
}

async function metFetch(url: string, timeoutMs = 6000): Promise<unknown> {
  return fetchJson(url, {
    headers: headers(),
    gate: metGate,
    retryOn: RETRY_ON,
    timeoutMs,
  });
}

// ---------------------------------------------------------------------------
// Caches. Both are per-instance and deliberately simple: this is a hobby-scale
// app and the real caching happens at the edge (CACHE_STABLE on the routes).
// These exist to stop ONE serverless instance re-asking for things that cannot
// have changed, which is the traffic most likely to trip the 403.
// ---------------------------------------------------------------------------

/** A bucket's full candidate id list. A department's membership moves when the
 *  museum re-catalogues, which is not an hourly event. */
const bucketIds = new Map<string, { at: number; ids: number[] }>();
const IDS_TTL_MS = 60 * 60 * 1000;

/** Object records, which are effectively immutable. Capped so a long-lived
 *  instance cannot grow without bound; oldest-inserted is evicted first, which
 *  Map iteration order gives us for free. */
const objectCache = new Map<number, MetObject>();
const OBJECT_CACHE_MAX = 3000;

function rememberObject(id: number, obj: MetObject) {
  if (objectCache.size >= OBJECT_CACHE_MAX) {
    const oldest = objectCache.keys().next().value;
    if (oldest !== undefined) objectCache.delete(oldest);
  }
  objectCache.set(id, obj);
}

// ---------------------------------------------------------------------------
// Upstream calls
// ---------------------------------------------------------------------------

/**
 * One search. Returns the full id array, or [] on any failure.
 *
 * ⚠️ `q` IS FORCED LAST, and that is not cosmetic. The Met's search endpoint is
 * parameter-ORDER sensitive in a way nothing documents: put `q` before the other
 * filters and they are silently ignored. Measured on one identical query:
 *
 *   medium=Prints&dateBegin=1600&dateEnd=1800&q=*  ->  16,405 results
 *   medium=Prints&q=*&dateBegin=1600&dateEnd=1800  ->        1 result
 *   q=*&medium=Prints&dateBegin=1600&dateEnd=1800  ->        0 results
 *
 * It fails silently and plausibly, which is the worst way for it to fail: a
 * period slice just looks empty rather than broken. So the ordering is enforced
 * HERE, once, rather than trusted to every caller's object-literal key order.
 */
async function searchIds(params: Record<string, string>): Promise<number[]> {
  const { q, ...rest } = params;
  const qs = new URLSearchParams({
    hasImages: "true",
    ...rest,
    ...(q !== undefined ? { q } : {}),
  }).toString();
  try {
    // The largest department is ~700 KB of ids, so this gets a longer budget
    // than a record fetch.
    const raw = (await metFetch(`${API}/search?${qs}`, 12000)) as {
      objectIDs?: number[] | null;
    };
    return Array.isArray(raw?.objectIDs) ? raw.objectIDs : [];
  } catch (err) {
    console.warn("[met] search failed", err);
    return [];
  }
}

/**
 * Ids baked by `scripts/probe-met-pools.mjs`: works that were public domain WITH
 * an image at probe time.
 *
 * This is what keeps a room readable when The Met is throttling us, which it
 * does readily and answers with a 403 rather than a 429. Without it, a throttled
 * `poolFor` returns nothing and the room serves zero cards — correct
 * degradation, but a bad read. It also means a batch barely has to over-fetch,
 * because the ids are already filtered.
 *
 * The EU copyright test is deliberately NOT baked: it is recomputed per request
 * from the clock, because the cut-off widens every 1 January.
 */
const BAKED: Record<string, number[]> =
  (pools as { pools?: Record<string, number[]> }).pools ?? {};

/** A bucket's candidate pool, cached. */
async function poolFor(bucket: string): Promise<number[]> {
  const hit = bucketIds.get(bucket);
  if (hit && Date.now() - hit.at < IDS_TTL_MS) return hit.ids;

  const b = metBucketById(bucket);
  if (!b) return [];

  // Baked first. A live search is the fallback, not the default.
  const baked = BAKED[bucket];
  if (baked?.length) {
    bucketIds.set(bucket, { at: Date.now(), ids: baked });
    return baked;
  }
  // A department is an exact filter and always beats the keyword. `q` is still
  // sent because the endpoint requires one, and `*` matches everything within
  // whatever structured filter accompanies it.
  const ids = await searchIds(
    b.departmentId !== undefined
      ? { departmentId: String(b.departmentId), q: "*" }
      : { q: b.q },
  );
  // Never cache an empty pool: that is far more likely to be a throttled
  // request than a genuinely empty room, and caching it would freeze the room
  // shut for an hour.
  if (ids.length) bucketIds.set(bucket, { at: Date.now(), ids });
  return ids;
}

/** One object record. `null` for anything that did not come back — including a
 *  404, which search legitimately returns ids for. */
async function fetchObject(id: number): Promise<MetObject | null> {
  const hit = objectCache.get(id);
  if (hit) return hit;
  try {
    const raw = (await metFetch(`${API}/objects/${id}`)) as MetObject;
    if (!raw || typeof raw.objectID !== "number") return null;
    rememberObject(id, raw);
    return raw;
  } catch {
    // Deliberately quiet: a 404 here is normal and a throttle has already been
    // logged by the retry core. A batch that loses a few records still serves.
    return null;
  }
}

/** Fetch many records, dropping the ones that fail. Order is not preserved
 *  because the caller filters and truncates anyway. */
async function fetchObjects(ids: number[]): Promise<MetObject[]> {
  const settled = await Promise.all(ids.map((id) => fetchObject(id)));
  return settled.filter((o): o is MetObject => o !== null);
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * The single choke point every card seam goes through: public domain in the US
 * *and* in the EU, with an image and a title.
 *
 * The museum's `isPublicDomain` is a US determination and admits work still in
 * copyright here, which is why the EU life-plus-70 test runs on top of it
 * (compliance audit M-4). Unlike the Art Institute this costs no extra request:
 * the death years are already on the record.
 */
function usable(objs: MetObject[], now?: Date): MetObject[] {
  const out: MetObject[] = [];
  let refusedEu = 0;
  for (const o of objs) {
    if (!isUsableArtwork(o)) continue;
    if (!artworkEuPublicDomain(metPdInput(o), now).ok) {
      refusedEu++;
      continue;
    }
    out.push(o);
  }
  if (refusedEu) {
    console.info(`[met] EU public-domain filter dropped ${refusedEu} work(s)`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Windowing
// ---------------------------------------------------------------------------

/** A small deterministic PRNG (mulberry32) so a shuffle can be reproduced. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Shuffle a pool with a seed that is stable for one bucket for one day.
 *
 * WHY SHUFFLE AT ALL. The museum returns ids in roughly accession order, so an
 * unshuffled window would serve the same corner of a department to everybody and
 * would front-load its oldest accessions.
 *
 * WHY DAY-STABLE. The discover route caches a batch at the edge for a day. If
 * the order moved per request, every reader would get a cache miss and every
 * miss is upstream traffic — the exact traffic that trips the 403. A seed that
 * turns over at midnight gives variety across days while letting one day's
 * windows be shared.
 */
function dailyWindowOrder(bucket: string, ids: number[], today = new Date()): number[] {
  const day = today.toISOString().slice(0, 10);
  const rnd = mulberry32(hash(`${bucket}:${day}`));
  const out = ids.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Where in a pool a batch starts.
 *
 * ⚠️ `offset` IS A CARD INDEX, not a page number. `randomOffset` (lib/discover.ts)
 * returns a card index already aligned to the window size, and the feed's
 * sequential artist paging advances it by whole windows too. Multiplying it by
 * `limit` here — which this adapter did at first — squares the stride: a refill
 * meant to move 12 cards along moved 144, which for a small oeuvre wrapped
 * chaotically and re-served work the reader had just seen.
 *
 * Wraps rather than running off the end, so a reader who drifts deeper than the
 * pool is long loops through it again instead of hitting a wall.
 */
function windowStart(offset: number, poolSize: number): number {
  return poolSize > 0 ? offset % poolSize : 0;
}

/**
 * How many records to pull for a batch of `limit` cards.
 *
 * Every record is a separate upstream request (their search returns ids only),
 * so this multiplier IS most of what the Gallery costs The Met, and their edge
 * enforces roughly 80 requests per 30 seconds rather than the 80 per SECOND
 * their docs claim. Measured: a cold room was 25 requests and one card's threads
 * 14, so two "start a new drift" actions hit the ceiling.
 *
 * Two rates, because the two pools are not the same thing:
 *  - A BAKED pool is already filtered to works that were public domain with an
 *    image at probe time, so almost everything in it survives. Only the EU
 *    copyright test can still drop one, and that is recomputed per request
 *    because it widens every January.
 *  - A LIVE pool is raw `hasImages` results, of which roughly three quarters
 *    survive `isPublicDomain` + the EU term (measured across four departments).
 */
const OVERFETCH_BAKED = 1.2;
const OVERFETCH_LIVE = 1.6;

// ---------------------------------------------------------------------------
// Drifting an artist
// ---------------------------------------------------------------------------

/** How many of an artist's works to look at when ranking or profiling. Enough
 *  to be representative, small enough to be one polite burst. */
const ARTIST_SAMPLE = 24;

/** Profiles are stable and a widening feed asks for the same one repeatedly. */
const profileCache = new Map<string, { at: number; profile: MetArtistProfile | null }>();
const PROFILE_TTL_MS = 30 * 60 * 1000;

/** Works by exactly this artist, as the museum spells them. The Met's search
 *  matches artist OR culture and is fuzzy, so the name is re-checked on every
 *  record rather than trusted from the query. */
function byExactArtist(objs: MetObject[], name: string): MetObject[] {
  const want = foldName(name);
  return objs.filter((o) => foldName(o.artistDisplayName ?? "") === want);
}

async function artistSample(name: string, limit = ARTIST_SAMPLE): Promise<MetObject[]> {
  const ids = (await searchIds({ artistOrCulture: "true", q: name })).slice(0, limit);
  return usable(await fetchObjects(ids));
}

/**
 * Artists matching a search, ranked, with those still in copyright removed.
 *
 * The refusal is the interesting half. An artist still in term is not offered at
 * all, rather than offered and then resolving to an empty feed — verified live:
 * "picasso" matches 553 works at the museum and correctly yields NO suggestion,
 * because none of them are public domain.
 */
export async function metArtistSearch(query: string): Promise<
  { name: string; works: number }[]
> {
  const q = query.trim();
  if (q.length < 2) return [];
  const ids = (await searchIds({ artistOrCulture: "true", q })).slice(0, 40);
  if (!ids.length) return [];
  const objs = await fetchObjects(ids);

  // Rank over works we could actually SHOW: public domain here, with an image.
  const shown = usable(objs);
  const hits = shown.map((o) => ({
    name: (o.artistDisplayName ?? "").trim(),
    death: parseDeathYear((o.artistEndDate ?? "").split("|")[0]),
  }));
  const cutoff = euPublicDomainCutoff();
  return rankArtists(hits, q)
    .filter((m: MetArtistMatch) => deathYearCleared(m.death, cutoff))
    .map((m) => ({ name: m.name, works: m.hits }));
}

/**
 * What the feed needs in order to widen past an artist's own work: the
 * department most of it sits in, and the span of years it covers.
 *
 * The Art Institute answered this with one aggregation query. The Met has no
 * aggregations, so it is tallied from a sample of the artist's works instead —
 * which is why it is cached: a widening feed asks for the same profile on every
 * refill.
 */
export async function metArtistProfile(name: string): Promise<MetArtistProfile | null> {
  const key = foldName(name);
  const hit = profileCache.get(key);
  if (hit && Date.now() - hit.at < PROFILE_TTL_MS) return hit.profile;

  try {
    const mine = byExactArtist(await artistSample(name), name);
    if (!mine.length) {
      profileCache.set(key, { at: Date.now(), profile: null });
      return null;
    }
    const depts = new Map<string, number>();
    let from = Infinity;
    let to = -Infinity;
    for (const o of mine) {
      const d = (o.department ?? "").trim();
      if (d) depts.set(d, (depts.get(d) ?? 0) + 1);
      const b = o.objectBeginDate;
      const e = o.objectEndDate ?? o.objectBeginDate;
      if (typeof b === "number") from = Math.min(from, b);
      if (typeof e === "number") to = Math.max(to, e);
    }
    const department = [...depts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const profile: MetArtistProfile = {
      name: (mine[0].artistDisplayName ?? name).trim(),
      works: mine.length,
      ...(department ? { department } : {}),
      ...(Number.isFinite(from) ? { from } : {}),
      ...(Number.isFinite(to) ? { to } : {}),
    };
    profileCache.set(key, { at: Date.now(), profile });
    return profile;
  } catch {
    // A transient failure must not be cached as "this artist cannot widen".
    return null;
  }
}

/** Department name → the museum's numeric id, for the ring-1 query. Built from
 *  the buckets we already know, plus the departments they do not cover. */
const DEPARTMENT_IDS: Record<string, number> = {
  "American Decorative Arts": 1,
  "Ancient West Asian Art": 3,
  "Arms and Armor": 4,
  "Arts of Africa, Oceania, and the Americas": 5,
  "Asian Art": 6,
  "The Cloisters": 7,
  "The Costume Institute": 8,
  "Drawings and Prints": 9,
  "Egyptian Art": 10,
  "European Paintings": 11,
  "European Sculpture and Decorative Arts": 12,
  "Greek and Roman Art": 13,
  "Islamic Art": 14,
  "The Robert Lehman Collection": 15,
  "The Libraries": 16,
  "Medieval Art": 17,
  "Musical Instruments": 18,
  "Photographs": 19,
  "Modern Art": 21,
};

/**
 * A batch for an artist drift.
 *
 * Ring 0 is the artist's own work and is paged SEQUENTIALLY: an oeuvre is finite
 * and ordered, and sampling it randomly would show you the same famous three
 * prints over and over. Ring 1 is their department and period with the artist
 * removed, which is a large pool, so it samples.
 */
async function metArtistDiscover(
  name: string,
  ring: MetArtistRing,
  offset: number,
  limit: number,
): Promise<Card[]> {
  if (ring === 0) {
    const ids = await searchIds({ artistOrCulture: "true", q: name });
    if (!ids.length) return [];
    const start = windowStart(offset, ids.length);
    const slice = ids.slice(start, start + Math.ceil(limit * OVERFETCH_LIVE));
    const mine = byExactArtist(usable(await fetchObjects(slice)), name);
    const cards = mine.slice(0, limit);
    await resolveArtistArticles(cards);
    return cards.map(toCardWithBody);
  }

  const profile = await metArtistProfile(name);
  const deptId = profile?.department ? DEPARTMENT_IDS[profile.department] : undefined;
  if (!profile || deptId === undefined) return [];
  const params: Record<string, string> = { departmentId: String(deptId), q: "*" };
  if (profile.from !== undefined && profile.to !== undefined) {
    params.dateBegin = String(profile.from);
    params.dateEnd = String(profile.to);
  }
  const ids = await searchIds(params);
  if (!ids.length) return [];
  const ordered = dailyWindowOrder(`artist:${foldName(name)}:1`, ids);
  const start = windowStart(offset, ordered.length);
  const slice: number[] = [];
  const take = Math.ceil(limit * OVERFETCH_LIVE);
  for (let i = 0; i < take && i < ordered.length; i++) {
    slice.push(ordered[(start + i) % ordered.length]);
  }
  // Ring 1 is "around" the artist, so their OWN work is excluded — otherwise
  // widening would keep serving what ring 0 already showed.
  const want = foldName(name);
  const others = usable(await fetchObjects(slice)).filter(
    (o) => foldName(o.artistDisplayName ?? "") !== want,
  );
  const cards = others.slice(0, limit);
  await resolveArtistArticles(cards);
  return cards.map(toCardWithBody);
}

// ---------------------------------------------------------------------------
// "Read more" on an art card
// ---------------------------------------------------------------------------

/**
 * The Met publishes no prose whatsoever — no description, blurb or wall text on
 * any of its 57 record fields. So a Gallery card's "Read more" had nothing to
 * open, while still offering the control, which is the kind of small dishonesty
 * §2 exists to prevent.
 *
 * Where the museum names the artist by Wikidata id we can offer that artist's
 * Wikipedia lead instead. That is a DIFFERENT work under a DIFFERENT licence from
 * the CC0 artwork, so the card carries it as such: its own heading, its own
 * credit, its own licence line. Measured coverage is about a third of usable
 * works; the rest correctly show no button at all.
 *
 * Resolved for a whole batch in ONE Wikidata call, and cached, because a per-card
 * lookup is exactly the traffic that gets an app throttled.
 */
const artistArticle = new Map<string, string | null>();

async function resolveArtistArticles(objs: MetObject[]): Promise<void> {
  const wanted = new Set<string>();
  for (const o of objs) {
    const q = metArtistQid(o);
    if (q && !artistArticle.has(q)) wanted.add(q);
  }
  if (!wanted.size) return;
  const found = await wikidataEnwikiTitles([...wanted]);
  // Remember the misses too. An artist with no English article will not grow one
  // between two cards, and re-asking for every batch is wasted traffic.
  for (const q of wanted) artistArticle.set(q, found.get(q) ?? null);
}

/** The card, plus whether it has a body and where that body comes from. */
function toCardWithBody(o: MetObject): Card {
  const card = metToCard(o);
  const q = metArtistQid(o);
  const title = q ? artistArticle.get(q) : null;
  const artist = (o.artistDisplayName ?? "").trim();
  if (title && artist) {
    return {
      ...card,
      hasBody: true,
      bodyFrom: { source: "wikipedia", title, label: "About the artist" },
    };
  }
  return { ...card, hasBody: false };
}

// ---------------------------------------------------------------------------
// The ServerRealm surface
// ---------------------------------------------------------------------------

/**
 * A batch from a form-and-period slice.
 *
 * `medium` and `dateBegin`/`dateEnd` are structured filters, so the slice is
 * exact rather than a keyword approximation. Note `searchIds` puts `q` last for
 * us: with `q` before the date parameters The Met silently ignores them and the
 * slice quietly becomes the whole medium.
 */
async function metFormDiscover(
  form: MetForm,
  era: MetEra | null,
  bucket: string,
  offset: number,
  limit: number,
): Promise<Card[]> {
  const params: Record<string, string> = { medium: form.medium, q: "*" };
  if (era) {
    params.dateBegin = String(era.from);
    params.dateEnd = String(era.to);
  }
  const ids = await searchIds(params);
  if (!ids.length) return [];
  const ordered = dailyWindowOrder(bucket, ids);
  const start = windowStart(offset, ordered.length);
  const slice: number[] = [];
  const take = Math.ceil(limit * OVERFETCH_LIVE);
  for (let i = 0; i < take && i < ordered.length; i++) {
    slice.push(ordered[(start + i) % ordered.length]);
  }
  const cards = usable(await fetchObjects(slice)).slice(0, limit);
  await resolveArtistArticles(cards);
  return cards.map(toCardWithBody);
}

export async function metDiscover(
  bucket: string,
  offset: number,
  limit: number,
): Promise<Card[]> {
  const lim = Math.max(1, Math.min(20, limit));

  // Three bucket shapes: an artist drift, a form-and-period slice, or a room.
  const artist = parseArtistBucket(bucket);
  if (artist) return metArtistDiscover(artist.name, artist.ring, offset, lim);

  const formSlice = parseFormBucket(bucket);
  if (formSlice) {
    return metFormDiscover(formSlice.form, formSlice.era, bucket, offset, lim);
  }

  const pool = await poolFor(bucket);
  if (!pool.length) return [];

  const ordered = dailyWindowOrder(bucket, pool);
  // Wrap rather than run off the end: a reader who drifts deeper than the pool
  // is long should loop through it again, not hit a wall.
  const start = windowStart(offset, ordered.length);
  const take = Math.ceil(
    lim * (BAKED[bucket]?.length ? OVERFETCH_BAKED : OVERFETCH_LIVE),
  );
  const slice: number[] = [];
  for (let i = 0; i < take && i < ordered.length; i++) {
    slice.push(ordered[(start + i) % ordered.length]);
  }

  const objs = await fetchObjects(slice);
  const cards = usable(objs).slice(0, lim);
  await resolveArtistArticles(cards);
  return cards.map(toCardWithBody);
}

/**
 * The faceted threads.
 *
 * Four independent directions, each in its own try/catch so one dead facet never
 * costs the others. Order sets the default trio the client shows; it picks one
 * candidate per distinct `facet` (see lib/diversity.ts).
 *
 * The Art Institute's second slot was "The movement", built on its `style_title`
 * field. The Met has no style or movement field at all, so that slot is the
 * subject instead. Inventing a movement label from tags was considered and
 * rejected: tags are subjects ("Cypresses", "Landscapes"), and a chip that says
 * "THE MOVEMENT" over a subject is a small lie to the reader.
 */
export async function metRelated(id: string): Promise<RelatedCandidate[]> {
  const self = await fetchObject(Number(id));
  if (!self) return [];

  const out: RelatedCandidate[] = [];
  const usedIds = new Set<number>([self.objectID]);
  // How many distinct facets the card can actually show. `selectFacetThreads`
  // takes ONE candidate per facet and caps at three, so a fourth facet is only
  // ever needed when an earlier one comes back empty.
  const FACETS_SHOWN = 3;
  // Two candidates per facet, not three: the first is the chip, the second is
  // the spare for when the reader has already seen the first. A third is never
  // reachable, and every one of these is a separate upstream request.
  const PER_FACET = 2;
  // Ids to fetch per facet in order to land those two. The filter drops about a
  // quarter, so three is enough far more often than not, and a facet that comes
  // up short simply contributes fewer chips.
  const FETCH_PER_FACET = 3;

  const facetsFound = () => new Set(out.map((c) => c.facet)).size;

  const add = async (
    params: Record<string, string>,
    label: string,
    facet: string,
    eyebrow: string,
  ) => {
    // Stop once the card has all the directions it can display. This is what
    // makes the common case cost three searches instead of four.
    if (facetsFound() >= FACETS_SHOWN) return;
    try {
      const ids = (await searchIds(params))
        .filter((n) => !usedIds.has(n))
        .slice(0, FETCH_PER_FACET);
      if (!ids.length) return;
      for (const a of usable(await fetchObjects(ids)).slice(0, PER_FACET)) {
        if (usedIds.has(a.objectID)) continue;
        usedIds.add(a.objectID);
        out.push(metToCandidate(a, label, facet, eyebrow));
      }
    } catch (err) {
      console.warn(`[met] facet ${facet} failed`, err);
    }
  };

  const artist = (self.artistDisplayName ?? "").trim();
  if (artist) {
    await add(
      { artistOrCulture: "true", q: artist },
      artist,
      `artist:${artist}`,
      "More by",
    );
  }

  const subject = artSubjects(self)[0];
  if (subject) {
    await add({ tags: "true", q: subject }, subject, `subject:${subject}`, "The subject");
  }

  const place = (self.culture ?? "").trim() || (self.country ?? "").trim();
  if (place) {
    await add({ geoLocation: place, q: "*" }, place, `place:${place}`, "Also from");
  }

  const department = (self.department ?? "").trim();
  if (department) {
    // Search by the department NAME rather than its id: the id is not on the
    // object record, and the museum's own name for the room is what the chip
    // should read anyway.
    await add(
      { q: department },
      department,
      `dept:${department}`,
      "The room",
    );
  }

  return out;
}

export async function metSummary(id: string): Promise<Card | null> {
  const obj = await fetchObject(Number(id));
  if (!obj) return null;
  const [ok] = usable([obj]);
  if (!ok) return null;
  await resolveArtistArticles([ok]);
  return toCardWithBody(ok);
}

/**
 * The "Read more" body: the artist's Wikipedia lead, where one exists.
 *
 * The artwork itself has no prose to expand into (see `resolveArtistArticles`).
 * Returning `null` where there is no article is the honest answer, and the card
 * does not offer the control in the first place because `hasBody` said so.
 */
export async function metExtended(id: string): Promise<ExtendedBody | null> {
  const obj = await fetchObject(Number(id));
  if (!obj) return null;
  const q = metArtistQid(obj);
  if (!q) return null;
  await resolveArtistArticles([obj]);
  const title = artistArticle.get(q);
  if (!title) return null;
  // Straight through the Encyclopedia's own body fetcher, so the biography is
  // parsed, sectioned and truncated exactly like any other Wikipedia read.
  return wikiExtended(title);
}

/**
 * The entities a Gallery card can open an Encyclopedia doorway onto.
 *
 * This is the HALF of the cross-realm doorway that survives the move. Going
 * Gallery → Encyclopedia only needs names to resolve against Wikipedia, and the
 * Met records all three. Going the other way needed a relevance score the Met
 * does not return, so that direction is off until Phase B rather than shipping a
 * gate that would let weak matches through.
 *
 * `period` stands in for the Art Institute's `style_title`: it is the nearest
 * thing the Met records, and unlike a movement invented from subject tags it is
 * something a cataloguer actually wrote down.
 */
export async function metArtworkMeta(id: string): Promise<ForwardEntities | null> {
  const obj = await fetchObject(Number(id));
  if (!obj) return null;
  const [ok] = usable([obj]);
  if (!ok) return null;
  return {
    artist: ok.artistDisplayName ?? null,
    movement: ok.period ?? null,
    place: (ok.culture ?? "").trim() || (ok.country ?? "") || null,
  };
}

/**
 * The best Gallery match for an Encyclopedia article title, for the reverse
 * doorway. Returns the top USABLE work plus what the gate needs to judge it.
 *
 * The Art Institute returned a relevance `_score` and the gate leaned on it; The
 * Met returns none, so `passesReverseGate` now rests entirely on "does the
 * article's term actually appear in this work's title or subject tags". Verified
 * against the live API on the original cases before it shipped.
 *
 * Only the first few results are examined: a match that is not near the top is
 * not a doorway, it is a coincidence.
 */
export async function metTopMatch(term: string): Promise<
  { card: Card; title: string; term_titles: string[] } | null
> {
  const q = term.trim();
  if (!q) return null;
  const ids = (await searchIds({ q })).slice(0, 5);
  if (!ids.length) return null;
  const [best] = usable(await fetchObjects(ids));
  if (!best) return null;
  await resolveArtistArticles([best]);
  return {
    card: toCardWithBody(best),
    title: (best.title ?? "").trim(),
    term_titles: artSubjects(best),
  };
}

/** Bucket ids the discover route will accept. The injection guard: the client
 *  sends an id, we map it to a query, and an unknown id never reaches upstream. */
export function metValidateBucket(bucket: string): boolean {
  return (
    !!metBucketById(bucket) ||
    !!parseArtistBucket(bucket) ||
    !!parseFormBucket(bucket)
  );
}
