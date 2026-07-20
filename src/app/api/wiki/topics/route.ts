import { NextResponse } from "next/server";
import { wikiQuery, wikiUserAgent } from "@/lib/wiki-server";
import { firstPage } from "@/lib/wiki";
import { topicByOresKey } from "@/lib/topics";
import { cacheHeaders, CACHE_STABLE, NO_STORE } from "@/lib/cache-headers";

// GET /api/wiki/topics?title=Octopus → { topics: TopicId[] } — the tracked
// article-topics the page scores above threshold. Used by the interest model
// (M9) when the user gives a card a thumbs up/down.
//
// Source: Wikimedia's public, no-auth Lift Wing "articletopic" model. Two hops:
// title → latest revid (Action API), then revid → topic probabilities (Lift
// Wing, a DIFFERENT host, so not subject to the en.wikipedia rate limit).
//
// This is an optional enhancement and MUST degrade gracefully like the Ollama
// layer: any failure (no revid, timeout, model down, malformed JSON) returns
// `{ topics: [] }` so a like still records and the app never breaks.
const LIFTWING =
  "https://api.wikimedia.org/service/lw/inference/v1/models/enwiki-articletopic:predict";
const THRESHOLD = 0.5;

export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get("title");
  if (!title) {
    return NextResponse.json(
      { error: "missing title" },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    const raw = await wikiQuery({
      titles: title,
      redirects: "1",
      prop: "revisions",
      rvprop: "ids",
      rvlimit: "1",
      format: "json",
      formatversion: "2",
    });
    const page = firstPage(raw) as
      | { missing?: boolean; revisions?: { revid?: number }[] }
      | null;
    const revid = page?.revisions?.[0]?.revid;
    if (!page || page.missing || !revid) {
      return NextResponse.json({ topics: [] }, { headers: NO_STORE });
    }

    const ua = wikiUserAgent();
    const res = await fetch(LIFTWING, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-User-Agent": ua,
        "User-Agent": ua,
      },
      body: JSON.stringify({ lang: "en", rev_id: revid }),
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ topics: [] }, { headers: NO_STORE });

    const data = await res.json();
    const prob = data?.enwiki?.scores?.[String(revid)]?.articletopic?.score
      ?.probability as Record<string, number> | undefined;
    if (!prob || typeof prob !== "object") {
      return NextResponse.json({ topics: [] }, { headers: NO_STORE });
    }

    const topics = [
      ...new Set(
        Object.entries(prob)
          .filter(([, p]) => typeof p === "number" && p > THRESHOLD)
          .map(([key]) => topicByOresKey(key)?.id)
          .filter((id): id is string => !!id),
      ),
    ];

    // A page's topic labels are very stable, so cache a real result. Never cache
    // an empty one (it's indistinguishable from a Lift Wing hiccup).
    return NextResponse.json(
      { topics },
      { headers: topics.length ? cacheHeaders(CACHE_STABLE) : NO_STORE },
    );
  } catch (err) {
    console.error("[api/wiki/topics]", err);
    return NextResponse.json({ topics: [] }, { headers: NO_STORE });
  }
}
