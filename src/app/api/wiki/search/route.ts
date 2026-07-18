import { NextResponse } from "next/server";
import { wikiQuery } from "@/lib/wiki-server";
import { normalizeSearchResults } from "@/lib/wiki";

export const dynamic = "force-dynamic";

// GET /api/wiki/search?q=<query> → up to ~8 page suggestions for the "drift
// around a page" search bar (Phase 18, Encyclopedia). Uses the Action API
// `prefixsearch` generator (fast title autocomplete) + description + thumbnail in
// one call; disambiguation + list/index pages are filtered out. Graceful: a short
// query or any upstream failure returns [] (HTTP 200) so the bar never errors.
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);
  try {
    const raw = await wikiQuery({
      generator: "prefixsearch",
      gpssearch: q,
      gpslimit: "8",
      gpsnamespace: "0",
      prop: "description|pageimages|pageprops",
      ppprop: "disambiguation",
      piprop: "thumbnail",
      pithumbsize: "120",
      format: "json",
      formatversion: "2",
    });
    return NextResponse.json(normalizeSearchResults(raw));
  } catch (err) {
    console.error("[api/wiki/search]", err);
    return NextResponse.json([], { status: 200 });
  }
}
