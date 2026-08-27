import { NextResponse } from "next/server";
import { serverRealm } from "@/lib/realms/server";
import { cacheHeaders, CACHE_STABLE, NO_STORE } from "@/lib/cache-headers";

// GET /api/realm/[realm]/related?id=<native id> → up to ~20 related candidates
// for the current card. The client selects the diverse 3 and filters seen.
// Graceful: no threads (empty array) rather than a hard error — the feed can
// still drift.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ realm: string }> },
) {
  const { realm } = await params;
  const r = serverRealm(realm);
  if (!r)
    return NextResponse.json(
      { error: "unknown realm" },
      { status: 400, headers: NO_STORE },
    );

  const id = new URL(request.url).searchParams.get("id");
  if (!id)
    return NextResponse.json(
      { error: "missing id" },
      { status: 400, headers: NO_STORE },
    );

  try {
    const candidates = await r.related(id);
    // ⚠️ ONLY EVER CACHE A REAL ANSWER, exactly as discover does.
    //
    // This used to send `s-maxage=86400` whatever came back, so a card whose
    // threads were empty because the upstream was throttling — or because the
    // Met breaker was open and the adapter deliberately made no request at all —
    // had "this card has no threads" frozen into the CDN for a DAY, for every
    // reader. A card with no threads is the one thing the feed cannot recover
    // from gracefully, and nothing in the app would ever have re-asked.
    //
    // A genuinely thread-less card costs one repeated lookup. That is the right
    // side to be wrong on.
    return NextResponse.json(candidates, {
      headers: candidates.length ? cacheHeaders(CACHE_STABLE, request) : NO_STORE,
    });
  } catch (err) {
    console.error(`[api/realm/${realm}/related]`, err);
    return NextResponse.json([], { status: 200, headers: NO_STORE });
  }
}
