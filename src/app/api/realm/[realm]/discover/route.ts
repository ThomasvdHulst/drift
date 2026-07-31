import { NextResponse } from "next/server";
import { serverRealm } from "@/lib/realms/server";
import { cacheHeaders, CACHE_STABLE, NO_STORE } from "@/lib/cache-headers";

// GET /api/realm/[realm]/discover?bucket=<slug>&offset=<n>&limit=<n>
// → a batch of interesting, on-bucket, non-junk Cards for the drift buffer.
// The bucket is allowlisted per realm (injection guard). Graceful: any upstream
// failure returns [] (HTTP 200) so the feed can still fall back.
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

  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket") ?? "";
  if (!r.validateBucket(bucket)) {
    return NextResponse.json(
      { error: "unknown bucket" },
      { status: 400, headers: NO_STORE },
    );
  }

  const offsetNum = Number(url.searchParams.get("offset"));
  const offset =
    Number.isFinite(offsetNum) && offsetNum >= 0 ? Math.min(offsetNum, 1000) : 0;
  const limitNum = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 20) : 20;

  try {
    const cards = await r.discover({ bucket, offset, limit });
    // A batch is as stable as a page summary — one window of a bucket's ranking,
    // which barely moves in a day — so it gets the same day-long profile, and
    // stale-while-revalidate refreshes it in the background. Since offsets are now
    // aligned to the window size, a day of traffic lands on ~100 URLs per topic
    // rather than scattering across thousands, which is what makes this worth it.
    //
    // Only ever cache a REAL batch. An empty result is more likely a transient
    // upstream hiccup than a genuine "nothing here", and caching it would freeze
    // the drift buffer empty for the whole edge population.
    return NextResponse.json(cards, {
      headers: cards.length ? cacheHeaders(CACHE_STABLE, request) : NO_STORE,
    });
  } catch (err) {
    console.error(`[api/realm/${realm}/discover]`, err);
    return NextResponse.json([], { status: 200, headers: NO_STORE });
  }
}
