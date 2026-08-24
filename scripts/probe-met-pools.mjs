// ---------------------------------------------------------------------------
// Probe The Met once, offline, and bake what the Gallery needs to run without
// depending on a live search on every cold start.
//
// WHY THIS EXISTS. Two problems, one script.
//
//  1. THE MET'S EDGE THROTTLES WITH 403. Not 429, no `Retry-After`, and it trips
//     on sustained bursts — it happened four times while Phase 31 was being
//     built. When it does, `poolFor` cannot fetch a room's id list and the room
//     serves nothing. Degradation is correct (empty batch, HTTP 200, feed
//     intact) but an empty room is a bad read. Baking the pools removes the
//     largest, slowest and most throttle-prone call from the hot path entirely.
//
//  2. THE FORM/PERIOD PICKER NEEDS HONEST COUNTS. The collection is not uniform
//     (82,687 prints against 14,297 paintings), and a form has periods it simply
//     has nothing in. Offering "Photographs, 1500s" is a button that leads
//     nowhere, so `erasForForm` hides a slice the museum cannot fill. Computing
//     that per visit would be a needless upstream hit just to render tiles.
//
// The ids are PRE-FILTERED: only works that were `isPublicDomain` with an image
// at probe time are kept, so a discover batch barely has to over-fetch.
//
// WHAT IS DELIBERATELY *NOT* BAKED: the EU copyright test. That is recomputed
// per request from the clock, because the cut-off widens every 1 January and a
// frozen answer would quietly stop admitting newly-expired work.
//
// Run by hand, from the repo root:
//   node scripts/probe-met-pools.mjs            # everything (slow, ~25 min)
//   node scripts/probe-met-pools.mjs --rooms    # just the room pools
//   node scripts/probe-met-pools.mjs --forms    # just the form/period counts
//
// It is deliberately slow. Politeness to a source we depend on entirely costs
// nothing here, and being throttled halfway through is the only real failure
// mode. Re-run it if the catalogue shifts.
// ---------------------------------------------------------------------------

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const API = "https://collectionapi.metmuseum.org/public/collection/v1";
const UA =
  process.env.MET_USER_AGENT ||
  "Drift/1.0 (https://www.usedrift.org; thomasvdhulst03@gmail.com)";

/** How many ids to keep per room. A 25-card session touches ~30, so this is
 *  weeks of variety without a large file. */
const POOL_SIZE = 250;
/** How many candidates to check per room in order to fill that pool. */
const CHECK_LIMIT = 420;
/** Request spacing. Far gentler than the adapter's 50ms: this runs once. */
const GAP_MS = 260;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastAt = 0;
async function get(url, tries = 5) {
  for (let attempt = 0; ; attempt++) {
    const wait = Math.max(0, lastAt + GAP_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA } });
    } catch (err) {
      if (attempt >= tries) throw err;
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.ok) return res.json();
    // 403 here means throttled, not forbidden. Back off hard and long: this
    // script has all the time in the world and the alternative is a half-baked
    // pool file that looks complete.
    if ((res.status === 403 || res.status === 429 || res.status === 503) && attempt < tries) {
      const back = 15000 * (attempt + 1);
      process.stderr.write(`    (${res.status}; backing off ${back / 1000}s)\n`);
      await sleep(back);
      continue;
    }
    if (res.status === 404) return null;
    throw new Error(`${res.status} for ${url}`);
  }
}

// `q` MUST be the last parameter: the Met silently ignores the other filters
// otherwise (medium=Prints&dateBegin=1600&dateEnd=1800&q=* returns 16,405, the
// same query with q moved earlier returns 1). Enforced here, as in the adapter.
async function searchIds(params) {
  const { q, ...rest } = params;
  const qs = new URLSearchParams({
    hasImages: "true",
    ...rest,
    ...(q !== undefined ? { q } : {}),
  }).toString();
  const raw = await get(`${API}/search?${qs}`);
  return Array.isArray(raw?.objectIDs) ? raw.objectIDs : [];
}

/** Deterministic shuffle, so a re-run of the script produces a comparable pool
 *  rather than a wholly different one. */
function shuffle(list, seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Keep only ids the museum will actually give us a public-domain image for. */
async function filterUsable(ids, want, label) {
  const kept = [];
  let checked = 0;
  for (const id of ids) {
    if (kept.length >= want || checked >= CHECK_LIMIT) break;
    checked++;
    const o = await get(`${API}/objects/${id}`);
    if (o?.isPublicDomain && o?.primaryImage && (o?.title ?? "").trim()) kept.push(id);
    if (checked % 50 === 0) {
      process.stdout.write(`    ${label}: ${kept.length} kept of ${checked} checked\n`);
    }
  }
  return { kept, checked };
}

// --- the registries this script fills -------------------------------------
// Kept in step with src/lib/realms/met.buckets.ts and met.forms.ts by hand;
// a mismatch shows up as a missing pool, which the adapter treats as "fall back
// to a live search" rather than as an error.

const ROOMS = [
  ["africa-oceania-americas", { departmentId: "5", q: "*" }],
  ["egypt", { departmentId: "10", q: "*" }],
  ["arms-armor", { departmentId: "4", q: "*" }],
  ["asian", { departmentId: "6", q: "*" }],
  ["drawings-prints", { departmentId: "9", q: "*" }],
  ["costume", { departmentId: "8", q: "*" }],
  ["european-paintings", { departmentId: "11", q: "*" }],
  ["greek-roman", { departmentId: "13", q: "*" }],
  ["impressionism", { q: "Impressionism" }],
  ["islamic", { departmentId: "14", q: "*" }],
  ["ukiyo-e", { q: "ukiyo-e" }],
  ["medieval", { departmentId: "17", q: "*" }],
  ["instruments", { departmentId: "18", q: "*" }],
  ["photographs", { departmentId: "19", q: "*" }],
];

const FORMS = [
  ["ceramics", "Ceramics"],
  ["drawing", "Drawings"],
  ["glass", "Glass"],
  ["jewelry", "Jewelry"],
  ["metalwork", "Metalwork"],
  ["painting", "Paintings"],
  ["photograph", "Photographs"],
  ["print", "Prints"],
  ["sculpture", "Sculpture"],
  ["textile", "Textiles"],
];

const ERAS = [
  ["pre-1500", -4000, 1499],
  ["1500s", 1500, 1599],
  ["1600s", 1600, 1699],
  ["1700s", 1700, 1799],
  ["1800-1849", 1800, 1849],
  ["1850-1899", 1850, 1899],
  ["1900-1929", 1900, 1929],
];

// --- runners ---------------------------------------------------------------

async function probeRooms(save) {
  const pools = {};
  for (const [id, params] of ROOMS) {
    process.stdout.write(`  ${id}\n`);
    const all = await searchIds(params);
    if (!all.length) {
      process.stdout.write(`    no results; skipping\n`);
      continue;
    }
    const { kept, checked } = await filterUsable(
      shuffle(all, 0x5eed ^ id.length),
      POOL_SIZE,
      id,
    );
    pools[id] = kept;
    // Save after EVERY room. The Met throttles hard and a run can take hours, so
    // a run that is interrupted must leave behind the rooms it did finish rather
    // than nothing at all. A partial file is fine: the adapter falls back to a
    // live search for any room it has no baked pool for.
    save(pools);
    process.stdout.write(
      `    -> ${kept.length} usable ids (from ${all.length} matches, ${checked} checked)\n`,
    );
  }
  return pools;
}

/**
 * Counts per form and period. These are `hasImages` totals, NOT public-domain
 * totals: one search each rather than thousands of record fetches. They are used
 * only to hide a slice the museum cannot fill and to show an honest order of
 * magnitude, so a consistent over-count is fine — but the threshold that reads
 * them must allow for it, which is why MIN_ERA_WORKS is set well above 0.
 */
async function probeForms() {
  const counts = {};
  for (const [formId, medium] of FORMS) {
    counts[formId] = {};
    const all = await searchIds({ medium, q: "*" });
    counts[formId].all = all.length;
    process.stdout.write(`  ${formId}: ${all.length} total\n`);
    for (const [eraId, from, to] of ERAS) {
      const n = await searchIds({
        medium,
        q: "*",
        dateBegin: String(from),
        dateEnd: String(to),
      });
      counts[formId][eraId] = n.length;
      process.stdout.write(`    ${eraId}: ${n.length}\n`);
    }
  }
  return counts;
}

// --- main ------------------------------------------------------------------

const args = process.argv.slice(2);
const doRooms = args.length === 0 || args.includes("--rooms");
const doForms = args.length === 0 || args.includes("--forms");

// MERGE with whatever is already baked. Running with --rooms alone must not
// silently drop the form counts (or vice versa): the file is one artefact built
// from two independent, slow passes, and losing half of it to a flag is a very
// easy mistake to make and a very quiet one to notice.
const DEST = resolve(process.cwd(), "src/lib/realms/met.pools.json");
mkdirSync(dirname(DEST), { recursive: true });

let existing = {};
try {
  existing = JSON.parse(
    readFileSync(DEST, "utf8"),
  );
} catch {
  /* first run */
}

const out = {
  ...existing,
  generated: new Date().toISOString().slice(0, 10),
  note:
    "Generated by scripts/probe-met-pools.mjs. Pools are ids that were public " +
    "domain WITH an image at probe time; the EU copyright test is NOT baked and " +
    "still runs per request. Re-run the script if the catalogue shifts.",
};

function save(pools) {
  out.pools = { ...(out.pools ?? {}), ...pools };
  writeFileSync(DEST, JSON.stringify(out, null, 1) + "\n");
}

if (doRooms) {
  process.stdout.write("Rooms\n");
  await probeRooms(save);
}
if (doForms) {
  process.stdout.write("Forms x periods\n");
  out.formCounts = await probeForms();
}

writeFileSync(DEST, JSON.stringify(out, null, 1) + "\n");
process.stdout.write(`\nWrote ${DEST}\n`);
