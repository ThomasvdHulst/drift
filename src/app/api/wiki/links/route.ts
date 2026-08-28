import { NextResponse } from "next/server";
import { wikiQuery } from "@/lib/wiki-server";
import { isValidWikiTitle } from "@/lib/wiki";
import { cacheHeaders, CACHE_STABLE, NO_STORE } from "@/lib/cache-headers";
import { clientIpFromHeaders } from "@/lib/contact";
import { linksLimiter } from "@/lib/ratelimit";

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

/** Titles per request. The Action API's own cap for an unauthenticated client.
 *  The real caller sends 3 to 8 (`stopsToProbe`, lib/common.ts). */
const MAX_TITLES = 10;
/** Continuation pages. Four long articles come to roughly 3-6 rounds; beyond
 *  that we would be spending the shared Wikimedia budget on a garnish. */
const MAX_ROUNDS = 6;

/**
 * How many continuation rounds THIS request has earned.
 *
 * ⚠️ EVERY ROUND IS A WIKIMEDIA REQUEST, so a fixed six made this the app's
 * biggest amplifier: measured 27 August 2026, three calls cost eighteen upstream
 * requests, against the ~200/min bucket every reader on the site shares through
 * Vercel's egress IP (docs/beta-readiness.md). `titles` is free text, so varying
 * it defeats the edge cache and every request is a miss.
 *
 * `pllimit=max` returns 500 links across the WHOLE result, so the number of
 * rounds a genuine answer needs scales with how many titles were asked for. One
 * title has never needed six. Charging by what was actually requested takes the
 * cheapest abusive request (a single junk title) from six upstream calls to two,
 * while the real caller's eight titles still get five.
 *
 * This is a cost cap, not the limit: `linksLimiter` below is what bounds a loop.
 */
function roundsFor(titles: number): number {
  return Math.min(MAX_ROUNDS, Math.max(2, Math.ceil(titles / 2) + 1));
}

interface LinksPage {
  title?: string;
  links?: { title?: string }[];
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("titles") ?? "";
  const titles = raw
    .split("|")
    .map((t) => t.trim())
    // Splitting on `|` already handles the separator, so what is left to refuse
    // is a title that could never name a page: over-long, or carrying one of the
    // characters MediaWiki forbids. Every one of those is a guaranteed miss
    // charged to a rate budget every reader shares.
    .filter(isValidWikiTitle)
    .slice(0, MAX_TITLES);
  if (titles.length === 0) {
    return NextResponse.json(
      { error: "missing titles" },
      { status: 400, headers: NO_STORE },
    );
  }

  // One request here becomes several upstream, so this is one of the two routes
  // that carries a per-caller bucket (see lib/ratelimit.ts for why it is not on
  // every route). The real caller fires once when a trail exit opens, so a
  // reader never approaches this; a loop meets it within a second.
  const gate = linksLimiter.take(clientIpFromHeaders((n) => request.headers.get(n)));
  if (!gate.ok) {
    return NextResponse.json(
      { links: {} },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(gate.retryAfterSec) },
      },
    );
  }

  const links: Record<string, string[]> = {};
  const rounds = roundsFor(titles.length);
  try {
    let cont: Record<string, string> = {};
    for (let round = 0; round < rounds; round++) {
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
