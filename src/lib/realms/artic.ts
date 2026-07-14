// Pure Art Institute of Chicago mappers (no network — the server adapter fetches
// and calls these). Kept separate from server/artic.ts so the normalizers are
// unit-testable without importing server-only fetch code.

import type { Card, RelatedCandidate } from "../types";

const IIIF = "https://www.artic.edu/iiif/2";

/** Build an IIIF image URL for an artwork's image_id (default 843px wide). */
export function articImageUrl(
  imageId?: string | null,
  width = 843,
): string | undefined {
  if (!imageId) return undefined;
  return `${IIIF}/${imageId}/full/${width},/0/default.jpg`;
}

/** The public artwork page. */
export function articPageUrl(id: number | string): string {
  return `https://www.artic.edu/artworks/${id}`;
}

export interface ArticArtwork {
  id: number;
  title?: string;
  artist_title?: string;
  artist_id?: number;
  date_display?: string;
  medium_display?: string;
  place_of_origin?: string;
  classification_title?: string;
  style_title?: string;
  subject_titles?: string[];
  department_title?: string;
  image_id?: string | null;
  is_public_domain?: boolean;
  short_description?: string | null;
  description?: string | null;
  provenance_text?: string | null;
}

/** Fields we request from search/detail (keeps payloads small). */
export const ARTIC_FIELDS = [
  "id", "title", "artist_title", "artist_id", "date_display", "medium_display",
  "place_of_origin", "classification_title", "style_title", "subject_titles",
  "department_title", "image_id", "is_public_domain", "short_description",
].join(",");

/** Usable as a card? public domain + has an image + a title. */
export function isUsableArtwork(a: ArticArtwork | null | undefined): a is ArticArtwork {
  return !!a && !!a.image_id && !!a.is_public_domain && !!(a.title && a.title.trim());
}

// A short "hook" line: a blurb if present, else medium + place.
function artExtract(a: ArticArtwork): string {
  if (a.short_description) return a.short_description.replace(/<[^>]+>/g, "").trim();
  return [a.medium_display, a.place_of_origin]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

function artDescription(a: ArticArtwork): string | undefined {
  const d = [a.artist_title, a.date_display]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" · ");
  return d || undefined;
}

export function articToCard(a: ArticArtwork): Card {
  return {
    pageTitle: String(a.id),
    displayTitle: (a.title ?? "").trim() || "Untitled",
    description: artDescription(a),
    extract: artExtract(a),
    imageUrl: articImageUrl(a.image_id),
    sourceUrl: articPageUrl(a.id),
    source: "artic",
  };
}

/** A faceted related candidate ("More by {artist}", etc.). */
export function articToCandidate(
  a: ArticArtwork,
  threadLabel: string,
  facet: string,
): RelatedCandidate {
  return {
    pageTitle: String(a.id),
    displayTitle: (a.title ?? "").trim() || "Untitled",
    description: artDescription(a),
    extract: artExtract(a),
    imageUrl: articImageUrl(a.image_id),
    source: "artic",
    sourceUrl: articPageUrl(a.id),
    threadLabel,
    facet,
  };
}
