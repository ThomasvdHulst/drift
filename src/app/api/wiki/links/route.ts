import { NextResponse } from "next/server";
import { wikiQuery } from "@/lib/wiki-server";
import { cacheHeaders, CACHE_STABLE, NO_STORE } from "@/lib/cache-headers";

// GET /api/wiki/links?titles=A|B|C → { links: { "A": [...], "B": [...] } }
//
// The outgoing article links of a handful of pages, for the exit screen's "one
// page several of your stops point at that you never opened" (Phase 28,
// lib/common.ts). Namespace 0 only, so no citation templates, no categories, no
// files.
//
// ONE call covers every title (the Action API takes up to 50), and `pllimit=max`
// returns 500 links per request across the whole result — a four-stop trail of
// long articles needs a few continuations, which is why this is called ONCE at
// the exit and never during a drift.
//
// Graceful like everything else: any failure returns `{ links: {} }` with a 200,
// and the caller simply renders nothing. There is no state in which the absence
// of this answer can break a trail.

/** Titles per request. The Action API's own cap for an unauthenticated client. */
const MAX_TITLES = 10;
/** Continuation pages. Four long articles come to roughly 3-6 rounds; beyond
 *  that we would be spending the shared Wikimedia budget on a garnish. */
const MAX_ROUNDS = 6;

interface LinksPage {
  title?: string;
  links?: { title?: string }[];
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("titles") ?? "";
  const titles = raw
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TITLES);
  if (titles.length === 0) {
    return NextResponse.json(
      { error: "missing titles" },
      { status: 400, headers: NO_STORE },
    );
  }

  const links: Record<string, string[]> = {};
  try {
    let cont: Record<string, string> = {};
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const data = (await wikiQuery({
        titles: titles.join("|"),
        redirects: "1",
        prop: "links",
        plnamespace: "0",
        pllimit: "max",
        format: "json",
        formatversion: "2",
        ...cont,
      })) as {
        query?: { pages?: LinksPage[] };
        continue?: Record<string, string>;
      };
      for (const page of data?.query?.pages ?? []) {
        if (!page.title) continue;
        const list = (links[page.title] ??= []);
        for (const l of page.links ?? []) if (l.title) list.push(l.title);
      }
      if (!data?.continue) break;
      cont = data.continue;
    }
  } catch (err) {
    console.error("[api/wiki/links]", err);
    return NextResponse.json({ links: {} }, { status: 200, headers: NO_STORE });
  }

  return NextResponse.json(
    { links },
    { headers: cacheHeaders(CACHE_STABLE, request) },
  );
}
