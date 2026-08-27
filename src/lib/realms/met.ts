// Pure Metropolitan Museum of Art mappers (no network — the server adapter
// fetches and calls these). Kept separate from server/met.ts so the normalizers
// are unit-testable without importing server-only fetch code.

import type { Card, RelatedCandidate } from "../types";
import { splitDeathYears, type PdInput } from "./publicdomain";

/** The museum's image host. Every derivative of one artwork lives under a stable
 *  path: /CRDImages/{dept}/{size}/{name}.jpg — verified consistent across
 *  departments (ep, as, eg, es, gr, …). */
const IMAGES = "https://images.metmuseum.org/CRDImages";

/**
 * The size buckets the museum publishes. There is no on-the-fly resizing: these
 * four are all that exist, and `web-large` is capped around 600px, which is
 * softer than a full-screen card wants on a retina display. That is why Drift
 * serves artwork through its own `/api/img/met/...` route instead of linking
 * here directly — see `metImageUrl` below.
 */
export type MetImageSize = "original" | "web-large" | "mobile-large";

/** The two path components an image is addressed by. Parsed out of the museum's
 *  own URL, then re-composed by us, so a malformed upstream URL simply yields no
 *  picture rather than a broken or attacker-influenced one. */
export interface MetImageRef {
  dept: string;
  name: string;
}

/** Anchored, and applied to BOTH components before either is used to build a
 *  URL. The proxy route re-validates with the same shapes: an id that cannot be
 *  spelled here cannot be spelled there. */
export const MET_DEPT_RE = /^[a-z]{2,4}$/;
export const MET_NAME_RE = /^[A-Za-z0-9._-]{1,120}$/;

/**
 * Pull `{dept, name}` out of a museum image URL.
 *
 * The URL is never carried forward as-is. We take only the two identifying
 * components, check them against anchored patterns, and rebuild every URL from
 * scratch — so nothing the upstream says can point our proxy at another host.
 */
export function parseMetImage(url?: string | null): MetImageRef | undefined {
  if (!url) return undefined;
  const m = url.match(
    /^https:\/\/images\.metmuseum\.org\/CRDImages\/([^/]+)\/[^/]+\/([^/]+)\.jpg$/,
  );
  if (!m) return undefined;
  const [, dept, name] = m;
  if (!MET_DEPT_RE.test(dept) || !MET_NAME_RE.test(name)) return undefined;
  return { dept, name };
}

/** The museum's own URL. What the proxy route fetches. */
export function metUpstreamImageUrl(
  ref: MetImageRef,
  size: MetImageSize = "original",
): string {
  return `${IMAGES}/${ref.dept}/${size}/${ref.name}.jpg`;
}

/**
 * The ONLY widths `/api/img/met` will serve, and the only ones Drift asks for:
 * the trail-map thumbnail, the card, and the deep-zoom lightbox.
 *
 * ⚠️ THIS IS A COST CONTROL, NOT A TIDY-UP, and it is why the type below is a
 * union rather than `number`. The route used to accept any integer from 16 to
 * 1686. Every distinct width is its own CDN cache key AND its own origin fetch,
 * and above `SMALL_SOURCE_MAX` each one pulls a multi-megabyte original from the
 * museum, runs a sharp resize and pins a 30-day `immutable` entry. That is ~1,286
 * expensive variants per artwork that an unauthenticated caller could walk, on a
 * route with no auth in front of it — measured on the live site, widths 701/703/
 * 707 each answered `x-vercel-cache: MISS` with a separate upstream fetch. Set
 * against the museum's ~80 requests per 30 seconds (and the day-long budget
 * shrink that repeated tripping causes), a for-loop could take the Gallery down
 * for every reader and bill us for it.
 *
 * Keeping the list HERE, next to the functions that build the URLs, is what stops
 * the route's validator drifting from what the app actually generates: adding a
 * width means adding it here, which makes it legal in both places at once.
 */
export const MET_IMAGE_WIDTHS = [160, 843, 1686] as const;

/** A width the proxy will serve. */
export type MetImageWidth = (typeof MET_IMAGE_WIDTHS)[number];

/** Whether `w` is one of the three widths the proxy serves. */
export function isMetImageWidth(w: number): w is MetImageWidth {
  return (MET_IMAGE_WIDTHS as readonly number[]).includes(w);
}

/**
 * Read the `[width]` path segment, or null if it is not one Drift serves.
 *
 * The route's whole gate, kept here so it is pure and unit-tested rather than
 * living as two conditions in a handler.
 *
 * ⚠️ IT INSISTS ON A CANONICAL SPELLING, which is the non-obvious half. `Number`
 * reads "0843", "843.0", "+843", "8.43e2" and " 843" all as 843, and each of
 * those is a DIFFERENT URL, hence a different CDN cache key, hence another
 * origin fetch and another 30-day entry for a byte-identical picture. That is a
 * smaller copy of exactly the multiplication `MET_IMAGE_WIDTHS` exists to stop,
 * so comparing the number back to the segment it came from leaves precisely one
 * legal spelling per width.
 */
export function parseMetImageWidth(segment: string): MetImageWidth | null {
  const w = Number(segment);
  if (String(w) !== segment) return null;
  return isMetImageWidth(w) ? w : null;
}

/**
 * Does this image-host response mean THE HOST is in trouble, as opposed to this
 * one picture not existing?
 *
 * ⚠️ THE ANSWER DECIDES WHETHER A STRANGER CAN TURN THE GALLERY OFF. The image
 * route used to feed `!res.ok` straight into its breaker, so a 404 counted as a
 * refusal. The breaker opens after four in a row, so four requests for
 * well-formed but nonexistent names — and the name is a free path segment anyone
 * can type — shut every Met image off for thirty seconds, repeatable forever, on
 * a route with no auth in front of it. Measured before the fix: a real artwork
 * answered 200 with 41 KB of JPEG, four bogus names went by, and the SAME
 * artwork then answered 502 `CircuitOpenError`.
 *
 * This is the rule `fetchUpstream` already states for the API host ("Only a
 * THROTTLE moves the breaker. A 404 is a perfectly healthy answer from a healthy
 * host"). The image route hand-rolls its own fetch loop and so never inherited
 * it; this predicate is that rule, written once and tested.
 *
 * It is deliberately NOT the same list as `fetchUpstream`'s. That host refuses
 * with 403/429; THIS host fails by going slow or falling over, which is why a
 * timeout counts (recorded at the throw site, not here) and why any 5xx counts.
 * A 403 does not: the image CDN does not use it to throttle, and treating one as
 * a throttle would re-open the same hole from a different direction.
 */
export function isMetImageHostFailure(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * The card's image: our own origin, resized to the width asked for.
 *
 * WHY THIS IS A PROXY AND NOT A HOTLINK. The museum publishes four fixed
 * derivatives and does no resizing. Its largest "small" one is about 600px,
 * which is soft on a card that occupies ~750 CSS px on a desktop, and the only
 * thing above it is a ~4000px original of several megabytes. Neither is a card
 * image, so the arbitrary widths the Art Institute's IIIF server used to provide
 * have to come from somewhere, and this is that somewhere. That is load-bearing
 * on its own, which is why there is no flag to turn the route off.
 *
 * ⚠️ THERE USED TO BE A SECOND REASON HERE AND IT IS NO LONGER TRUE. This
 * comment said `images.metmuseum.org` sends no `Access-Control-Allow-Origin` at
 * all, so the trail map's `crossOrigin="anonymous"` nodes could not load a
 * hotlinked artwork. Re-measured 27 August 2026, four ways (both `web-large` and
 * `original`, with and without an `Origin` header): it returns
 * `access-control-allow-origin: *` every time. The original measurement is not
 * disputed — the header was absent then and is present now — but do not quote
 * the CORS argument any more. The size argument above carries the decision by
 * itself. Note also that the exported PNG drops images entirely by design, see
 * lib/export-image.ts, so the proxy is never about the export.
 */
export function metImageUrl(
  ref: MetImageRef,
  width: MetImageWidth = 843,
): string {
  return `/api/img/met/${ref.dept}/${ref.name}/${width}`;
}

/**
 * The instant placeholder: the museum's ~600px derivative, linked directly.
 *
 * This is the replacement for the Art Institute's `lqip` blur-up, and a better
 * one — a real small image rather than a blurred data URI. It is hotlinked
 * rather than proxied on purpose: it should appear as fast as possible, it costs
 * us no bandwidth, and it is only ever rendered as a plain decorative `<img>`
 * with no `crossOrigin`, so the CORS objection above does not apply to it.
 */
export function metPreviewUrl(ref: MetImageRef): string {
  return metUpstreamImageUrl(ref, "web-large");
}

/**
 * The same picture at a different width, when it is one of ours to resize.
 *
 * The trail map draws its nodes at 56px. Serving those from the 843px card image
 * costs about 116 KB each for something rendered smaller than a postage stamp,
 * and a trail map is a dozen of them at once. Rewriting the width segment is
 * safe because we built the URL in the first place; anything else (a Wikipedia
 * thumbnail, an old Art Institute URL) is returned untouched.
 */
export function artImageAtWidth(
  url: string | undefined,
  width: MetImageWidth,
): string | undefined {
  if (!url) return undefined;
  const m = url.match(/^\/api\/img\/met\/([^/]+)\/([^/]+)\/\d+$/);
  return m ? `/api/img/met/${m[1]}/${m[2]}/${width}` : url;
}

/** The public object page. */
export function metPageUrl(id: number | string): string {
  return `https://www.metmuseum.org/art/collection/search/${id}`;
}

/** The fields Drift reads off an object. The Met has no field-selection
 *  parameter, so this is documentation of what we depend on rather than a query
 *  argument. */
export interface MetObject {
  objectID: number;
  title?: string;
  /** Artist(s) as one display string. Blank for an unattributed work. */
  artistDisplayName?: string;
  /** "Dutch, Zundert 1853-1890 Auvers-sur-Oise" — the museum's own biography line. */
  artistDisplayBio?: string;
  /** Death year(s). A STRING, and pipe-delimited when a work has several hands
   *  ("1757|1830"), which is why the EU public-domain test splits it. This is
   *  the field that makes the Met cheaper to filter than the Art Institute was:
   *  no separate per-artist lookup is needed. */
  artistEndDate?: string;
  artistBeginDate?: string;
  /** Every attributed name with its role (Artist, Publisher, Printer, …). */
  constituents?: { name?: string; role?: string }[] | null;
  objectDate?: string;
  objectBeginDate?: number;
  objectEndDate?: number;
  medium?: string;
  dimensions?: string;
  creditLine?: string;
  department?: string;
  classification?: string;
  objectName?: string;
  culture?: string;
  period?: string;
  country?: string;
  region?: string;
  city?: string;
  isPublicDomain?: boolean;
  isHighlight?: boolean;
  /** The ~4000px original. Empty string when the museum holds an image it may
   *  not release, which is how an in-copyright work presents. */
  primaryImage?: string;
  primaryImageSmall?: string;
  /** Subject keywords — the Met's nearest equivalent to AIC's `subject_titles`,
   *  and what the "The subject" thread facet is built from. */
  tags?: { term?: string; AAT_URL?: string; Wikidata_URL?: string }[] | null;
  objectURL?: string;
  /** Present on many records. Not used yet: it is the obvious foundation for a
   *  far better cross-realm doorway than the Art Institute's relevance-score
   *  heuristic ever was, because it names the Wikipedia subject outright
   *  (Phase B). */
  objectWikidata_URL?: string;
  artistWikidata_URL?: string;
}

/**
 * The artist's Wikidata id, if the museum recorded one.
 *
 * This is the ONLY honest route to prose on an art card. The Met publishes no
 * description of its own, and `objectWikidata_URL` — the obvious candidate —
 * resolves to an actual Wikipedia article essentially never (0 of 68 in a
 * measured sample; those Q-ids are catalogue stubs). The ARTIST link does
 * resolve, for about a third of usable works.
 *
 * A Wikidata id is used rather than the artist's name on purpose: an id is an
 * exact identity, where a name lookup can land on a different person, and a
 * biography of the wrong artist under a painting is precisely the quiet
 * dishonesty §2 rules out.
 */
export function metArtistQid(a: MetObject): string | undefined {
  const m = (a.artistWikidata_URL ?? "").match(
    /^https:\/\/www\.wikidata\.org\/wiki\/(Q\d{1,12})$/,
  );
  return m ? m[1] : undefined;
}

/** Usable as a card? public domain + has an image + a title. */
export function isUsableArtwork(a: MetObject | null | undefined): a is MetObject {
  return (
    !!a &&
    !!a.isPublicDomain &&
    !!(a.primaryImage && a.primaryImage.trim()) &&
    !!(a.title && a.title.trim())
  );
}

/** The place a work comes from, in the museum's order of specificity. */
function artPlace(a: MetObject): string {
  return [a.culture, a.country, a.region, a.city]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)[0] ?? "";
}

/**
 * The card's hook line.
 *
 * NOTE, because it is a real difference from the Art Institute: the Met's API
 * publishes NO descriptive prose — there is no blurb, wall text or catalogue
 * essay field on an object, only structured catalogue data. So this is the
 * catalogue line, which is exactly what an AIC card already fell back to when a
 * work had no `short_description`. Writing a hook ourselves is not an option:
 * principle 5 says AI may reshape vetted content, never invent facts about it.
 */
function artExtract(a: MetObject): string {
  return [a.medium, artPlace(a)]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

function artDescription(a: MetObject): string | undefined {
  const d = [a.artistDisplayName, a.objectDate]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" · ");
  return d || undefined;
}

/**
 * Wrap a free-text search term so The Met matches it as a PHRASE.
 *
 * ⚠️ THEIR SEARCH IS A LOOSE OR OVER WORDS, AND THAT COST US MORE THAN ANYTHING
 * ELSE IN THE APP. The cross-realm doorway searches the museum for the current
 * article's title, and `passesReverseGate` (lib/crossrealm.ts) then requires that
 * title to appear as a SUBSTRING of the artwork's title or one of its subject
 * tags. An OR search cannot answer that question. Measured:
 *
 *   q=Powers of the president of the United States    ->  55,804 results
 *   q="Powers of the president of the United States"  ->        0 results
 *
 * Every one of those 55,804 was going to fail the gate, and we were paying five
 * record fetches per card to discover that. Quoting asks the question the gate is
 * actually asking. A single word is unaffected (`House` returns 21,105 either
 * way), so nothing that used to match stops matching.
 *
 * `*` is returned untouched: the place facet searches `{ geoLocation, q: "*" }`
 * and the wildcard is doing the work there — quoting it would ask for artworks
 * literally titled "*".
 */
export function phraseQuery(term: string | null | undefined): string {
  const cleaned = (term ?? "").replace(/"/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === "*") return cleaned;
  return `"${cleaned}"`;
}

/** The subject keywords, cleaned and de-duplicated, keeping the museum's own
 *  order — that is the order a cataloguer chose, and the first tag is what the
 *  "The subject" thread is built from. */
export function artSubjects(a: MetObject): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  for (const t of a.tags ?? []) {
    const term = (t?.term ?? "").trim();
    if (term && !used.has(term.toLowerCase())) {
      used.add(term.toLowerCase());
      out.push(term);
    }
  }
  return out;
}

/**
 * The "museum label": structured metadata rows for an artwork, in reading order,
 * skipping anything missing. Pure so it's unit-testable; surfaced on the card as
 * a calm, progressively-disclosed "Details" block. Row order is carried over
 * from the Art Institute's label unchanged, so the card reads the same.
 */
export function artFacts(a: MetObject): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value?: string | null) => {
    const v = (value ?? "").trim();
    if (v) rows.push({ label, value: v });
  };
  push("Medium", a.medium);
  push("Dimensions", a.dimensions);
  push("Classification", a.classification || a.objectName);
  push("Department", a.department);
  push("Origin", artPlace(a));
  push("Period", a.period);
  const subjects = artSubjects(a);
  if (subjects.length) push("Subjects", subjects.join(", "));
  push("Credit", a.creditLine);
  return rows;
}

/**
 * Alt text, composed from the catalogue.
 *
 * The Art Institute shipped human-written `alt_text`; the Met ships none, and
 * falling back to the bare title would leave a screen-reader user with "Untitled"
 * or a name and nothing else. So we build a description out of the museum's own
 * fields — title, medium, artist, date — and invent nothing. Every clause is
 * something the museum recorded.
 */
export function metImageAlt(a: MetObject): string {
  const title = (a.title ?? "").trim() || "Untitled";
  const medium = (a.medium ?? "").trim().toLowerCase();
  const artist = (a.artistDisplayName ?? "").trim();
  const date = (a.objectDate ?? "").trim();
  let s = title;
  if (medium) s += `, ${medium}`;
  if (artist) s += ` by ${artist}`;
  if (date) s += `, ${date}`;
  return s;
}

/**
 * Normalise an object into the source-agnostic EU public-domain question.
 *
 * `attributed` follows the NAME field rather than the date field, because a work
 * can name an artist whose dates the museum never recorded — and that must not
 * be mistaken for an anonymous work, which gets a more generous date fallback.
 * `constituents` is not used for the count: its non-authorial roles (Publisher,
 * Printer) do not hold the authorship term, and the pipe-delimited date fields
 * already carry one entry per attributed hand.
 */
export function metPdInput(a: MetObject): PdInput {
  const attributed = !!(a.artistDisplayName ?? "").trim();
  const deathYears = splitDeathYears(a.artistEndDate);
  // A named artist with no parseable date at all still counts as one unresolved
  // hand, so the "unknown hand does not clear" rule bites instead of the work
  // silently falling through to the anonymous fallback as if nobody made it.
  const hands = attributed && deathYears.length === 0 ? [null] : deathYears;
  return {
    deathYears: hands,
    attributed,
    finishedYear: a.objectEndDate ?? a.objectBeginDate,
  };
}

/** The rich fields (museum label / zoom / preview / alt) an artwork carries,
 *  shared by cards AND candidates so a pulled thread lands on a full art card. */
function metRichFields(a: MetObject) {
  const facts = artFacts(a);
  const ref = parseMetImage(a.primaryImage);
  return {
    ...(facts.length ? { facts } : {}),
    ...(ref ? { zoomUrl: metImageUrl(ref, 1686) } : {}),
    ...(ref ? { previewUrl: metPreviewUrl(ref) } : {}),
    imageAlt: metImageAlt(a),
  };
}

export function metToCard(a: MetObject): Card {
  const ref = parseMetImage(a.primaryImage);
  return {
    pageTitle: String(a.objectID),
    displayTitle: (a.title ?? "").trim() || "Untitled",
    description: artDescription(a),
    extract: artExtract(a),
    imageUrl: ref ? metImageUrl(ref) : undefined,
    sourceUrl: metPageUrl(a.objectID),
    source: "met",
    ...metRichFields(a),
  };
}

/** A faceted related candidate. `eyebrow` is the short facet word shown above
 *  the label on the chip ("MORE BY", "THE SUBJECT", …); `threadLabel` is the
 *  destination (the artist / subject / place / department). */
export function metToCandidate(
  a: MetObject,
  threadLabel: string,
  facet: string,
  eyebrow?: string,
): RelatedCandidate {
  const ref = parseMetImage(a.primaryImage);
  return {
    pageTitle: String(a.objectID),
    displayTitle: (a.title ?? "").trim() || "Untitled",
    description: artDescription(a),
    extract: artExtract(a),
    imageUrl: ref ? metImageUrl(ref) : undefined,
    source: "met",
    sourceUrl: metPageUrl(a.objectID),
    threadLabel,
    facet,
    ...(eyebrow ? { eyebrow } : {}),
    ...metRichFields(a),
  };
}
