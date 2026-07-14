// Browse "buckets" for the Gallery realm (Art Institute of Chicago). Each bucket
// is a themed slice of the public-domain collection: `q` is the full-text search
// term sent to the AIC search endpoint (combined with is_public_domain), and the
// display fields drive the homepage seed tiles. Bucket ids are the allowlist for
// the discover injection guard (the client sends an id, the server maps id → q).
//
// Pure data, imported by both the client realm registry and the server adapter.

export interface ArticBucket {
  id: string;
  label: string;
  q: string; // AIC full-text search term
  glyph: string; // typographic mark for the seed tile
  blurb: string;
  tint: string; // pale tile background (blended over paper, like encyclopedia seeds)
}

export const ARTIC_BUCKETS: ArticBucket[] = [
  { id: "impressionism", label: "Impressionism", q: "Impressionism", glyph: "❋", blurb: "Light, colour, and the fleeting moment", tint: "#efe0d2" },
  { id: "ukiyo-e", label: "Japanese Prints", q: "ukiyo-e", glyph: "〜", blurb: "Floating-world woodblock prints", tint: "#e6ddcf" },
  { id: "ancient", label: "Ancient World", q: "ancient Greek Roman", glyph: "▲", blurb: "Pottery, bronze, and marble", tint: "#e9e2d0" },
  { id: "landscape", label: "Landscapes", q: "landscape", glyph: "◭", blurb: "Land, sea, and sky", tint: "#dde6dd" },
  { id: "portrait", label: "Portraits", q: "portrait", glyph: "◉", blurb: "Faces across the centuries", tint: "#eddfe0" },
  { id: "still-life", label: "Still Life", q: "still life", glyph: "❦", blurb: "Flowers, fruit, and quiet objects", tint: "#e9e3d6" },
  { id: "botanical", label: "Botanical", q: "botanical", glyph: "❀", blurb: "Plants drawn with a naturalist's eye", tint: "#dfe7d8" },
  { id: "birds-beasts", label: "Birds & Beasts", q: "animals birds", glyph: "✦", blurb: "The animal kingdom in art", tint: "#e2e6df" },
  { id: "mythology", label: "Myth & Legend", q: "mythology", glyph: "✧", blurb: "Gods, heroes, and monsters", tint: "#e6e1ee" },
  { id: "textiles", label: "Textiles", q: "textile", glyph: "▦", blurb: "Woven, dyed, and embroidered", tint: "#eadfd6" },
];

const BY_ID = new Map(ARTIC_BUCKETS.map((b) => [b.id, b]));

export function articBucketById(id: string): ArticBucket | undefined {
  return BY_ID.get(id);
}
