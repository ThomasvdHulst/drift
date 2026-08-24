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
} from "@/lib/realms/met";

export const dynamic = "force-dynamic";

/** The widest derivative Drift asks for is the zoom. */
const MAX_WIDTH = 1686;
const MIN_WIDTH = 16;

const UA =
  process.env.MET_USER_AGENT ||
  "Drift/1.0 (https://www.usedrift.org; thomasvdhulst03@gmail.com)";

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

  try {
    const upstream = await fetch(metUpstreamImageUrl({ dept, name }, "original"), {
      headers: { "User-Agent": UA },
      // The originals are large; a card should not wait forever for one, but the
      // budget has to be generous enough that a first view actually succeeds.
      signal: AbortSignal.timeout(20000),
    });
    if (!upstream.ok) {
      return new Response("image unavailable", { status: 502 });
    }

    // Resize, never enlarge: asking for 1686 from a work whose original is
    // smaller should return the original rather than an upscaled blur.
    const source = Buffer.from(await upstream.arrayBuffer());
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
        "Cache-Control": "public, max-age=2592000, s-maxage=2592000, immutable",
      },
    });
  } catch (err) {
    console.error("[api/img/met]", err);
    return new Response("image unavailable", { status: 502 });
  }
}
