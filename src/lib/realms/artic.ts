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
  dimensions?: string | null;
  credit_line?: string | null;
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
  term_titles?: string[]; // subject/keyword tags (used for the cross-realm gate)
  _score?: number; // AIC relevance score (present on search results)
  // A small object AIC returns alongside the image: a base64 blur placeholder and
  // real alt text (used for a blur-up load + a11y on the card and zoom lightbox).
  thumbnail?: {
    lqip?: string | null;
    alt_text?: string | null;
    width?: number;
    height?: number;
  } | null;
}

/** Fields we request from search/detail (keeps payloads small). */
export const ARTIC_FIELDS = [
  "id", "title", "artist_title", "artist_id", "date_display", "medium_display",
  "dimensions", "credit_line", "place_of_origin", "classification_title",
  "style_title", "subject_titles", "department_title", "image_id",
  "is_public_domain", "short_description", "thumbnail",
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

/**
 * The "museum label": structured metadata rows for an artwork, in reading order,
 * skipping anything missing. Pure so it's unit-testable; surfaced on the card as a
 * calm, progressively-disclosed "Details" block (Phase 14 M-G1).
 */
export function artFacts(a: ArticArtwork): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value?: string | null) => {
    const v = (value ?? "").trim();
    if (v) rows.push({ label, value: v });
  };
  push("Medium", a.medium_display);
  push("Dimensions", a.dimensions);
  push("Classification", a.classification_title);
  push("Department", a.department_title);
  push("Origin", a.place_of_origin);
  const subjects = (a.subject_titles ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (subjects.length) push("Subjects", subjects.join(", "));
  push("Credit", a.credit_line);
  return rows;
}

/** The Phase-14 rich fields (museum label / zoom / blur / alt) an artwork carries,
 *  shared by cards AND candidates so a pulled thread lands on a full art card. */
function articRichFields(a: ArticArtwork) {
  const facts = artFacts(a);
  return {
    ...(facts.length ? { facts } : {}),
    ...(a.image_id ? { zoomUrl: articImageUrl(a.image_id, 1686) } : {}),
    ...(a.thumbnail?.lqip ? { blurDataUrl: a.thumbnail.lqip } : {}),
    ...(a.thumbnail?.alt_text ? { imageAlt: a.thumbnail.alt_text.trim() } : {}),
  };
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
    ...articRichFields(a),
  };
}

/** A faceted related candidate. `eyebrow` is the short facet word shown above
 *  the label on the chip ("MORE BY", "THE MOVEMENT", …); `threadLabel` is the
 *  destination (the artist / movement / place / subject). */
export function articToCandidate(
  a: ArticArtwork,
  threadLabel: string,
  facet: string,
  eyebrow?: string,
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
    ...(eyebrow ? { eyebrow } : {}),
    ...articRichFields(a),
  };
}
