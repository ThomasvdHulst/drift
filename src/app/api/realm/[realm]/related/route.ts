import { NextResponse } from "next/server";
import { serverRealm } from "@/lib/realms/server";

export const dynamic = "force-dynamic";

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
  if (!r) return NextResponse.json({ error: "unknown realm" }, { status: 400 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    return NextResponse.json(await r.related(id));
  } catch (err) {
    console.error(`[api/realm/${realm}/related]`, err);
    return NextResponse.json([], { status: 200 });
  }
}
