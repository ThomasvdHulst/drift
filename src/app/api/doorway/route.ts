import { NextResponse } from "next/server";
import { crossRealmDoorway } from "@/lib/realms/server/doorway";

export const dynamic = "force-dynamic";

// GET /api/doorway?realm=<from>&id=<native id>
// → { candidate } when there's a genuine cross-realm doorway, else {}.
// Always 200 + graceful: a missing/failed lookup is just "no doorway" (§4), never
// an error the feed has to handle.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const realm = url.searchParams.get("realm") ?? "";
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({});
  try {
    const candidate = await crossRealmDoorway(realm, id);
    return NextResponse.json(candidate ? { candidate } : {});
  } catch {
    return NextResponse.json({});
  }
}
