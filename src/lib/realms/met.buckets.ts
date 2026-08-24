// Browse "buckets" for the Gallery realm (The Metropolitan Museum of Art). Each
// bucket is a room in the museum: the display fields drive the homepage seed
// tiles, and bucket ids are the allowlist for the discover injection guard (the
// client sends an id, the server maps id → query).
//
// Pure data, imported by both the client realm registry and the server adapter.
//
// WHY DEPARTMENTS. The Art Institute buckets this replaces were keyword guesses
// ("botanical", "still life") sent as full-text search, which matches a term
// anywhere in a record and drags in near-misses. The Met exposes its curatorial
// departments as a first-class `departmentId` filter: exact, fast, and already
// the way the museum itself divides the collection. They also make better rooms
// to read in — "Arms and Armor" and "Musical Instruments" are places, where
// "botanical" was a query.
//
// The two keyword buckets that remain are the ones no department expresses: a
// movement and a print tradition. They are deliberately kept as full-text.

export interface MetBucket {
  id: string;
  label: string;
  /** Full-text term. Used directly when there is no `departmentId`, and always
   *  present so a bucket can never resolve to an empty query. */
  q: string;
  /** The museum's own curatorial department. Preferred when set: an exact
   *  filter beats a keyword match. */
  departmentId?: number;
  glyph: string; // typographic mark for the seed tile
  blurb: string;
  tint: string; // pale tile background (blended over paper, like encyclopedia seeds)
}

// Alphabetical by label, which is the order the homepage grid renders them in.
// Counts in the comments are open-access works carrying an image, measured
// 2026-08-24; roughly three quarters survive the EU public-domain filter.
export const MET_BUCKETS: MetBucket[] = [
  { id: "africa-oceania-americas", label: "Africa & Oceania", q: "Africa Oceania Americas", departmentId: 5, glyph: "◬", blurb: "Art of three continents", tint: "#e3cdb2" }, // 11,631
  { id: "egypt", label: "Ancient Egypt", q: "Egyptian", departmentId: 10, glyph: "▲", blurb: "Four thousand years along the Nile", tint: "#efe6c9" }, // 14,471
  { id: "arms-armor", label: "Arms & Armor", q: "arms armor", departmentId: 4, glyph: "⛊", blurb: "Steel, craft, and ceremony", tint: "#dbe1e8" }, // 9,465
  { id: "asian", label: "Asian Art", q: "Asian", departmentId: 6, glyph: "〜", blurb: "China, Korea, Japan, and South Asia", tint: "#d9e7d7" }, // 34,153
  { id: "drawings-prints", label: "Drawings & Prints", q: "drawings prints", departmentId: 9, glyph: "▨", blurb: "Ink, chalk, and the printed line", tint: "#ece4d2" }, // 99,924
  { id: "costume", label: "Dress & Costume", q: "costume dress", departmentId: 8, glyph: "❁", blurb: "What people wore, and why", tint: "#eedde1" }, // 31,415
  { id: "european-paintings", label: "European Paintings", q: "European painting", departmentId: 11, glyph: "▤", blurb: "Five centuries of the painted panel", tint: "#e0dbee" }, // 2,667
  { id: "greek-roman", label: "Greek & Roman", q: "Greek Roman", departmentId: 13, glyph: "⬠", blurb: "Marble, bronze, and painted clay", tint: "#e8e8d3" }, // 30,544
  { id: "impressionism", label: "Impressionism", q: "Impressionism", glyph: "❋", blurb: "Light, colour, and the fleeting moment", tint: "#f0dfce" }, // 639
  { id: "islamic", label: "Islamic Art", q: "Islamic", departmentId: 14, glyph: "✧", blurb: "Geometry, calligraphy, and tile", tint: "#d5e7e2" }, // 15,193
  { id: "ukiyo-e", label: "Japanese Prints", q: "ukiyo-e", glyph: "≋", blurb: "Floating-world woodblock prints", tint: "#dae0ec" }, // 673
  { id: "medieval", label: "Medieval World", q: "medieval", departmentId: 17, glyph: "✦", blurb: "Gold ground, ivory, and stained glass", tint: "#ecd9c2" }, // 7,171
  { id: "instruments", label: "Musical Instruments", q: "musical instruments", departmentId: 18, glyph: "◉", blurb: "The objects that make the sound", tint: "#e6dcd6" }, // 3,978
  { id: "photographs", label: "Photographs", q: "photograph", departmentId: 19, glyph: "❦", blurb: "The first hundred years of the lens", tint: "#dee4e7" }, // 24,422
];

const BY_ID = new Map(MET_BUCKETS.map((b) => [b.id, b]));

export function metBucketById(id: string): MetBucket | undefined {
  return BY_ID.get(id);
}
