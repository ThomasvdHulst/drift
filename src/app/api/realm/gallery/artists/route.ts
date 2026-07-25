import { NextResponse } from "next/server";
import {
  articArtistProfile,
  articArtistSearch,
} from "@/lib/realms/server/artic";
import { cacheHeaders, CACHE_MEDIUM, NO_STORE } from "@/lib/cache-headers";

// GET /api/realm/gallery/artists?q=<name>
// → the artists the Art Institute actually holds public-domain work by, each
//   with a true count, for the homepage's "Or drift an artist" search.
//
// GET /api/realm/gallery/artists?id=<artistId>
// → that artist's profile: how many works, and the movement / period / medium a
//   drift widens into once their own work runs out. The feed asks for this on
//   entry so it knows which rings exist before it needs them.
//
// An empty array is a MEANINGFUL answer here, not just a failure mode: artists
// still in copyright (Picasso, Kahlo) have nothing in the public-domain set, and
// the ranking gate in lib/realms/artic.artist.ts deliberately returns nothing
// rather than the unrelated pottery a raw relevance search would surface. The
// client says so plainly (§2.1). Upstream failures also return [] (HTTP 200), so
// a wobbling API degrades to "no suggestions" instead of breaking the page.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  // Profile lookup. Digits only, since the id reaches a numeric term query.
  const id = params.get("id");
  if (id !== null) {
    if (!/^\d{1,9}$/.test(id)) {
      return NextResponse.json({ error: "bad id" }, { status: 400, headers: NO_STORE });
    }
    try {
      const profile = await articArtistProfile(id);
      return NextResponse.json(profile, {
        headers: profile ? cacheHeaders(CACHE_MEDIUM) : NO_STORE,
      });
    } catch (err) {
      console.error("[api/realm/gallery/artists] profile", err);
      // null, not an error status: the feed treats "no profile" as "cannot
      // widen" and still serves the artist's own work.
      return NextResponse.json(null, { status: 200, headers: NO_STORE });
    }
  }

  const q = (params.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json([], { headers: NO_STORE });
  }
  try {
    const artists = await articArtistSearch(q.slice(0, 80));
    return NextResponse.json(artists, {
      // Only cache a real answer: an empty result may be a transient upstream
      // hiccup, and caching that would freeze the search empty at the edge.
      headers: artists.length ? cacheHeaders(CACHE_MEDIUM) : NO_STORE,
    });
  } catch (err) {
    console.error("[api/realm/gallery/artists]", err);
    return NextResponse.json([], { status: 200, headers: NO_STORE });
  }
}
