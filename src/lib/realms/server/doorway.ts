// Server-side cross-realm "doorway" resolver (Phase 15). Given the current card,
// find at most ONE genuinely-related card in the OTHER realm, factually (no AI):
//   Gallery → Encyclopedia: resolve the artwork's artist/movement/place onto a
//     Wikipedia article (the summary endpoint follows redirects, so "Katsushika
//     Hokusai" → Hokusai).
//   Encyclopedia → Gallery: search The Met for the article title, gated so only a
//     genuine match becomes a doorway (Octopus → a stirrup jar painted with one,
//     but abstract topics stay silent). The gate rests on the term appearing in
//     the work's title or its subject tags; the Art Institute's relevance score,
//     which it used to also require, has no equivalent here and turned out not to
//     be the load-bearing half (see passesReverseGate).
// Best-effort by construction: any miss/failure ⇒ null ⇒ no doorway (§4).

import type { RelatedCandidate } from "@/lib/types";
import { isJunk } from "@/lib/wiki";
import {
  forwardEntities,
  passesReverseGate,
  DOORWAY_EYEBROW,
} from "@/lib/crossrealm";
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
    // The gate is handed DOWN rather than applied to the answer. It used to run
    // here, on whichever single work five record fetches had already paid for —
    // so a card that was never going to have a doorway still cost five requests,
    // and across a real session that was 92% of everything the museum was asked.
    // Passing it in lets the adapter stop at the first record that satisfies it,
    // while the rule itself stays here, where cross-realm decisions belong.
    const top = await metTopMatch(id, ({ title, term_titles }) =>
      passesReverseGate(id, { title, term_titles }),
    );
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
