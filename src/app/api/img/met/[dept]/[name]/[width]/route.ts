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
  isMetImageHostFailure,
  metUpstreamImageUrl,
  parseMetImageWidth,
  type MetImageSize,
} from "@/lib/realms/met";
import { makeGate, makeBreaker } from "@/lib/upstream";
import { clientIpFromHeaders } from "@/lib/contact";
import { imageLimiter } from "@/lib/ratelimit";

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

/**
 * Why one derivative could not be fetched.
 *
 * ⚠️ THE STATUS IS CARRIED OUT OF HERE ON PURPOSE, because the caller has to
 * tell "there is no such picture" from "we could not look" — the same
 * distinction `searchIds({rethrow})` and `UpstreamError.status` exist for on the
 * API host (CLAUDE.md §4). A 404 from both derivatives is a settled answer about
 * a made-up name and may be cached; a timeout or a 5xx is the museum having a
 * bad minute and must not be.
 */
class DerivativeError extends Error {
  /** The HTTP status, or 0 when the fetch never produced one (timeout, reset). */
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "DerivativeError";
    this.status = status;
  }
}

/** One derivative, through the gate and the breaker. Throws on any failure. */
async function fetchDerivative(
  ref: { dept: string; name: string },
  size: MetImageSize,
  timeoutMs: number,
): Promise<Buffer> {
  const url = metUpstreamImageUrl(ref, size);
  imageBreaker.guard(url);
  await imageGate.next((ms) => new Promise((r) => setTimeout(r, ms)));

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // The request never came back. A timeout is the failure that actually
    // happens on this host, so unlike the API host's breaker this one counts
    // slowness, not just refusals. Status 0 says we learned nothing about
    // whether the picture exists.
    imageBreaker.record(true);
    throw new DerivativeError(String(err), 0);
  }

  // A 404 must not count against the breaker: four requests for made-up names
  // would otherwise open the circuit and take every Met image down for thirty
  // seconds, and the name is a free path segment with no auth in front of it.
  // `isMetImageHostFailure` carries that rule and the measurement behind it.
  //
  // ⚠️ WHY THE RESPONSE IS HANDLED OUTSIDE THE `try` ABOVE. It used to be one
  // block, so the throw below was caught by its own `catch`, which then called
  // `record(true)` a second time for the same response. On a 404 that was
  // harmless — `record(false)` resets the counter before the catch increments
  // it, so it could never accumulate, and the guarantee above always held. On a
  // GENUINE failure it was not: a 503 recorded twice, so `threshold: 4` behaved
  // like 2 and the circuit opened after two responses instead of four. Splitting
  // the fetch from the response makes each response count exactly once, which is
  // also what lets the status be carried out to the caller. Measured both ways
  // and pinned in route.test.ts.
  imageBreaker.record(isMetImageHostFailure(res.status));
  if (!res.ok) {
    throw new DerivativeError(`image ${size} responded ${res.status}`, res.status);
  }

  try {
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    // The body died mid-read: a real host failure, and not an answer about the
    // picture either.
    imageBreaker.record(true);
    throw new DerivativeError(String(err), 0);
  }
}

/** Did this attempt settle the question of whether the picture exists? */
function isSettledMiss(err: unknown): boolean {
  return err instanceof DerivativeError && err.status === 404;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ dept: string; name: string; width: string }> },
) {
  // ⚠️ ONE INBOUND REQUEST IS TWO OUTBOUND ONES when the picture is not there,
  // and `name` is free text within its allowlist, so unlimited distinct requests
  // are cheap to send and never hit the edge cache. Measured 27 August 2026:
  // five junk names cost ten requests to `images.metmuseum.org`, and forty of
  // them in flight took a REAL artwork from 0.32 s to 8.66 s, because they all
  // queue on the same `imageGate` a reader's card image uses. Hence a per-caller
  // bucket, sized around the trail map's burst (see lib/ratelimit.ts).
  const gate = imageLimiter.take(clientIpFromHeaders((n) => req.headers.get(n)));
  if (!gate.ok) {
    return new Response("too many image requests", {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(gate.retryAfterSec) },
    });
  }

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
      // Its outcome deliberately does NOT decide the cache below: `web-large` is
      // the fallback and therefore the last word on whether the name exists.
      console.warn("[api/img/met] original unavailable, falling back", err);
    }
  }

  if (!source) {
    degraded = !small; // asking for web-large at thumbnail size is not a downgrade
    try {
      source = await fetchDerivative(ref, "web-large", FALLBACK_TIMEOUT_MS);
    } catch (err) {
      // The deciding attempt. A 404 here means the museum has no picture under
      // this name, whatever the original did; anything else means we could not
      // find out.
      const settledMiss = isSettledMiss(err);
      console.error("[api/img/met]", err);

      // ⚠️ THIS USED TO BE A FLAT 502 WITH `no-store`, AND THAT COMBINATION IS
      // WHAT MADE THE ROUTE WORTH ATTACKING. Every request for a made-up name
      // cost two fetches to a host the museum already deprioritises, and nothing
      // ever got cheaper on repeat, so a shell loop was a Gallery outage for
      // every reader plus a bill. The old comment said "never cache a failure:
      // the next reader should get a real attempt", which is right about an
      // OUTAGE and wrong about a NAME THAT DOES NOT EXIST.
      //
      // So the two are now separated, the same way the API host separates them
      // (CLAUDE.md §4: a 404 is a settled answer, a 403 is not):
      //
      //   both derivatives 404  → the name is wrong, and will still be wrong
      //                            tomorrow. 404, cached an hour, so a loop
      //                            stops reaching the museum after one pass.
      //   anything else        → we could not look. 502, cached one minute:
      //                            long enough to blunt a hammer, short enough
      //                            that a real outage heals almost immediately.
      //
      // Neither is `immutable`, and neither is long, because an artwork can be
      // added to the museum's open-access set at any time.
      return settledMiss
        ? new Response("no such image", {
            status: 404,
            headers: {
              "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600",
            },
          })
        : new Response("image unavailable", {
            status: 502,
            headers: { "Cache-Control": "public, max-age=0, s-maxage=60" },
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
