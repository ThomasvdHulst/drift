import type { Card } from "./types";
import { SOURCE_IDS, type SourceId } from "./realms/types";

// ---------------------------------------------------------------------------
// Card identity across realms (Phase 5). Pure helpers, unit-tested.
//
// Every card has an app-wide unique id, `cardId` = `${source}:${pageTitle}`.
// The seen-set, reaction map, thread cache, and buffer dedup all key on it, so
// the same title in two realms never collides. `Card.source` is optional and
// defaults to "wikipedia" (back-compat with trails/seen saved before realms).
// ---------------------------------------------------------------------------

const SOURCES: readonly string[] = SOURCE_IDS;

/** The card's source, defaulting to Wikipedia for pre-Phase-5 data. */
export function cardSource(card: Pick<Card, "source">): SourceId {
  return card.source ?? "wikipedia";
}

/**
 * Whether this card is an ARTWORK, whichever museum it came from.
 *
 * The Gallery has had two sources: the Art Institute of Chicago until its image
 * host went behind a blanket block (Phase 31), and The Metropolitan Museum of
 * Art since. Cards saved before the move still carry `"artic"` and must keep
 * rendering as art — the museum label, the gallery-wall layout, the zoom affordance.
 *
 * This exists so "is this art?" is asked in ONE place. It used to be a bare
 * `source === "artic"` scattered across the card view, the trail map, the inbox
 * and the licence table, and every one of those was a site to miss when the
 * source changed.
 */
export function isArtSource(source?: SourceId | null): boolean {
  return source === "met" || source === "artic";
}

/** The source-native id/key (Wikipedia title, artwork id, book id, …). */
export function nativeId(card: Pick<Card, "pageTitle">): string {
  return card.pageTitle;
}

/** Build a cardId from parts. */
export function toCardId(source: SourceId, native: string): string {
  return `${source}:${native}`;
}

/** The app-wide unique id for a card. */
export function cardId(card: Pick<Card, "source" | "pageTitle">): string {
  return toCardId(cardSource(card), nativeId(card));
}

/**
 * Normalize a legacy seen/reaction entry to a cardId. Before Phase 5 these were
 * bare Wikipedia titles; anything not already namespaced with a KNOWN source
 * prefix is treated as a Wikipedia title. We only strip a recognized prefix so
 * real titles containing a colon (e.g. "Blade Runner: The Final Cut") aren't
 * mangled.
 */
export function normalizeSeenEntry(entry: string): string {
  const idx = entry.indexOf(":");
  if (idx > 0) {
    const prefix = entry.slice(0, idx);
    if (SOURCES.includes(prefix)) return entry;
  }
  return toCardId("wikipedia", entry);
}
