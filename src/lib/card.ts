import type { Card } from "./types";
import type { SourceId } from "./realms/types";

// ---------------------------------------------------------------------------
// Card identity across realms (Phase 5). Pure helpers, unit-tested.
//
// Every card has an app-wide unique id, `cardId` = `${source}:${pageTitle}`.
// The seen-set, reaction map, thread cache, and buffer dedup all key on it, so
// the same title in two realms never collides. `Card.source` is optional and
// defaults to "wikipedia" (back-compat with trails/seen saved before realms).
// ---------------------------------------------------------------------------

const SOURCES: readonly SourceId[] = ["wikipedia", "artic", "gutenberg"];

/** The card's source, defaulting to Wikipedia for pre-Phase-5 data. */
export function cardSource(card: Pick<Card, "source">): SourceId {
  return card.source ?? "wikipedia";
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
    if ((SOURCES as readonly string[]).includes(prefix)) return entry;
  }
  return toCardId("wikipedia", entry);
}
