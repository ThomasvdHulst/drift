import { NextResponse } from "next/server";
import { crossRealmDoorway } from "@/lib/realms/server/doorway";
import {
  cacheHeaders,
  CACHE_STABLE,
  CACHE_SHORT,
  NO_STORE,
} from "@/lib/cache-headers";

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
    // A found doorway is deterministic per card, so it keeps for a day. "No
    // doorway" keeps for ten minutes: measured live, about half of all cards have
    // none, and answering that with NO_STORE meant the same fruitless lookup ran
    // again for every reader of every one of those cards. A short cache stops the
    // repetition without freezing what might have been a transient miss.
    return candidate
      ? NextResponse.json({ candidate }, { headers: cacheHeaders(CACHE_STABLE, request) })
      : NextResponse.json({}, { headers: cacheHeaders(CACHE_SHORT, request) });
  } catch {
    return NextResponse.json({}, { headers: NO_STORE });
  }
}
