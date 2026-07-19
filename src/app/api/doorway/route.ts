import { NextResponse } from "next/server";
import { crossRealmDoorway } from "@/lib/realms/server/doorway";
import { cacheHeaders, CACHE_MEDIUM, NO_STORE } from "@/lib/cache-headers";

// GET /api/doorway?realm=<from>&id=<native id>
// → { candidate } when there's a genuine cross-realm doorway, else {}.
// Always 200 + graceful: a missing/failed lookup is just "no doorway" (§4), never
// an error the feed has to handle.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const realm = url.searchParams.get("realm") ?? "";
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({}, { headers: NO_STORE });
  try {
    const candidate = await crossRealmDoorway(realm, id);
    // Cache a found doorway (deterministic per card); never cache "no doorway",
    // which may just be a failed lookup this time.
    return candidate
      ? NextResponse.json({ candidate }, { headers: cacheHeaders(CACHE_MEDIUM) })
      : NextResponse.json({}, { headers: NO_STORE });
  } catch {
    return NextResponse.json({}, { headers: NO_STORE });
  }
}
