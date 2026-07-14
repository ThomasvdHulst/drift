import { NextResponse } from "next/server";
import { wikiQuery, CARD_PROPS } from "@/lib/wiki-server";
import { selectCardBatch, type ActionPage } from "@/lib/wiki";

export const dynamic = "force-dynamic";

// One request returns a BATCH of random pages; the client buffers them and hands
// them out one per drift. This is the key rate-limit fix: `generator=random` is
// Wikimedia's burst-limited endpoint, and the old route re-rolled up to 3× per
// card hunting for an image (random Wikipedia is ~70% imageless stubs), so a
// single drift could cost 2–3 requests. Fetching ~20 at once, keeping the imaged
// ones (+ a few text-only gems), means we touch the throttled endpoint roughly
// once per ~10 drifts instead of every drift. `exlimit=max` guarantees every
// page in the batch carries its intro extract.
const BATCH = 20;

// GET /api/wiki/random → an array of random, non-junk Cards (imaged-first).
export async function GET() {
  try {
    const raw = await wikiQuery({
      generator: "random",
      grnnamespace: "0",
      grnlimit: String(BATCH),
      exlimit: "max",
      ...CARD_PROPS,
    });
    const pages =
      (raw as { query?: { pages?: ActionPage[] } })?.query?.pages ?? [];
    return NextResponse.json(selectCardBatch(pages));
  } catch (err) {
    console.error("[api/wiki/random]", err);
    return NextResponse.json({ error: "wikipedia unreachable" }, { status: 502 });
  }
}
