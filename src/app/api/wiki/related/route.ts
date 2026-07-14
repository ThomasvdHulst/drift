import { NextResponse } from "next/server";
import { wikiQuery } from "@/lib/wiki-server";
import { relatedToCandidates } from "@/lib/wiki";

export const dynamic = "force-dynamic";

// GET /api/wiki/related?title=Octopus → up to ~20 related candidates.
//
// The REST /page/related/{title} endpoint is dead (403), so we use the Action
// API CirrusSearch `morelike:` generator — it returns related pages WITH
// thumbnail + description + intro extract in a single call. See CLAUDE.md §4.
export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get("title");
  if (!title) {
    return NextResponse.json({ error: "missing title" }, { status: 400 });
  }
  try {
    const raw = await wikiQuery({
      generator: "search",
      gsrsearch: `morelike:${title}`,
      gsrnamespace: "0",
      gsrlimit: "20",
      prop: "pageimages|description|extracts|pageprops",
      exintro: "1",
      explaintext: "1",
      exsentences: "2",
      piprop: "thumbnail",
      pithumbsize: "800",
      ppprop: "disambiguation",
      format: "json",
      formatversion: "2",
    });
    return NextResponse.json(relatedToCandidates(raw));
  } catch (err) {
    console.error("[api/wiki/related]", err);
    // Graceful: no threads rather than a hard error — the feed can still drift.
    return NextResponse.json([], { status: 200 });
  }
}
