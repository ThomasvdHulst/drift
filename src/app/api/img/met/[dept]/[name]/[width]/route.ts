// ---------------------------------------------------------------------------
// Same-origin, resized passthrough for Metropolitan Museum artwork images.
//
// WHY THIS IS NOT OPTIONAL. The Art Institute route this replaces was a
// development convenience with a flag to turn it off. This one is load-bearing:
// the museum publishes exactly four derivatives and does no resizing. Its
// largest "small" one is about 600px, which is soft on a card that occupies
// ~750 CSS px on a desktop, and the only thing above it is a ~4000px original of
// several megabytes. Neither is a card image, so the three widths Drift renders
// (843 card / 1686 zoom / 160 trail thumbnail) have to be made somewhere, and
// this is where. That reason stands by itself, which is why there is no flag.
//
// ⚠️ THERE WAS A SECOND REASON HERE AND IT HAS EXPIRED. It said
// `images.metmuseum.org` sends no `Access-Control-Allow-Origin` at all, so the
// trail map's `crossOrigin="anonymous"` nodes could not use a hotlinked artwork.
// Re-measured 27 August 2026, four ways (`web-large` and `original`, with and
// without an `Origin` header): it now returns `access-control-allow-origin: *`
// every time. The old measurement was correct when taken; it is simply no longer
// true, so do not repeat the CORS argument. Nothing about this route changes.
// (The exported PNG drops images by design either way — lib/export-image.ts,
// audit B-5 — so the proxy was never about the export.)
//
// Licensing: every artwork Drift shows is CC0 under the museum's Open Access
// policy, which grants use "for any purpose, including commercial and
// noncommercial use, free of charge and without requiring permission", and is
// additionally filtered to works out of copyright in the EU (see
// lib/realms/publicdomain.ts). So serving the bytes from our own origin rather
// than linking to theirs raises no attribution question.
//
// Carries no user data and never reads the session, so the shared-CDN caching
// below is safe (compliance audit M-10).
// ---------------------------------------------------------------------------

import sharp from "sharp";
import {
  MET_DEPT_RE,
  MET_NAME_RE,
  metUpstreamImageUrl,
  parseMetImageWidth,
  type MetImageSize,
} from "@/lib/realms/met";
import { makeGate, makeBreaker } from "@/lib/upstream";

export const dynamic = "force-dynamic";

/**
 * The image host is SLOW, and this route has to survive that.
 *
 * Measured 26 August, on one host at one moment: `web-large` returned 120 KB in
 * 0.31s while `original` delivered 43 KB in twelve seconds and never finished.
 * The originals are several megabytes and the museum evidently deprioritises
 * them. Before this, every such request hung for the full 20s and then 502'd —
 * and since no `maxDuration` was set anywhere, Vercel's default (10s Hobby, 15s
 * Pro) killed the function before our own timeout could even produce that.
 *
 * So the budget is stated explicitly and the timeouts are made to fit INSIDE it,
 * worst case: 10s for the original, then 5s for the fallback, then the resize.
 */
export const maxDuration = 25;

/* ⚠️ WIDTH IS AN ALLOWLIST, NOT A RANGE, AND THAT IS A COST CONTROL.
 *
 * This used to accept any integer from 16 to 1686. Every distinct width is its
 * own CDN cache key and its own origin fetch, and above `SMALL_SOURCE_MAX` each
 * one drags a multi-megabyte original out of a host that is already slow, runs a
 * resize, and pins a 30-day `immutable` entry. That made ~1,286 expensive
 * variants per artwork reachable by anyone, on a route with no auth in front of
 * it: measured live, widths 701/703/707 each answered `x-vercel-cache: MISS`
 * with its own upstream fetch. The museum grants ~80 requests per 30 seconds and
 * shrinks that budget for a day when it is tripped repeatedly, so a for-loop
 * here is a Gallery outage for every reader plus a bill.
 *
 * The list lives in `lib/realms/met.ts` beside the functions that BUILD these
 * URLs, so the validator cannot drift from what the app generates — and
 * `MetImageWidth` makes an unlisted width a type error at the call site rather
 * than a 400 at runtime.
 *
 * The width segment must also be spelled CANONICALLY. `Number()` happily reads
 * "0843", "843.0", "+843" and "8.43e2" as 843, and each spelling is a DIFFERENT
 * CDN cache key for an identical image — a smaller version of the same
 * multiplication this allowlist exists to stop. Comparing `String(w)` back to
 * the raw segment leaves exactly one legal spelling per width.
 */

/**
 * At or below this width, go straight to `web-large` and never touch the
 * original.
 *
 * The trail map draws its nodes at 56px and asks this route for 160
 * (`artImageAtWidth`, TrailMap.tsx:62) — and that was fetching a ~3.4 MB
 * original to produce a 160px thumbnail, once per width, for every artwork on
 * the map. A dozen artworks was a dozen multi-megabyte downloads for something
 * rendered smaller than a postage stamp. `web-large` is around 500-600px on its
 * long edge, which is far more than a thumbnail needs, and it arrives in a
 * third of a second.
 *
 * 400 rather than 500: `web-large`'s exact width varies with aspect ratio, and
 * `withoutEnlargement` means a portrait one simply yields a slightly smaller
 * thumbnail rather than a blurred one.
 */
const SMALL_SOURCE_MAX = 400;

/** Fetch budgets, sized to fit inside `maxDuration` even if both are spent. */
const ORIGINAL_TIMEOUT_MS = 10_000;
const FALLBACK_TIMEOUT_MS = 5_000;

/**
 * The image host gets its OWN gate and breaker, separate from the API's.
 *
 * It is a different host with a different failure mode: the API refuses with
 * 403, this one simply stops delivering bytes. So a timeout counts as a failure
 * here, where on the API host it would not.
 *
 * This route had neither, which is how the load rehearsal's browser bots pulled
 * originals with no spacing whatsoever — a plausible reason the host was so
 * unhappy afterwards. 120ms is about eight requests a second, which is a page of
 * thumbnails at a civil pace.
 */
const imageGate = makeGate(120);
const imageBreaker = makeBreaker({ threshold: 4, cooldownMs: 30_000 });

const UA =
  process.env.MET_USER_AGENT ||
  "Drift/1.0 (https://www.usedrift.org; thomasvdhulst03@gmail.com)";

/** One derivative, through the gate and the breaker. Throws on any failure. */
async function fetchDerivative(
  ref: { dept: string; name: string },
  size: MetImageSize,
  timeoutMs: number,
): Promise<Buffer> {
  const url = metUpstreamImageUrl(ref, size);
  imageBreaker.guard(url);
  await imageGate.next((ms) => new Promise((r) => setTimeout(r, ms)));
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // A timeout is the failure that actually happens here, so unlike the API
    // host's breaker this one counts slowness, not just refusals.
    imageBreaker.record(!res.ok);
    if (!res.ok) throw new Error(`image ${size} responded ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    imageBreaker.record(true);
    throw err;
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ dept: string; name: string; width: string }> },
) {
  const { dept, name, width } = await ctx.params;
  // Allowlisted AND canonically spelled — see the note above and the tests
  // beside `parseMetImageWidth`.
  const w = parseMetImageWidth(width);
  // Anchored patterns on both path components, and the upstream URL is BUILT
  // from them rather than taken from the caller — so this can never be pointed
  // at another host, and a traversal attempt cannot survive the match.
  if (!MET_DEPT_RE.test(dept) || !MET_NAME_RE.test(name) || w === null) {
    return new Response("bad image request", { status: 400 });
  }

  const ref = { dept, name };
  // A thumbnail never justifies a multi-megabyte original (see SMALL_SOURCE_MAX).
  const small = w <= SMALL_SOURCE_MAX;

  let source: Buffer | null = null;
  let degraded = false;

  if (!small) {
    try {
      source = await fetchDerivative(ref, "original", ORIGINAL_TIMEOUT_MS);
    } catch (err) {
      // Not fatal any more. A soft picture is worth more to a reader than a
      // broken one, and this is the difference between a Gallery card that looks
      // finished and one that looks abandoned (§4: degrade, never break).
      console.warn("[api/img/met] original unavailable, falling back", err);
    }
  }

  if (!source) {
    degraded = !small; // asking for web-large at thumbnail size is not a downgrade
    try {
      source = await fetchDerivative(ref, "web-large", FALLBACK_TIMEOUT_MS);
    } catch (err) {
      console.error("[api/img/met]", err);
      return new Response("image unavailable", {
        status: 502,
        // Never cache a failure: the next reader should get a real attempt.
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  try {
    // Resize, never enlarge: asking for 1686 from a work whose original is
    // smaller should return the original rather than an upscaled blur. That
    // matters more now — a degraded response is ~500px being asked for 843.
    const out = await sharp(source)
      .rotate() // honour EXIF orientation before resizing
      .resize({ width: w, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    return new Response(new Uint8Array(out), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(out.byteLength),
        // A given artwork at a given width never changes, so a long shared cache
        // is both safe and the whole point: the museum is asked for an original
        // once, the resize happens once, and every reader after that is served
        // from the CDN. This is what keeps the bandwidth cost of proxying small.
        //
        // ⚠️ EXCEPT when this is the soft fallback. Freezing a degraded picture
        // into the CDN for thirty days would turn one slow minute at the museum
        // into a month of blurred cards, and `immutable` means no reader would
        // ever revalidate it. Ten minutes lets it heal itself.
        "Cache-Control": degraded
          ? "public, max-age=0, s-maxage=600, stale-while-revalidate=3600"
          : "public, max-age=2592000, s-maxage=2592000, immutable",
      },
    });
  } catch (err) {
    console.error("[api/img/met] resize failed", err);
    return new Response("image unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
