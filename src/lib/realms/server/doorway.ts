// Server-side cross-realm "doorway" resolver (Phase 15). Given the current card,
// find at most ONE genuinely-related card in the OTHER realm, factually (no AI):
//   Gallery → Encyclopedia: resolve the artwork's artist/movement/place onto a
//     Wikipedia article (the summary endpoint follows redirects, so "Katsushika
//     Hokusai" → Hokusai).
//   Encyclopedia → Gallery: look the article title up in a blob baked from The
//     Met's own CC0 catalogue, so only a genuine match becomes a doorway
//     (Octopus → a stirrup jar painted with one, but abstract topics stay
//     silent) and a card with no match costs the museum NOTHING. The rule lives
//     in lib/realms/doorwayindex.ts; a hit still fetches one record, because the
//     published catalogue does not carry the image path.
// Best-effort by construction: any miss/failure ⇒ null ⇒ no doorway (§4).

import type { RelatedCandidate } from "@/lib/types";
import { isJunk } from "@/lib/wiki";
import { forwardEntities, DOORWAY_EYEBROW } from "@/lib/crossrealm";
import { wikiSummary } from "./wikipedia";
import { metArtworkMeta, metTopMatch } from "./met";

/**
 * `null` means one thing only: we looked, and there is genuinely nothing there.
 * The route caches that briefly, because about half of all cards have no doorway
 * and re-asking for every reader was the app's most repeated wasted call.
 *
 * An upstream failure is deliberately NOT swallowed here — it throws, the route
 * answers with no doorway and NO_STORE, and a transient miss is never cached as
 * if it were an answer. The reader sees the same thing either way: no chip (§4).
 */
export async function crossRealmDoorway(
  fromRealm: string,
  id: string,
): Promise<RelatedCandidate | null> {
  if (fromRealm === "gallery") {
    const meta = await metArtworkMeta(id);
    if (!meta) return null;
    // Try the artist first, then the movement (cap at 2 lookups).
    for (const entity of forwardEntities(meta).slice(0, 2)) {
      const card = await wikiSummary(entity);
      if (card && !isJunk({ title: card.pageTitle, extract: card.extract })) {
        return {
          pageTitle: card.pageTitle,
          displayTitle: card.displayTitle,
          description: card.description,
          extract: card.extract,
          imageUrl: card.imageUrl,
          source: "wikipedia",
          sourceUrl: card.sourceUrl,
          threadLabel: card.displayTitle,
          eyebrow: DOORWAY_EYEBROW.encyclopedia,
        };
      }
    }
    return null;
  }

  if (fromRealm === "encyclopedia") {
    // For an Encyclopedia card the native id IS the Wikipedia title.
    //
    // ⚠️ NO GATE IS PASSED DOWN ANY MORE, AND THAT IS THE PHASE 34 CHANGE. The
    // rule used to live here and be handed to the adapter to apply as records
    // arrived, because deciding cost upstream requests and the cheapest place to
    // stop was mid-fetch. It now costs none: the adapter answers from a blob
    // baked out of the museum's own CC0 catalogue, so a card with no Gallery
    // match is settled locally and the request is never made.
    //
    // The rule itself moved with it, to lib/realms/doorwayindex.ts, and got
    // stricter on the way — `passesReverseGate` was a raw substring test that
    // only held up as a confirmation on relevance-ranked results, and over the
    // whole catalogue it answered "Owl" with an Open Bowl.
    const top = await metTopMatch(id);
    if (!top) return null;
    const c = top.card;
    return {
      pageTitle: c.pageTitle,
      displayTitle: c.displayTitle,
      description: c.description,
      extract: c.extract,
      imageUrl: c.imageUrl,
      source: "met",
      sourceUrl: c.sourceUrl,
      threadLabel: c.displayTitle,
      eyebrow: DOORWAY_EYEBROW.gallery,
      // Carry the rich art fields so the landed Gallery card zooms + shows its
      // museum label (candidateToCard preserves these).
      zoomUrl: c.zoomUrl,
      previewUrl: c.previewUrl,
      imageAlt: c.imageAlt,
      facts: c.facts,
    };
  }

  return null;
}
