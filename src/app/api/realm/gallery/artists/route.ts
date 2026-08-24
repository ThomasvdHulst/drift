import { NextResponse } from "next/server";
import { metArtistSearch, metArtistProfile } from "@/lib/realms/server/met";
import { cacheHeaders, CACHE_MEDIUM, NO_STORE } from "@/lib/cache-headers";

// GET /api/realm/gallery/artists?q=<name>   → ranked artist suggestions
// GET /api/realm/gallery/artists?name=<name> → one artist's widening profile
//
// Gallery-only, because only the Gallery has artists.
//
// AN EMPTY LIST IS A MEANINGFUL ANSWER HERE, not a failure. An artist still in
// copyright in Europe is deliberately not offered, so a search for Picasso or
// Kahlo returns nothing at all rather than a suggestion that would resolve to an
// empty feed. The ranking gate in lib/realms/met.artist.ts does the same for a
// query that matches nobody: it would rather say nothing than return
// plausible-looking noise.
//
// Errors answer 200 with an empty/absent result on purpose: a search box that
// goes red because a museum hiccuped is worse than one that finds nothing.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name");

  if (name !== null) {
    // The profile is what lets a drift widen past the artist's own work.
    // Returning null at HTTP 200 is read by the feed as "cannot widen", which
    // still serves ring 0 rather than breaking the session.
    try {
      const profile = await metArtistProfile(name.slice(0, 120));
      return NextResponse.json(profile, {
        headers: profile ? cacheHeaders(CACHE_MEDIUM, request) : NO_STORE,
      });
    } catch (err) {
      console.error("[api/realm/gallery/artists] profile", err);
      return NextResponse.json(null, { status: 200, headers: NO_STORE });
    }
  }

  const q = (url.searchParams.get("q") ?? "").slice(0, 80);
  if (q.trim().length < 2) {
    return NextResponse.json([], { status: 200, headers: NO_STORE });
  }
  try {
    const matches = await metArtistSearch(q);
    return NextResponse.json(matches, {
      headers: matches.length ? cacheHeaders(CACHE_MEDIUM, request) : NO_STORE,
    });
  } catch (err) {
    console.error("[api/realm/gallery/artists] search", err);
    return NextResponse.json([], { status: 200, headers: NO_STORE });
  }
}
