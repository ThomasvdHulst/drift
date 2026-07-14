import { NextResponse } from "next/server";
import { wikiQuery, CARD_PROPS } from "@/lib/wiki-server";
import { selectCardBatch, type ActionPage } from "@/lib/wiki";
import { topicByKeyword } from "@/lib/topics";

export const dynamic = "force-dynamic";

// GET /api/wiki/discover?topic=<slug>&offset=<n>&limit=<n> → a batch of
// popular, on-topic, non-junk Cards for the "interesting random" drift buffer.
//
// This is the heart of M8/M9: CirrusSearch's `articletopic:<slug>` keyword
// (ORES topic model) sorted by `incoming_links_desc` floors results on
// well-known pages, and a bounded random `offset` keeps them varied — so a
// "random" drift lands on Nebula/Parsec, not an obscure stub. Unlike
// `generator=random`, the search endpoint isn't burst rate-limited. One request
// returns extract + thumbnail + description (via CARD_PROPS), like the related route.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const topic = url.searchParams.get("topic") ?? "";

  // Allowlist the topic against the registry — never interpolate arbitrary user
  // input into `gsrsearch` (injection guard).
  if (!topicByKeyword(topic)) {
    return NextResponse.json({ error: "unknown topic" }, { status: 400 });
  }

  const offsetNum = Number(url.searchParams.get("offset"));
  const offset =
    Number.isFinite(offsetNum) && offsetNum >= 0 ? Math.min(offsetNum, 1000) : 0;
  const limitNum = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 20) : 20;

  try {
    const raw = await wikiQuery({
      generator: "search",
      gsrsearch: `articletopic:${topic}`,
      gsrsort: "incoming_links_desc",
      gsroffset: String(offset),
      gsrnamespace: "0",
      gsrlimit: String(limit),
      ...CARD_PROPS,
    });
    const pages =
      (raw as { query?: { pages?: ActionPage[] } })?.query?.pages ?? [];
    return NextResponse.json(selectCardBatch(pages));
  } catch (err) {
    console.error("[api/wiki/discover]", err);
    // Graceful: empty batch, not an error — the feed falls back to random/thread.
    return NextResponse.json([], { status: 200 });
  }
}
