import { NextResponse } from "next/server";
import { crossRealmDoorway } from "@/lib/realms/server/doorway";
import { cacheHeaders, CACHE_STABLE, NO_STORE } from "@/lib/cache-headers";

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
    // Both answers are deterministic per card, so both keep for a day.
    //
    // "No doorway" used to keep for only ten minutes, hedging against a throttled
    // lookup being cached as a settled answer. That hedge is no longer needed and
    // was expensive: about half of all cards have no doorway, so the app's most
    // repeated lookup was the one that expired soonest. `searchIds` now RETHROWS
    // on the doorway path, so a failure reaches the catch below and is answered
    // NO_STORE — which means a `null` here really does mean "we looked, there is
    // nothing", and that does not change tomorrow.
    //
    // ⚠️ The two halves belong together: lengthening this cache while a throttle
    // could still masquerade as `null` would freeze "nothing here" onto a card
    // for a day because the museum was busy for a second.
    return candidate
      ? NextResponse.json({ candidate }, { headers: cacheHeaders(CACHE_STABLE, request) })
      : NextResponse.json({}, { headers: cacheHeaders(CACHE_STABLE, request) });
  } catch {
    return NextResponse.json({}, { headers: NO_STORE });
  }
}
