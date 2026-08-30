// ---------------------------------------------------------------------------
// Bake the reverse doorway (Phase 34), so an Encyclopedia card can find its
// Gallery match WITHOUT asking the museum anything.
//
// WHY THIS EXISTS. `/api/doorway` fires on every card in both realms and was
// measured at 92.6% of all Met traffic in a 25-reader rehearsal (CLAUDE.md §4),
// costing ~2.5 requests per Encyclopedia card. About HALF of all cards have no
// doorway at all, and every one of those misses still paid for a search plus
// record fetches to discover that nothing was there.
//
// The Met publishes its whole catalogue as CC0 open data, and it carries
// everything the decision needs: Object ID, Is Public Domain, Title, Tags,
// Is Highlight and Artist End Date. What it does NOT carry is the image path,
// which is why a doorway HIT still costs one record fetch and a MISS becomes
// free.
//
// Run by hand, from the repo root. It streams ~317 MB and takes a few minutes:
//   node scripts/build-met-index.mjs
//
// Exactly ONE request is made to the museum (the imaged-id list). The catalogue
// itself comes from GitHub, so this is gentle on a source we depend on entirely.
//
// WHAT IS DELIBERATELY *NOT* BAKED: the EU copyright test, for the same reason
// probe-met-pools.mjs does not bake it — the cut-off widens every 1 January and
// a frozen answer would quietly stop admitting newly-expired work. The artist's
// death YEAR is baked; the test against it runs per request.
// ---------------------------------------------------------------------------

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { StringDecoder } from "node:string_decoder";

const API = "https://collectionapi.metmuseum.org/public/collection/v1";
const CSV =
  "https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv";
const UA =
  process.env.MET_USER_AGENT ||
  "Drift/1.0 (https://www.usedrift.org; thomasvdhulst03@gmail.com)";

// Column positions in MetObjects.csv. Pinned by name below so a re-ordered
// export fails loudly instead of baking garbage.
const COL = {
  isHighlight: 1,
  isTimeline: 2,
  isPublicDomain: 3,
  objectId: 4,
  department: 6,
  title: 9,
  culture: 10,
  artist: 18,
  artistEnd: 24,
  objectBegin: 29,
  objectEnd: 30,
  country: 38,
  tags: 51,
};
const EXPECT = {
  1: "Is Highlight",
  2: "Is Timeline Work",
  3: "Is Public Domain",
  4: "Object ID",
  6: "Department",
  9: "Title",
  10: "Culture",
  18: "Artist Display Name",
  24: "Artist End Date",
  29: "Object Begin Date",
  30: "Object End Date",
  38: "Country",
  51: "Tags",
};

/**
 * How many ids to keep per facet value.
 *
 * `metRelated` shows ONE candidate per facet and fetches at most two, so this is
 * about variety across days rather than about depth: `facetCandidates` rotates
 * the list daily, so 48 is roughly a fortnight of different threads for the same
 * subject. Measured at 24 the whole facet file was 101,029 postings; 48 keeps it
 * comfortably small.
 *
 * ⚠️ THE ARTIST FACET IS DELIBERATELY NOT CAPPED — see `capFor`.
 */
const FACET_CAP = 48;

/** The cap for one facet kind. Artist is uncapped because `metArtistDiscover`
 *  ring 0 PAGES THROUGH AN ARTIST'S WHOLE OEUVRE, and a cap would make a
 *  prolific artist look exhausted after 48 works — which is a content bug, not
 *  a size saving. Uncapped it is 102,705 postings across 24,034 artists. */
function capFor(kind) {
  return kind === "artist" ? Infinity : FACET_CAP;
}

/** A year from one of the museum's date columns, or null.
 *
 *  ⚠️ CLAMPED, because the catalogue contains typos and they land straight in a
 *  profile's date span: measured, "Brewster & Co." spans 1845 to **2870**. A
 *  span is what ring 1 of an artist drift filters on, so a bad year quietly
 *  widens the ring to nothing. */
function year(raw) {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n === 0) return null;
  return n >= -3000 && n <= NOW_YEAR ? n : null;
}
const NOW_YEAR = new Date().getUTCFullYear();

/** The artists on one work, each paired with its own death year.
 *  Both columns are pipe-separated and aligned index for index. */
function splitArtists(names, ends) {
  const list = String(names ?? "")
    .split("|")
    .map((n) => n.trim());
  const deaths = String(ends ?? "").split("|");
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (!list[i]) continue;
    out.push({ name: list[i], death: deathYear(deaths[i] ?? "") });
  }
  return out;
}

/** A robust span: the 5th and 95th percentile rather than min and max.
 *
 *  The live version tallied this from a 24-work SAMPLE, so one mis-catalogued
 *  reproduction barely moved it. Over an artist's whole output min/max is much
 *  more exposed — Rembrandt came out as 1600 to 1986 on the first build, because
 *  of a single late item. */
function span(years) {
  if (!years.length) return [null, null];
  const s = years.slice().sort((a, b) => a - b);
  const at = (q) => s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)))];
  return [at(0.05), at(0.95)];
}

const NL = "\n";
const QUOTE = '"';
/** Field separator inside a line. Wraps every field so a boundary-anchored
 *  search cannot run from the end of the title into the start of a tag —
 *  otherwise "mount fuji" matches a title ending "mount" beside a tag "fuji". */
const SEP = String.fromCharCode(1);

/**
 * The one normalisation, shared with the runtime matcher.
 *
 * ⚠️ IT MUST STAY IDENTICAL TO `normalizeForIndex` IN lib/realms/doorwayindex.ts.
 * A build script cannot import from the app (it is plain Node, the app is TS),
 * so the copy is pinned by a test rather than trusted — the same arrangement
 * lib/loadbot*.test.ts uses for the load harness's copied URL builders.
 */
function normalize(s) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    // Combining marks REMOVED, not turned into a space — see the note on
    // `normalizeForIndex`. "Maison Léoty" must fold to "maison leoty", never
    // "maison le oty".
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

/** The artist TABLE is keyed the way the runtime looks it up, which is
 *  `foldName` (lib/realms/met.artist.ts) and not `normalize`. Pinned by
 *  metfacets.test.ts. The facet lists use `normalize`, because those are looked
 *  up through `facetCandidates`. Two tables, two lookups, two normalisers. */
function fold(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The artist's death year, or 0 when the catalogue does not record one.
 *  Multi-artist works carry a pipe-separated list; the FIRST is the one the
 *  adapter uses (`metPdInput`), so take the same one. */
function deathYear(raw) {
  const first = String(raw ?? "").split("|")[0];
  const m = first.match(/-?\d{1,4}/);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 && n < 2200 ? n : 0;
}

async function imagedIds() {
  // ONE request. Their search returns the whole matching id array at once, so
  // "does this work have an image" costs nothing per work.
  process.stdout.write("Asking the museum which works have an image… ");
  const res = await fetch(`${API}/search?hasImages=true&q=*`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`${res.status} from the Met search`);
  const raw = await res.json();
  const ids = new Set(raw?.objectIDs ?? []);
  process.stdout.write(`${ids.size.toLocaleString()}\n`);
  if (ids.size < 100_000) throw new Error("implausibly few imaged ids; aborting");
  return ids;
}

/** Stream the catalogue, keeping only what the index needs. */
async function readCatalogue(imaged) {
  process.stdout.write("Streaming MetObjects.csv (~317 MB)… ");
  const res = await fetch(CSV);
  if (!res.ok) throw new Error(`${res.status} fetching the catalogue`);

  const rows = [];
  let head = true;
  let row = [];
  let field = "";
  let inQuotes = false;
  let bytes = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (head) {
      head = false;
      for (const [at, name] of Object.entries(EXPECT)) {
        // The BOM rides on column 0, so compare loosely.
        if (!String(row[at]).includes(name)) {
          throw new Error(
            `column ${at} is "${row[at]}", expected "${name}" — the export changed shape`,
          );
        }
      }
      row = [];
      return;
    }
    if (row[COL.isPublicDomain] === "True") {
      const id = Number(row[COL.objectId]);
      const title = normalize(row[COL.title]);
      // The three conditions of `isUsableArtwork` (lib/realms/met.ts): public
      // domain, an image, and a title. An index that promised a work the card
      // filter then rejects would spend a request to learn nothing.
      if (title && imaged.has(id)) {
        rows.push({
          id,
          title,
          tags: (row[COL.tags] ?? "").split("|").map(normalize).filter(Boolean),
          highlight: row[COL.isHighlight] === "True",
          timeline: row[COL.isTimeline] === "True",
          death: deathYear(row[COL.artistEnd]),
          // The four facets `metRelated` threads on, plus what a profile needs.
          //
          // ⚠️ `Artist Display Name` IS PIPE-SEPARATED FOR A WORK WITH SEVERAL
          // HANDS, and so is `Artist End Date`, index for index. Treating the
          // whole string as one artist invents people: the first build produced
          // "Edgar Degas|Rembrandt (Rembrandt van Rijn)" as a single artist with
          // one work. Split, pair each name with its own death year, and index
          // each separately, so "more by Rembrandt" finds the works where he is
          // one hand among several.
          artists: splitArtists(row[COL.artist], row[COL.artistEnd]),
          // The museum's order of specificity, matching `metRelated`'s own
          // `culture || country` (realms/server/met.ts).
          place: (row[COL.culture] ?? "").trim() || (row[COL.country] ?? "").trim(),
          dept: (row[COL.department] ?? "").trim(),
          from: year(row[COL.objectBegin]),
          to: year(row[COL.objectEnd]),
        });
      }
    }
    row = [];
  };

  // A StringDecoder, not a per-chunk toString: the catalogue is full of CJK
  // titles and a multi-byte character split across a chunk boundary would
  // decode to a replacement char, silently corrupting that work's title.
  const decoder = new StringDecoder("utf8");
  for await (const chunk of res.body) {
    bytes += chunk.length;
    const s = decoder.write(Buffer.from(chunk));
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQuotes) {
        if (c === QUOTE) {
          if (s[i + 1] === QUOTE) {
            field += QUOTE;
            i++;
          } else inQuotes = false;
        } else field += c;
      } else if (c === QUOTE) inQuotes = true;
      else if (c === ",") endField();
      else if (c === NL) endRow();
      else if (c !== "\r") field += c;
    }
  }
  const tail = decoder.end();
  for (const c of tail) {
    if (c === NL) endRow();
    else if (c !== "\r") field += c;
  }
  if (field || row.length) endRow();
  process.stdout.write(
    `${(bytes / 1e6).toFixed(0)} MB read, ${rows.length.toLocaleString()} usable works\n`,
  );
  return rows;
}

const imaged = await imagedIds();
const rows = await readCatalogue(imaged);
if (rows.length < 100_000) throw new Error("implausibly few usable works; aborting");

// ---------------------------------------------------------------------------
// Order matters, and it is what makes ranking free at query time.
//
// The blob is sorted by a TERM-INDEPENDENT quality rank, so the earliest match
// for any term is already the best-ranked one and the matcher only has to break
// ties among the handful it collects. The museum's own curation first, then the
// most on-point label: a work titled "Wolf" answers the article better than one
// titled "Wolf and Fox Hunt in a Wooded Landscape".
// ---------------------------------------------------------------------------
rows.sort(
  (a, b) =>
    Number(b.highlight) - Number(a.highlight) ||
    Number(b.timeline) - Number(a.timeline) ||
    a.title.length - b.title.length ||
    a.id - b.id,
);

// Each field wrapped in SEP and space-padded, so the runtime can anchor a match
// to a word boundary with a plain indexOf(" " + term).
const lines = rows.map(
  (r) => [r.title, ...r.tags].map((f) => `${SEP} ${f} `).join("") + SEP,
);
const blob = lines.join(NL);

// Two parallel Int32 columns: the object id, and the artist's death year (0 for
// none). The death year rides along so a work still in EU copyright is skipped
// without spending a request to find out.
const ids = new Int32Array(rows.length * 2);
rows.forEach((r, i) => {
  ids[i * 2] = r.id;
  ids[i * 2 + 1] = r.death;
});

// ---------------------------------------------------------------------------
// The facet lists (Phase 35), which are what stop `metRelated` searching.
//
// Four inverted lists, built in the SAME order as the blob above, so a facet's
// first candidates are its best-ranked works and no query-time sorting is
// needed. `foldName` is not used here: the runtime looks these up with the same
// `normalize` the blob uses, and one normaliser is the whole point.
// ---------------------------------------------------------------------------
const facets = { artist: {}, place: {}, dept: {}, tag: {} };
function addFacet(kind, value, id) {
  const key = normalize(value);
  if (!key) return;
  const list = facets[kind][key];
  if (list === undefined) facets[kind][key] = [id];
  else if (list.length < capFor(kind)) list.push(id);
}
for (const r of rows) {
  for (const a of r.artists) addFacet("artist", a.name, r.id);
  addFacet("place", r.place, r.id);
  addFacet("dept", r.dept, r.id);
  for (const t of r.tags) addFacet("tag", t, r.id);
}

// ---------------------------------------------------------------------------
// The artist table, which is what stops `metArtistSearch` costing 30 requests
// to return two names, and `metArtistProfile` costing 24 to return a department
// and a date span.
//
// Both used to TALLY these from a sample of the artist's works, because The Met
// has no aggregations. The catalogue has every work, so the tally is exact here
// rather than approximate — the counts are the artist's real totals, not their
// frequency in a 40-work sample.
// ---------------------------------------------------------------------------
const artistRows = new Map();
for (const r of rows) {
  for (const hand of r.artists) {
    const key = fold(hand.name);
    if (!key) continue;
    let a = artistRows.get(key);
    if (!a) {
      a = { key, name: hand.name, works: 0, depts: new Map(), years: [], death: 0 };
      artistRows.set(key, a);
    }
    a.works++;
    if (!a.death && hand.death) a.death = hand.death;
    if (r.dept) a.depts.set(r.dept, (a.depts.get(r.dept) ?? 0) + 1);
    if (r.from !== null) a.years.push(r.from);
    if (r.to !== null) a.years.push(r.to);
  }
}
const artists = [...artistRows.values()].map((a) => {
  const dept = [...a.depts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  const [from, to] = span(a.years);
  return {
    k: a.key,
    n: a.name,
    w: a.works,
    ...(dept ? { d: dept } : {}),
    ...(from !== null ? { f: from } : {}),
    ...(to !== null ? { t: to } : {}),
    ...(a.death ? { x: a.death } : {}),
  };
});

const DIR = resolve(process.cwd(), "src/lib/realms");
mkdirSync(DIR, { recursive: true });

const blobGz = gzipSync(Buffer.from(blob, "utf8"), { level: 9 });
const idsGz = gzipSync(Buffer.from(ids.buffer), { level: 9 });
writeFileSync(resolve(DIR, "met.doorway.txt.gz"), blobGz);
writeFileSync(resolve(DIR, "met.doorway.ids.gz"), idsGz);

// Gzipped JSON rather than the blob-and-offsets shape the doorway uses. That
// shape earns its complexity there because a SUBSTRING search over 12 MB needs
// one flat string; these are plain key lookups, and JSON.parse of a few hundred
// kilobytes is both simpler and fast enough.
const facetsGz = gzipSync(Buffer.from(JSON.stringify(facets)), { level: 9 });
const artistsGz = gzipSync(Buffer.from(JSON.stringify(artists)), { level: 9 });
writeFileSync(resolve(DIR, "met.facets.json.gz"), facetsGz);
writeFileSync(resolve(DIR, "met.artists.json.gz"), artistsGz);
writeFileSync(
  resolve(DIR, "met.doorway.meta.json"),
  JSON.stringify(
    {
      generated: new Date().toISOString().slice(0, 10),
      works: rows.length,
      highlights: rows.filter((r) => r.highlight).length,
      withDeathYear: rows.filter((r) => r.death).length,
      blobBytes: Buffer.byteLength(blob),
      artists: artists.length,
      facets: Object.fromEntries(
        Object.entries(facets).map(([k, v]) => [k, Object.keys(v).length]),
      ),
      note:
        "Generated by scripts/build-met-index.mjs from The Met's CC0 open-access " +
        "catalogue. Works that were public domain, imaged and titled at build " +
        "time. The EU copyright test is NOT baked: the artist death year is, and " +
        "the test against it runs per request because the cut-off widens every " +
        "1 January. Re-run the script if the catalogue shifts.",
    },
    null,
    1,
  ) + "\n",
);

process.stdout.write(
  `\nWrote src/lib/realms/met.doorway.*\n` +
    `  works      ${rows.length.toLocaleString()}\n` +
    `  blob       ${(Buffer.byteLength(blob) / 1e6).toFixed(1)} MB  ->  ${(blobGz.length / 1e6).toFixed(1)} MB gzipped\n` +
    `  ids        ${(ids.byteLength / 1e6).toFixed(1)} MB  ->  ${(idsGz.length / 1e6).toFixed(1)} MB gzipped\n` +
    `  facets     ${Object.entries(facets)
      .map(([k, v]) => `${k} ${Object.keys(v).length}`)
      .join(", ")}  ->  ${(facetsGz.length / 1e6).toFixed(2)} MB gzipped\n` +
    `  artists    ${artists.length.toLocaleString()}  ->  ${(artistsGz.length / 1e6).toFixed(2)} MB gzipped\n`,
);
