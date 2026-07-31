// ---------------------------------------------------------------------------
// Same-origin passthrough for Art Institute IIIF images.
//
// WHY. The museum's image host sits behind Cloudflare bot management, and its
// rules reject a request that LOOKS like a browser but carries no `Referer`, or
// one whose `Referer` is a localhost origin. A browser fetching an artwork from
// a page on `http://localhost:3000` sends exactly that, so every Gallery card
// came back 403 (an HTML challenge page, which the browser then discards as
// `ERR_BLOCKED_BY_ORB`) and the card fell through to its monogram. The live
// origin is allowed, so this only ever bit local development — but it bit all of
// it, and "the Gallery has no pictures" is not a good way to develop the Gallery.
//
// A server request identifying itself honestly (`Drift/1.0 (url; email)`, the
// same UA the JSON API gets) is allowed with no `Referer` at all, so this route
// is a plain passthrough: no header spoofing, no pretending to be a browser.
//
// Licensing: every artwork Drift shows is CC0-designated, checked per response
// against the museum's own `info.license_text` (see realms/server/artic.ts), and
// AIC's terms permit CC0 material to be used "for any purpose ... without
// additional permission". So serving the bytes from our own origin rather than
// linking to theirs raises no attribution question. It does move image bytes
// onto our bandwidth, which is why it is a switch and not a default — see
// `articImageProxied` in lib/realms/artic.ts.
//
// Carries no user data and never reads the session, so the shared-CDN caching
// below is safe (compliance audit M-10).
// ---------------------------------------------------------------------------

import { articUpstreamImageUrl } from "@/lib/realms/artic";

export const dynamic = "force-dynamic";

/** AIC image ids are UUIDs. Anchored, so this can never be pointed at another
 *  host: the upstream URL is BUILT from the id, never taken from the caller. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The widest IIIF derivative Drift asks for is the 1686px zoom. */
const MAX_WIDTH = 1686;

const UA =
  process.env.ARTIC_USER_AGENT ||
  "Drift/1.0 (https://www.usedrift.org; thomasvdhulst03@gmail.com)";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; width: string }> },
) {
  const { id, width } = await ctx.params;
  const w = Number(width);
  if (!ID.test(id) || !Number.isInteger(w) || w < 16 || w > MAX_WIDTH) {
    return new Response("bad image request", { status: 400 });
  }

  try {
    const upstream = await fetch(articUpstreamImageUrl(id, w)!, {
      headers: { "User-Agent": UA, "AIC-User-Agent": UA },
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok || !upstream.body) {
      return new Response("image unavailable", { status: 502 });
    }
    // Stream it through rather than buffering: an 1686px derivative is ~1 MB and
    // holding it in the function's memory buys nothing.
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        // The museum's own 30 days. A IIIF derivative for a given id + width is
        // immutable, so a long shared cache is both safe and the whole point:
        // the second reader to see a work costs no upstream request.
        "Cache-Control":
          "public, max-age=2592000, s-maxage=2592000, immutable",
      },
    });
  } catch (err) {
    console.error("[api/img/artic]", err);
    return new Response("image unavailable", { status: 502 });
  }
}
