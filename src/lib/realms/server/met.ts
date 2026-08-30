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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import type { Card, ExtendedBody, RelatedCandidate } from "@/lib/types";
import {
  makeGate,
  makeBreaker,
  isCircuitOpen,
  isBudgetExhausted,
  upstreamStatus,
  fetchJson,
} from "@/lib/upstream";
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
import {
  doorwayCandidates,
  lineStarts,
  normalizeForIndex,
  type DoorwayIndex,
} from "../doorwayindex";
import { dailyWindowOrder, windowStart } from "../dailyorder";
import {
  facetCandidates,
  rankBakedArtists,
  bakedArtist,
  profileFromBaked,
  type FacetIndex,
  type FacetKind,
  type BakedArtist,
} from "../metfacets";
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

/**
 * How many records a doorway may fetch before giving up.
 *
 * The blob is baked in quality order with title matches ranked first, so the
 * first candidate is almost always the answer. The spares cover a record the
 * museum has withdrawn since the index was built, or one that fails `usable()`.
 * Three, not five: the old search-based path needed five because relevance
 * ranking put weak matches near the top, and the index does not.
 */
const DOORWAY_FETCH_MAX = 3;

const UA =
  process.env.MET_USER_AGENT ||
  "Drift/1.0 (https://www.usedrift.org; thomasvdhulst03@gmail.com)";

/**
 * Its own gate, separate from Wikimedia's 300 ms and the other realms'.
 *
 * TWO RATES, because the museum's edge has two and spacing alone could not
 * express the second one. 50 ms (20 req/s) is the pace a burst is allowed to
 * run at, so opening a room still feels instant. The rolling window is the
 * budget that burst is drawn from.
 *
 * ⚠️ THE DOCS SAY 80 PER SECOND AND THE EDGE MEANS 80 PER THIRTY (CLAUDE.md §4:
 * 403 after 83 requests at 20/s, clear again after ~31s of quiet). With spacing
 * only, one reader opening the Gallery spent about 30 requests in two seconds
 * and a second drift straight after was refused — and a refusal is strictly
 * worse than a wait, because it costs a request, returns nothing, feeds the
 * breaker, and repeated tripping shrinks their budget for a DAY.
 *
 * 30 per 15 seconds is the same ~2/s their bucket refills at, in a window half
 * as long — so a reader who does run into the budget waits seconds rather than
 * half a minute, and a burst can never approach the 80 that trips them.
 *
 * 30 rather than 20 because that is the shape of opening the Gallery: a session
 * start is 15 requests and the first card's threads are another 12, and those
 * arrive together. Measured at 20, that opening spilled over the window and put
 * a visible ten-second gap before the second card.
 *
 * `maxWaitMs` is what keeps waiting honest: the feed aborts a discover batch
 * after 6 seconds, so holding one for longer would spend the museum's budget on
 * a batch nobody is still listening for.
 */
const metGate = makeGate(50, {
  burst: 30,
  windowMs: 15_000,
  maxWaitMs: 5_000,
  // A floor under the cards, and SIZED BY MEASUREMENT rather than by what a
  // full room costs. At 10 a single reader lost the thread chips on three cards
  // out of four in a quiet window: a 12-record seed plus one card's threads is
  // already 21, so a reserve of 10 cut the optional work off almost at once.
  // Six leaves optional work 24 of the 30 and still guarantees a room can land
  // — a partial one, which is exactly what this phase decided is acceptable.
  reserve: 6,
});

/** The museum's edge throttles with 403. See the header note. */
const RETRY_ON = [403];

function headers() {
  return { "User-Agent": UA };
}

/**
 * Stop asking when the museum is refusing.
 *
 * `retryOn: [403]` turns every refusal into three requests, which is the right
 * trade for a one-off blip and catastrophic for a sustained one — it feeds the
 * thing that is starving us. Measured in a 25-reader rehearsal: 1,470 refusals
 * against ~3,181 requests, and the budget stayed shrunk for the rest of the day,
 * exactly as the note in CLAUDE.md §4 warns.
 *
 * Five consecutive refusals, then 35 seconds of silence — the museum was
 * measured to recover after about 31 seconds of quiet.
 *
 * WHAT AN OPEN CIRCUIT ACTUALLY COSTS THE READER, stated plainly because it is
 * easy to assume the baked pools cover it and they do not. `met.pools.json`
 * supplies a room's candidate IDS without a search, but `metDiscover` still has
 * to fetch each RECORD, and those go through this breaker — so while it is open
 * a cold instance serves a Gallery room zero cards (HTTP 200, empty, no-store),
 * and the feed does what it already does with an empty batch: falls back to a
 * thread neighbour rather than dead-ending. A warm instance does better, because
 * `objectCache` answers for anything already seen.
 *
 * That is worse for 35 seconds and much better afterwards, which is the trade:
 * today those same 35 seconds are spent retrying into a budget that CLAUDE.md §4
 * records as shrinking for a DAY once repeatedly tripped.
 */
const metBreaker = makeBreaker({ threshold: 5, cooldownMs: 35_000 });

/**
 * ONE retry on a 403, not the default two.
 *
 * Every retry of a refusal is another request made at the exact moment the
 * museum is telling us to stop, and the backoff (300 ms) is nowhere near the
 * ~31 seconds their bucket needs to refill — so a second retry has almost no
 * chance of succeeding and costs a third of everything we spend while throttled.
 * One attempt at recovery covers the genuine one-off blip; the breaker covers
 * the sustained case.
 */
const METRETRIES = 1;

/**
 * HOW LONG EACH KIND OF CALLER MAY HOLD THE WINDOW.
 *
 * One reader opening the Gallery already spends most of a burst: a seed is 15
 * record fetches (SEED_LIMIT 12 × the baked overfetch) and the first card's
 * threads are another four or so, against a budget of 30 per 15 seconds. So the
 * budget IS contended in normal use, and something has to lose.
 *
 * The order falls straight out of what the reader sees. A card with no thread
 * chips still reads; a room with no cards is broken and the feed has nothing to
 * fall back to. So CARDS wait and EVERYTHING OPTIONAL yields:
 *
 *  - discover and summary keep the gate's own 5s, sized to the feed's 6s abort;
 *  - threads and the doorway give up at 1.2s and leave the window behind them.
 *
 * Yielding is real, not cosmetic: a gate refusal takes no slot (pinned by
 * "charges nothing for a refusal" in upstream.test.ts), so the budget a thread
 * declines to wait for is still there for the next discover.
 */
const WAIT_OPTIONAL_MS = 1200;

async function metFetch(
  url: string,
  timeoutMs = 6000,
  optional = false,
): Promise<unknown> {
  return fetchJson(url, {
    headers: headers(),
    gate: metGate,
    retryOn: RETRY_ON,
    retries: METRETRIES,
    breaker: metBreaker,
    timeoutMs,
    // The two halves of the same decision: optional work gives up sooner AND
    // keeps its hands off the reserve.
    ...(optional ? { maxWaitMs: WAIT_OPTIONAL_MS, optional: true } : {}),
  });
}

// ---------------------------------------------------------------------------
// The baked doorway index (Phase 34).
//
// Loaded once per process, lazily: a cold instance that never serves a doorway
// never pays for it, and the cost is a gunzip plus one scan of a ~12 MB string.
// Read with `fs` rather than imported, because a 12 MB JSON module would be
// parsed by the bundler and inflated into the JS heap; this is a flat string and
// two typed arrays. `next.config.ts` traces the files into the function bundle.
//
// If the files are missing or unreadable the doorway simply goes quiet. That is
// the same graceful-degradation contract every optional dependency here has
// (CLAUDE.md §4): no doorway chip is a normal state on about half of all cards,
// and the reader cannot tell the difference.
// ---------------------------------------------------------------------------

let indexLoaded = false;
let indexData: DoorwayIndex | null = null;

/** The two Phase 35 tables, loaded the same way and for the same reason.
 *
 *  ⚠️ THEIR DEGRADATION IS DIFFERENT FROM THE DOORWAY'S, deliberately. A card
 *  with no doorway chip is a normal state on about half of all cards, so a
 *  missing index simply means no chip. A card with no THREADS is a dead end, so
 *  a missing facet file falls back to the live search that used to do the job
 *  rather than serving a card nobody can leave. */
let facetsLoaded = false;
let facetsData: FacetIndex | null = null;
let artistsData: BakedArtist[] | null = null;

function gunzipJson<T>(file: string): T {
  const dir = join(process.cwd(), "src/lib/realms");
  return JSON.parse(gunzipSync(readFileSync(join(dir, file))).toString("utf8")) as T;
}

function facetIndex(): FacetIndex | null {
  loadFacets();
  return facetsData;
}

function artistTable(): BakedArtist[] | null {
  loadFacets();
  return artistsData;
}

function loadFacets(): void {
  if (facetsLoaded) return;
  facetsLoaded = true;
  try {
    facetsData = gunzipJson<FacetIndex>("met.facets.json.gz");
    artistsData = gunzipJson<BakedArtist[]>("met.artists.json.gz");
    console.info(
      `[met] facet index: ${Object.keys(facetsData.artist).length.toLocaleString()} artists, ` +
        `${Object.keys(facetsData.tag).length.toLocaleString()} subjects`,
    );
  } catch (err) {
    console.warn("[met] facet index unavailable; falling back to live search", err);
    facetsData = null;
    artistsData = null;
  }
}

function doorwayIndex(): DoorwayIndex | null {
  if (indexLoaded) return indexData;
  indexLoaded = true;
  try {
    const dir = join(process.cwd(), "src/lib/realms");
    const blob = gunzipSync(readFileSync(join(dir, "met.doorway.txt.gz"))).toString(
      "utf8",
    );
    const raw = gunzipSync(readFileSync(join(dir, "met.doorway.ids.gz")));
    // A Buffer's bytes may sit at an offset inside a larger pool, so copy rather
    // than view: `new Int32Array(raw.buffer)` would silently read the wrong data.
    const ids = new Int32Array(
      raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    );
    const starts = lineStarts(blob);
    if (starts.length * 2 !== ids.length) {
      throw new Error(
        `doorway index is inconsistent: ${starts.length} lines, ${ids.length / 2} ids`,
      );
    }
    indexData = { blob, starts, ids };
    console.info(`[met] doorway index: ${starts.length.toLocaleString()} works`);
  } catch (err) {
    console.warn("[met] doorway index unavailable; the doorway will stay quiet", err);
    indexData = null;
  }
  return indexData;
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

/**
 * Search results, which had no cache at all until the load rehearsal.
 *
 * Keyed on the finished query string, so it cannot disagree with what was
 * actually sent. Same hour as `bucketIds` and for the same reason: what a search
 * matches moves when the museum re-catalogues, which is not an hourly event.
 */
const searchCache = new Map<string, { at: number; ids: number[] }>();
const SEARCH_CACHE_MAX = 500;

/**
 * IN-FLIGHT work, which is a different thing from cached work and was the actual
 * multi-reader bug.
 *
 * A cache only helps the SECOND reader. Twenty-five people reading at once ask
 * for the same popular object and the same department search within the same few
 * milliseconds, before any of it has resolved — so every one of them made its own
 * request. These maps collapse that to one, and are cleared the moment it
 * settles, so nothing is remembered here that the caches above are not already
 * responsible for.
 */
const inFlightSearch = new Map<string, Promise<number[]>>();
const inFlightObject = new Map<number, Promise<MetObject | null>>();

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
async function searchIds(
  params: Record<string, string>,
  opts: { rethrow?: boolean; optional?: boolean } = {},
): Promise<number[]> {
  const { q, ...rest } = params;
  const qs = new URLSearchParams({
    hasImages: "true",
    ...rest,
    ...(q !== undefined ? { q } : {}),
  }).toString();

  const hit = searchCache.get(qs);
  if (hit && Date.now() - hit.at < IDS_TTL_MS) return hit.ids;

  // The shared promise carries the RAW outcome, failure included. Deciding what
  // a failure means has to happen per caller, below: callers do not agree about
  // that (see `rethrow`), and whoever happened to arrive first must not get to
  // impose their answer on everyone waiting behind them.
  let run = inFlightSearch.get(qs);
  if (!run) {
    run = (async () => {
      // The largest department is ~700 KB of ids, so this gets a longer budget
      // than a record fetch.
      // The first caller's ceiling is the one the shared promise runs under,
      // exactly as `rethrow` already works: whoever arrives first sets the
      // terms for everyone waiting behind them.
      const raw = (await metFetch(`${API}/search?${qs}`, 12000, opts.optional)) as {
        objectIDs?: number[] | null;
      };
      const ids = Array.isArray(raw?.objectIDs) ? raw.objectIDs : [];
      // Never cache an empty result. The same rule `poolFor` states: an empty
      // answer is far more likely a throttle than an empty room, and holding it
      // for an hour would freeze that room shut.
      if (ids.length) {
        if (searchCache.size >= SEARCH_CACHE_MAX) {
          const oldest = searchCache.keys().next().value;
          if (oldest !== undefined) searchCache.delete(oldest);
        }
        searchCache.set(qs, { at: Date.now(), ids });
      }
      return ids;
    })();
    inFlightSearch.set(qs, run);
    // Clear on settle. The extra `.catch` is what stops a rejection here from
    // being an unhandled one when every real caller has already handled it.
    void run.catch(() => {}).finally(() => inFlightSearch.delete(qs));
  }

  try {
    return await run;
  } catch (err) {
    // ⚠️ THE DOORWAY NEEDS TO KNOW THE DIFFERENCE between "we searched and there
    // is nothing" and "we could not search". Swallowing this made those two
    // identical, so a throttled lookup was cached as a settled "no doorway" —
    // and now that the route holds that answer for a DAY, the distinction is
    // load-bearing. `crossRealmDoorway`'s header always claimed an upstream
    // failure throws; this is what makes that true.
    // Every other caller wants the forgiving behaviour and keeps it.
    if (opts.rethrow) throw err;
    // An open circuit is not a failure, it is the breaker doing its job — but
    // logging it as `[met] search failed` with a full stack trace made a healthy
    // degradation look exactly like a crash, which is precisely how it was first
    // reported. Say what actually happened, once, without the trace.
    if (isCircuitOpen(err)) console.warn("[met] search skipped: circuit open");
    else if (isBudgetExhausted(err)) console.warn("[met] search skipped: rate budget");
    else console.warn("[met] search failed", err);
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
 *  404, which search legitimately returns ids for.
 *
 *  `rethrow` is the same distinction `searchIds` makes, and for the same reason:
 *  a caller whose answer gets cached for a DAY has to be able to tell "the museum
 *  says there is no such record" (a settled 404) from "we could not ask" (a
 *  throttle, a breaker refusal, a timeout). Everyone else keeps the forgiving
 *  `null`, because a discover batch that loses a record still serves. */
async function fetchObject(
  id: number,
  opts: { rethrow?: boolean; optional?: boolean } = {},
): Promise<MetObject | null> {
  const hit = objectCache.get(id);
  if (hit) return hit;

  // Concurrent readers land on the same popular object within milliseconds of
  // each other, before any request has resolved — so the cache above cannot help
  // them and every one of them used to make its own call. Share the one request.
  // The shared promise carries the RAW outcome, failure included, so whoever
  // arrives first cannot impose their reading of a failure on everyone behind.
  let run = inFlightObject.get(id);
  if (!run) {
    run = (async () => {
      const raw = (await metFetch(
        `${API}/objects/${id}`,
        6000,
        opts.optional,
      )) as MetObject;
      if (!raw || typeof raw.objectID !== "number") return null;
      rememberObject(id, raw);
      return raw;
    })();
    inFlightObject.set(id, run);
    // The extra `.catch` is what stops a rejection here from being an unhandled
    // one when every real caller has already handled it.
    void run.catch(() => {}).finally(() => inFlightObject.delete(id));
  }

  try {
    return await run;
  } catch (err) {
    // A 404 is a settled answer even for a rethrowing caller: the museum's own
    // search hands us ids it then does not hold a record for.
    if (opts.rethrow && upstreamStatus(err) !== 404) throw err;
    // Deliberately quiet otherwise: a 404 here is normal and a throttle has
    // already been logged by the retry core.
    return null;
  }
}

/**
 * Why a batch came up short. `refused` counts the records we could not even ASK
 * for — our own gate's budget, or an open circuit — as opposed to records the
 * museum answered about (a 404 is a real answer and is not counted here).
 *
 * ⚠️ THE DISTINCTION IS THE WHOLE POINT. `refused > 0` means the batch is short
 * because of us, and asking for the remaining ids in this window can only
 * produce more refusals — which is what lets `metDiscover` stop early instead of
 * firing fifteen requests that are all going to throw.
 */
interface BatchOutcome {
  objs: MetObject[];
  refused: number;
  /** What did the refusing: our rate budget, or the breaker. For the log line. */
  reason: "rate budget" | "circuit open" | null;
}

/**
 * Fetch many records, dropping the ones that fail, and SAY WHY when some do.
 *
 * ⚠️ THIS EXISTS BECAUSE THE REFUSAL WE ACTUALLY HIT WAS INVISIBLE. `fetchObject`
 * returns `null` for everything and its comment reasoned that "a throttle has
 * already been logged by the retry core" — true for a 403, and FALSE for a
 * `GateBudgetError` or a `CircuitOpenError`, because both are thrown before
 * `fetchUpstream` ever logs a line. So the one class of refusal that fires in
 * normal use left no trace anywhere: measured 30 August, four Gallery rooms in a
 * row served zero cards in 1.4ms each and the server log was completely empty.
 *
 * Aggregated deliberately: fifteen refused records are ONE line, not fifteen.
 */
async function fetchObjectsWithOutcome(
  ids: number[],
  optional = false,
): Promise<BatchOutcome> {
  let refused = 0;
  let reason: BatchOutcome["reason"] = null;
  const settled = await Promise.all(
    ids.map(async (id) => {
      try {
        // `rethrow` so the failure reaches us at all — it already treats a 404
        // as a settled answer rather than an error, which is exactly right: a
        // record the museum says does not exist is not a refusal.
        return await fetchObject(id, { rethrow: true, optional });
      } catch (err) {
        if (isBudgetExhausted(err)) {
          refused++;
          reason ??= "rate budget";
        } else if (isCircuitOpen(err)) {
          refused++;
          reason ??= "circuit open";
        }
        // Anything else (a timeout, a 403 that exhausted its retry) has already
        // been logged by the retry core, and still costs us the record.
        return null;
      }
    }),
  );
  return {
    objs: settled.filter((o): o is MetObject => o !== null),
    refused,
    reason,
  };
}

/** Fetch many records, dropping the ones that fail. Order is not preserved
 *  because the caller filters and truncates anyway.
 *
 *  `label` names the caller in the one line this prints when records were
 *  refused, so a thinned room can be told apart from an empty one in a deploy
 *  log. Callers that want to REACT to the shortfall (rather than only report it)
 *  use `fetchObjectsWithOutcome` directly. */
async function fetchObjects(
  ids: number[],
  label: string,
  optional = false,
): Promise<MetObject[]> {
  const out = await fetchObjectsWithOutcome(ids, optional);
  reportShortfall(label, out, ids.length);
  return out.objs;
}

/** The one line. Silent when nothing was refused, which is the normal case. */
function reportShortfall(label: string, out: BatchOutcome, asked: number) {
  if (!out.refused) return;
  console.warn(
    `[met] ${label}: ${out.objs.length}/${asked} records, ` +
      `${out.refused} refused (${out.reason})`,
  );
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
  return usable(await fetchObjects(ids, `artist-sample:${name}`));
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

  const cutoff = euPublicDomainCutoff();

  // ⚠️ THIS WAS THE MOST EXPENSIVE SINGLE ACTION IN THE APP, and it fired while
  // the reader was waiting: 1 search + up to 40 record fetches. Measured on
  // 30 August, "Rembrandt" cost **30 requests to return two names**. Everything
  // it ranks on — the name, the death year, the count — is in the published
  // catalogue, so it now costs nothing at all.
  //
  // The counts also got HONEST on the way. `rankArtists` tallied how often an
  // artist appeared in a 40-work sample of a relevance-sorted search, so "works"
  // was really a relevance proxy; the baked table counts their whole catalogue.
  const baked = rankBakedArtists(artistTable(), q);
  if (baked.length) {
    return baked
      .filter((m: MetArtistMatch) => deathYearCleared(m.death, cutoff))
      .map((m) => ({ name: m.name, works: m.hits }));
  }
  // No table: the live path it replaced, so a missing file costs money rather
  // than costing the reader the feature.
  const ids = (await searchIds({ artistOrCulture: "true", q })).slice(0, 40);
  if (!ids.length) return [];
  const objs = await fetchObjects(ids, `artist-search:${q}`);

  // Rank over works we could actually SHOW: public domain here, with an image.
  const shown = usable(objs);
  const hits = shown.map((o) => ({
    name: (o.artistDisplayName ?? "").trim(),
    death: parseDeathYear((o.artistEndDate ?? "").split("|")[0]),
  }));
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

  // The baked row carries exactly what the widening ladder needs — the modal
  // department and the span — tallied across the artist's whole catalogue rather
  // than across a 24-work sample. Measured before: ~24 requests for one answer.
  const row = bakedArtist(artistTable(), name);
  if (row) {
    const profile = profileFromBaked(row);
    profileCache.set(key, { at: Date.now(), profile });
    return profile;
  }

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
    // The artist facet is the one baked list that is NOT capped, precisely so a
    // deep drift through a prolific oeuvre still has somewhere to go. A capped
    // list would make Rembrandt look exhausted after 48 works.
    //
    // Unrotated: this path pages through the oeuvre in sequence (`sequential` in
    // useDriftSession), so a day-stable shuffle would re-serve work the reader
    // just saw. `windowStart` below does the paging.
    const bakedIds = facetIndex()?.artist[normalizeForIndex(name)] ?? [];
    const ids = bakedIds.length
      ? bakedIds
      : await searchIds({ artistOrCulture: "true", q: name });
    if (!ids.length) return [];
    const start = windowStart(offset, ids.length);
    const slice = ids.slice(start, start + Math.ceil(limit * OVERFETCH_LIVE));
    const mine = byExactArtist(
      usable(await fetchObjects(slice, `artist:${name}`)),
      name,
    );
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
  const others = usable(await fetchObjects(slice, `artist-ring:${name}`)).filter(
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
  const cards = await fetchInWaves(slice, limit, bucket);
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

  const cards = await fetchInWaves(slice, lim, bucket);
  await resolveArtistArticles(cards);
  return cards.map(toCardWithBody);
}

/**
 * Fetch a candidate slice in waves, and STOP EARLY for either good reason.
 *
 * ⚠️ THIS REPLACED ONE `Promise.all` OVER THE WHOLE SLICE, AND THAT SHAPE IS THE
 * BUG IT FIXES. Every id went out at once, so when the gate's window was spent
 * all fifteen threw together and the room served ZERO cards — measured in
 * production on 30 August, where five sequential room requests from one person
 * left the last two empty. A room that is short by half still reads. A room with
 * nothing in it is broken, and the feed has to fall back to a thread neighbour.
 *
 * Two stops, and they are different things:
 *
 *  - ENOUGH. The first wave asks for exactly `want`, not `want × overfetch`. The
 *    overfetch exists to cover records the filter drops, and on a baked pool
 *    almost nothing is dropped, so paying for it up front was pure waste. A cold
 *    room measured 15 requests before this and 12 after, for the same 12 cards.
 *  - REFUSED. If a wave came back short because OUR OWN gate or breaker refused
 *    it, the remaining ids cannot do better inside this window; they would only
 *    throw. Return what we have and say so.
 *
 * A record the museum answered about (a 404, a filtered work) is NOT a refusal
 * and does not stop anything: that is what the next wave is for.
 */
async function fetchInWaves(
  slice: number[],
  want: number,
  label: string,
): Promise<MetObject[]> {
  const kept: MetObject[] = [];
  let asked = 0;
  let refused = 0;
  let reason: BatchOutcome["reason"] = null;

  while (asked < slice.length && kept.length < want) {
    // Ask for exactly the shortfall. The first wave is therefore `want`, and any
    // later one only tops up what the filter removed.
    const wave = slice.slice(asked, asked + (want - kept.length));
    if (!wave.length) break;
    asked += wave.length;

    const out = await fetchObjectsWithOutcome(wave);
    kept.push(...usable(out.objs));
    if (out.refused) {
      refused += out.refused;
      reason ??= out.reason;
      break;
    }
  }

  if (refused) {
    console.warn(
      `[met] ${label}: ${kept.length}/${want} cards, ` +
        `${refused} of ${asked} records refused (${reason})`,
    );
  } else if (kept.length < want) {
    // Not a refusal: the pool simply ran short of works that survive the filter.
    // Worth one line all the same, because "thin room" and "throttled room" look
    // identical from the outside and are fixed by completely different things.
    console.info(`[met] ${label}: ${kept.length}/${want} cards from ${asked} records`);
  }
  return kept.slice(0, want);
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
  // The card's own record, on the optional lane like everything else this
  // route does: threads are a bonus, and the reader is already reading the card.
  const self = await fetchObject(Number(id), { optional: true });
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
  // Ids to fetch per facet in order to land those two.
  //
  // ⚠️ THIS WAS 3 BECAUSE A LIVE SEARCH RETURNED WORKS THE FILTER THEN DROPPED —
  // about a quarter of them. The baked lists contain only works that were public
  // domain, imaged and titled at build time, so the third fetch is now pure
  // waste on the baked path. Only the EU copyright test can still drop one, and
  // a facet that comes up short simply contributes fewer chips.
  const FETCH_PER_FACET = 2;

  const facetsFound = () => new Set(out.map((c) => c.facet)).size;

  const add = async (
    kind: FacetKind,
    value: string,
    params: Record<string, string>,
    label: string,
    facet: string,
    eyebrow: string,
  ) => {
    // Stop once the card has all the directions it can display. This is what
    // keeps the common case to three facets rather than four.
    if (facetsFound() >= FACETS_SHOWN) return;
    try {
      // ⚠️ THE BAKED LIST FIRST, AND A SEARCH ONLY IF THERE IS NO LIST (Phase 35).
      // The artist and subject facets differ on every card, so unlike the room
      // and department searches they could never be served from a cache — which
      // is why an artist-rich room cost twice what `medieval` did. The fallback
      // is a genuine fallback, not a formality: a card with no threads is a dead
      // end, so a missing index has to degrade to the search it replaced.
      const baked = facetCandidates(facetIndex(), kind, value);
      const ids = (baked.length ? baked : await searchIds(params, { optional: true }))
        .filter((n) => !usedIds.has(n))
        .slice(0, FETCH_PER_FACET);
      if (!ids.length) return;
      const found = await fetchObjects(ids, `threads ${facet}`, true);
      for (const a of usable(found).slice(0, PER_FACET)) {
        if (usedIds.has(a.objectID)) continue;
        usedIds.add(a.objectID);
        out.push(metToCandidate(a, label, facet, eyebrow));
      }
    } catch (err) {
      console.warn(`[met] facet ${facet} failed`, err);
    }
  };

  // ⚠️ THE FACET SEARCHES ARE DELIBERATELY *NOT* PHRASE-QUOTED. These are now the
  // only searches the adapter makes at all — the doorway stopped searching in
  // Phase 34 — and quoting them was measured to lose threads. A facet search
  // costs ONE request whatever it returns and only the first three ids are ever
  // fetched, so quoting saves nothing here; what it does is occasionally return
  // nothing, which silently deletes a thread chip.
  //
  // Measured against the live API, twice, on 27 August:
  //   artistOrCulture q=Winslow Homer     -> 13 works
  //   artistOrCulture q="Winslow Homer"   ->  0 works   (the chip disappears)
  // and it moves the other way just as arbitrarily (Hokusai: 10 -> 427). Their
  // quoting is not a phrase operator in any consistent sense, so the only safe
  // rule is to use it where it is measured to pay and nowhere else.
  // ⚠️ THE FIRST HAND, NOT THE WHOLE FIELD. `artistDisplayName` is pipe-separated
  // for a work with several hands ("Rembrandt (Rembrandt van Rijn)|Charles Blanc
  // |Gide"), and the baked index keys each artist separately — so looking up the
  // joined string would find nothing. It also fixes a small lie the chip used to
  // tell: "More by" over a pipe-joined list of three names.
  const artist = (self.artistDisplayName ?? "").split("|")[0].trim();
  if (artist) {
    await add(
      "artist",
      artist,
      { artistOrCulture: "true", q: artist },
      artist,
      `artist:${artist}`,
      "More by",
    );
  }

  const subject = artSubjects(self)[0];
  if (subject) {
    await add(
      "tag",
      subject,
      { tags: "true", q: subject },
      subject,
      `subject:${subject}`,
      "The subject",
    );
  }

  const place = (self.culture ?? "").trim() || (self.country ?? "").trim();
  if (place) {
    await add(
      "place",
      place,
      { geoLocation: place, q: "*" },
      place,
      `place:${place}`,
      "Also from",
    );
  }

  const department = (self.department ?? "").trim();
  if (department) {
    // Search by the department NAME rather than its id: the id is not on the
    // object record, and the museum's own name for the room is what the chip
    // should read anyway.
    await add("dept", department, { q: department }, department, `dept:${department}`, "The room");
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
  // Rethrowing, because /api/doorway caches this answer for a DAY. A refused or
  // timed-out record fetch used to return `null` here, indistinguishable from
  // "this artwork names nobody to look up" — so one throttled second froze
  // "no doorway" onto that card at the edge until tomorrow. The route turns a
  // throw into no doorway + NO_STORE, which is the same thing for the reader
  // and a very different thing for the cache.
  const obj = await fetchObject(Number(id), { rethrow: true, optional: true });
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
 * doorway.
 *
 * ⚠️ THIS NO LONGER ASKS THE MUSEUM ANYTHING TO DECIDE (Phase 34). It used to
 * search, then fetch up to five records and gate them — and since about HALF of
 * all cards have no Gallery match at all, half of that spend bought nothing. The
 * doorway fires on every card in both realms and was 92.6% of all Met traffic in
 * a 25-reader rehearsal (CLAUDE.md §4), measured at ~2.5 requests per
 * Encyclopedia card.
 *
 * Now the decision is a lookup in a blob baked offline from the museum's own CC0
 * catalogue (scripts/build-met-index.mjs), so:
 *
 *   a MISS costs NOTHING, and
 *   a HIT costs ONE record fetch — for the image path, which is the one thing
 *   the published catalogue does not carry.
 *
 * The matching rule moved to lib/realms/doorwayindex.ts and is deliberately
 * STRICTER than the `passesReverseGate` it replaced: that was a raw substring
 * test which only worked as a confirmation on top of relevance-ranked results,
 * and over the whole catalogue it answered "Owl" with an Open Bowl.
 */
export async function metTopMatch(
  term: string,
): Promise<{ card: Card; title: string; term_titles: string[] } | null> {
  const idx = doorwayIndex();
  if (!idx) return null;

  const now = new Date();
  // The cut-off is recomputed from the clock on every request, never baked: it
  // widens every 1 January, and a frozen answer would quietly stop admitting
  // newly-expired work (CLAUDE.md §4).
  const cutoff = euPublicDomainCutoff(now);
  const candidates = doorwayCandidates(idx, term).filter((c) => {
    // Applied from the BAKED death year, so a work still in term costs no
    // request to reject. A work with no recorded death year is left to
    // `usable()` after the fetch, which has the record's own dates to judge on.
    if (!c.deathYear) return true;
    return deathYearCleared(c.deathYear, cutoff);
  });
  if (!candidates.length) return null;

  // A handful at most. The blob is baked in quality order and title matches are
  // ranked first, so the first candidate is almost always the answer; the rest
  // cover a record the museum has since withdrawn or that fails `usable()`.
  for (const c of candidates.slice(0, DOORWAY_FETCH_MAX)) {
    // `rethrow` so a refused or timed-out fetch reaches the route as an error
    // rather than as "no doorway": the route caches a miss for a DAY, and that
    // is only honest while a miss really means "we looked, there is nothing".
    const obj = await fetchObject(c.id, { rethrow: true, optional: true });
    if (!obj) continue;
    const [ok] = usable([obj], now);
    if (!ok) continue;
    await resolveArtistArticles([ok]);
    return {
      card: toCardWithBody(ok),
      title: (ok.title ?? "").trim(),
      term_titles: artSubjects(ok),
    };
  }
  return null;
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
