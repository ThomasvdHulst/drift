import { NextResponse } from "next/server";
import { serverRealm } from "@/lib/realms/server";
import { cacheHeaders, CACHE_STABLE, NO_STORE } from "@/lib/cache-headers";

// GET /api/realm/[realm]/summary?id=<native id> → a Card for a specific item.
//   ?full=1     drops the sentence cap so the extract is the whole intro.
//   ?extended=1 returns the first several BODY paragraphs for "Read more":
//               `{ extract, hasMore }` (realm-defined — e.g. Wikipedia body
//               paragraphs, a book's opening passage).
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
  const id = url.searchParams.get("id");
  if (!id)
    return NextResponse.json(
      { error: "missing id" },
      { status: 400, headers: NO_STORE },
    );
  const full = url.searchParams.get("full") === "1";
  const extended = url.searchParams.get("extended") === "1";

  try {
    if (extended) {
      const out = await r.extended(id);
      if (!out) {
        return NextResponse.json(
          { error: "not found" },
          { status: 404, headers: NO_STORE },
        );
      }
      return NextResponse.json(out, { headers: cacheHeaders(CACHE_STABLE) });
    }
    const card = await r.summary(id, { full });
    if (!card) {
      return NextResponse.json(
        { error: "not found" },
        { status: 404, headers: NO_STORE },
      );
    }
    return NextResponse.json(card, { headers: cacheHeaders(CACHE_STABLE) });
  } catch (err) {
    console.error(`[api/realm/${realm}/summary]`, err);
    return NextResponse.json(
      { error: "not found" },
      { status: 404, headers: NO_STORE },
    );
  }
}
