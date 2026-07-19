import { NextResponse } from "next/server";
import { serverRealm } from "@/lib/realms/server";
import { cacheHeaders, CACHE_MEDIUM, NO_STORE } from "@/lib/cache-headers";

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
    // Only cache a real batch. An empty result is more likely a transient upstream
    // hiccup than a genuine "nothing here", and caching it would freeze the drift
    // buffer empty for the whole edge population.
    return NextResponse.json(cards, {
      headers: cards.length ? cacheHeaders(CACHE_MEDIUM) : NO_STORE,
    });
  } catch (err) {
    console.error(`[api/realm/${realm}/discover]`, err);
    return NextResponse.json([], { status: 200, headers: NO_STORE });
  }
}
