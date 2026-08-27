// ---------------------------------------------------------------------------
// Same-origin, resized passthrough for Metropolitan Museum artwork images.
//
// WHY THIS IS NOT OPTIONAL. The Art Institute route this replaces was a
// development convenience with a flag to turn it off. This one is load-bearing,
// for two independent reasons:
//
//  1. SIZE. The museum publishes exactly four derivatives and no resizing. The
//     largest "small" one is about 600px, which is soft on a card that occupies
//     ~750 CSS px on a desktop, and the only thing above it is a ~4000px
//     original of several megabytes. Neither is a card image. Resizing here
//     gives back the arbitrary widths the Art Institute's IIIF server used to
//     provide (843 card / 1686 zoom / 160 trail thumbnail).
//
//  2. CORS. `images.metmuseum.org` sends no `Access-Control-Allow-Origin` at
//     all, and the trail map draws its nodes with `crossOrigin="anonymous"`.
//     Measured in a real browser: a hotlinked Met image carrying that attribute
//     FAILS to load (the same URL without it loads fine), so every artwork in
//     the trail map would fall back to a monogram. Serving from our own origin
//     makes the question moot. This is about the map on SCREEN; the exported PNG
//     omits images entirely by design (lib/export-image.ts, audit B-5).
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

/** The widest derivative Drift asks for is the zoom. */
const MAX_WIDTH = 1686;
const MIN_WIDTH = 16;

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
  const w = Number(width);
  // Anchored patterns on both path components, and the upstream URL is BUILT
  // from them rather than taken from the caller — so this can never be pointed
  // at another host, and a traversal attempt cannot survive the match.
  if (
    !MET_DEPT_RE.test(dept) ||
    !MET_NAME_RE.test(name) ||
    !Number.isInteger(w) ||
    w < MIN_WIDTH ||
    w > MAX_WIDTH
  ) {
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
