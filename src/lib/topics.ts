// ---------------------------------------------------------------------------
// The topic registry — a curated, browseable subset of Wikimedia's ORES
// "articletopic" taxonomy (64 topics across Culture / Geography / History &
// Society / STEM). We drop the hyper-granular geographic subregions and the
// catch-all "*" buckets, keeping ~28 "fields you'd enjoy wandering" topics.
//
// Two representations of each topic, because Wikimedia uses two:
//   • `keyword`  — the CirrusSearch `articletopic:<slug>` value used to FIND
//                  pages of a topic (validated live against the search API).
//   • `oresKey`  — the dotted name used as a probability key by the ORES /
//                  Lift Wing `articletopic` model, used to LABEL a page's
//                  topics (M9). Verified format e.g. "STEM.Biology",
//                  "Culture.Media.Films". (M9 confirms each against the live
//                  model response and drops any that don't resolve.)
//
// Each topic also carries its homepage *face* (glyph / blurb / tint), the way
// realms/artic.buckets.ts and realms/arxiv.categories.ts carry theirs: the "Or
// drift within a field" section renders one card per topic, so the presentation
// lives next to the taxonomy instead of in a parallel table that could rot.
//
// ORDER IS PART OF THE DESIGN — the array is rendered as-is, so this file's order
// is the grid's order. Two rules, both enforced by topics.test.ts:
//   • Alphabetical by label, so 28 cards stay scannable without headings.
//   • Tints cycle through six far-apart hue families (sand, green, blue, rose,
//     teal, violet). Six is the smallest cycle that keeps every neighbour in a
//     2-, 3- OR 4-column grid a different family, diagonals included: the closest
//     same-family pair is 6 apart, which no layout ever puts side by side. Shades
//     within a family only add texture. Inserting a topic mid-list re-shuffles the
//     cycle, so re-run the tint check when you do.
// ---------------------------------------------------------------------------

export type TopicId = string;

export interface Topic {
  id: TopicId; // stable id (== keyword); used in the interest model + arrivedVia
  label: string; // friendly display name
  keyword: string; // articletopic: search slug
  oresKey: string; // ORES/Lift Wing probability key
  glyph: string; // typographic mark for the field tile — a symbol, never an emoji
  blurb: string; // one line of "what you'd find in here"
  tint: string; // pale tile background, blended over paper
}

export const TOPICS: Topic[] = [
  // tint family:            sand
  { id: "architecture", label: "Architecture", keyword: "architecture", oresKey: "Culture.Visual arts.Architecture", glyph: "⌂", tint: "#e6d8b2", blurb: "Buildings, ruins, and the shapes we live in" },
  // green
  { id: "biology", label: "Biology & Nature", keyword: "biology", oresKey: "STEM.Biology", glyph: "❦", tint: "#d0e7c5", blurb: "Life in all its strange variety" },
  // blue
  { id: "books", label: "Books", keyword: "books", oresKey: "Culture.Media.Books", glyph: "◫", tint: "#b3c7e5", blurb: "The printed page, from classics to curiosities" },
  // rose
  { id: "business-and-economics", label: "Business & Economics", keyword: "business-and-economics", oresKey: "History and Society.Business and economics", glyph: "⇗", tint: "#edc9d4", blurb: "Money, markets, and why they move" },
  // teal
  { id: "chemistry", label: "Chemistry", keyword: "chemistry", oresKey: "STEM.Chemistry", glyph: "◈", tint: "#a2d7d7", blurb: "Elements, reactions, and what things are made of" },
  // violet
  { id: "computing", label: "Computing", keyword: "computing", oresKey: "STEM.Computing", glyph: "▤", tint: "#d5b2e1", blurb: "Code, chips, and thinking machines" },
  // sand
  { id: "earth-and-environment", label: "Earth & Environment", keyword: "earth-and-environment", oresKey: "STEM.Earth and environment", glyph: "◭", tint: "#e8deba", blurb: "Oceans, weather, and a restless planet" },
  // green
  { id: "education", label: "Education", keyword: "education", oresKey: "History and Society.Education", glyph: "✎", tint: "#d4eacd", blurb: "Schools, ideas, and how knowledge is passed on" },
  // blue
  { id: "engineering", label: "Engineering", keyword: "engineering", oresKey: "STEM.Engineering", glyph: "▦", tint: "#bbcae8", blurb: "Bridges, rockets, and how things get built" },
  // rose
  { id: "films", label: "Film", keyword: "films", oresKey: "Culture.Media.Films", glyph: "◎", tint: "#f0d1d9", blurb: "Cinema, its makers, and the stories on screen" },
  // teal
  { id: "food-and-drink", label: "Food & Drink", keyword: "food-and-drink", oresKey: "Culture.Food and drink", glyph: "▽", tint: "#aad8da", blurb: "Kitchens, harvests, and the history of flavour" },
  // violet
  { id: "history", label: "History", keyword: "history", oresKey: "History and Society.History", glyph: "§", tint: "#dbbae3", blurb: "Empires, turning points, and the people in them" },
  // sand
  { id: "linguistics", label: "Language", keyword: "linguistics", oresKey: "Culture.Linguistics", glyph: "¶", tint: "#e3d1ab", blurb: "Scripts, tongues, and how we came to speak" },
  // green
  { id: "literature", label: "Literature", keyword: "literature", oresKey: "Culture.Literature", glyph: "❝", tint: "#cbe4be", blurb: "Novels, poets, and the long conversation" },
  // blue
  { id: "mathematics", label: "Mathematics", keyword: "mathematics", oresKey: "STEM.Mathematics", glyph: "π", tint: "#abc4e2", blurb: "Patterns, proofs, and beautiful infinities" },
  // rose
  { id: "medicine-and-health", label: "Medicine & Health", keyword: "medicine-and-health", oresKey: "STEM.Medicine & Health", glyph: "✚", tint: "#ebc2d0", blurb: "The astonishing machine you live inside" },
  // teal
  { id: "military-and-warfare", label: "Military History", keyword: "military-and-warfare", oresKey: "History and Society.Military and warfare", glyph: "†", tint: "#9bd4d1", blurb: "Campaigns, sieges, and the cost of them" },
  // violet
  { id: "music", label: "Music", keyword: "music", oresKey: "Culture.Media.Music", glyph: "♪", tint: "#ceabde", blurb: "Instruments, scenes, and unforgettable songs" },
  // sand
  { id: "performing-arts", label: "Performing Arts", keyword: "performing-arts", oresKey: "Culture.Performing arts", glyph: "✧", tint: "#e9e1be", blurb: "Stages, dancers, and the art of the live moment" },
  // green
  { id: "philosophy-and-religion", label: "Philosophy & Religion", keyword: "philosophy-and-religion", oresKey: "Culture.Philosophy and religion", glyph: "∴", tint: "#d7ebd0", blurb: "Big questions and the answers we have tried" },
  // blue
  { id: "physics", label: "Physics", keyword: "physics", oresKey: "STEM.Physics", glyph: "∿", tint: "#becde9", blurb: "The rules the universe actually runs on" },
  // rose
  { id: "politics-and-government", label: "Politics & Government", keyword: "politics-and-government", oresKey: "History and Society.Politics and government", glyph: "☰", tint: "#f1d5db", blurb: "Power, states, and how we choose to be ruled" },
  // teal
  { id: "society", label: "Society", keyword: "society", oresKey: "History and Society.Society", glyph: "⁂", tint: "#add8dc", blurb: "Customs, cities, and the way we live together" },
  // violet
  { id: "space", label: "Space & Astronomy", keyword: "space", oresKey: "STEM.Space", glyph: "✦", tint: "#debde5", blurb: "Black holes, comets, the edge of everything" },
  // sand
  { id: "sports", label: "Sports", keyword: "sports", oresKey: "Culture.Sports", glyph: "⚑", tint: "#e2cea7", blurb: "Games, records, and the people who broke them" },
  // green
  { id: "technology", label: "Technology", keyword: "technology", oresKey: "STEM.Technology", glyph: "⚙", tint: "#c9e2bb", blurb: "The inventions quietly running the world" },
  // blue
  { id: "transportation", label: "Transportation", keyword: "transportation", oresKey: "History and Society.Transportation", glyph: "⇄", tint: "#a8c2e1", blurb: "Ships, rails, and the urge to go somewhere" },
  // rose
  { id: "visual-arts", label: "Visual Arts", keyword: "visual-arts", oresKey: "Culture.Visual arts.Visual arts*", glyph: "❖", tint: "#e9bece", blurb: "Makers, movements, and masterpieces" },
];

const BY_KEYWORD = new Map(TOPICS.map((t) => [t.keyword, t]));
const BY_ORES = new Map(TOPICS.map((t) => [t.oresKey, t]));

export function topicByKeyword(keyword: string): Topic | undefined {
  return BY_KEYWORD.get(keyword);
}
export function topicByOresKey(oresKey: string): Topic | undefined {
  return BY_ORES.get(oresKey);
}
