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
    return NextResponse.json(await r.related(id), {
      headers: cacheHeaders(CACHE_STABLE),
    });
  } catch (err) {
    console.error(`[api/realm/${realm}/related]`, err);
    return NextResponse.json([], { status: 200, headers: NO_STORE });
  }
}
