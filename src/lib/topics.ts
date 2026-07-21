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
// ---------------------------------------------------------------------------

export type TopicId = string;

export interface Topic {
  id: TopicId; // stable id (== keyword); used in the interest model + arrivedVia
  label: string; // friendly display name
  keyword: string; // articletopic: search slug
  oresKey: string; // ORES/Lift Wing probability key
}

export const TOPICS: Topic[] = [
  // STEM
  { id: "space", label: "Space & Astronomy", keyword: "space", oresKey: "STEM.Space" },
  { id: "biology", label: "Biology & Nature", keyword: "biology", oresKey: "STEM.Biology" },
  { id: "physics", label: "Physics", keyword: "physics", oresKey: "STEM.Physics" },
  { id: "mathematics", label: "Mathematics", keyword: "mathematics", oresKey: "STEM.Mathematics" },
  { id: "chemistry", label: "Chemistry", keyword: "chemistry", oresKey: "STEM.Chemistry" },
  { id: "medicine-and-health", label: "Medicine & Health", keyword: "medicine-and-health", oresKey: "STEM.Medicine & Health" },
  { id: "earth-and-environment", label: "Earth & Environment", keyword: "earth-and-environment", oresKey: "STEM.Earth and environment" },
  { id: "technology", label: "Technology", keyword: "technology", oresKey: "STEM.Technology" },
  { id: "computing", label: "Computing", keyword: "computing", oresKey: "STEM.Computing" },
  { id: "engineering", label: "Engineering", keyword: "engineering", oresKey: "STEM.Engineering" },
  // History & Society
  { id: "history", label: "History", keyword: "history", oresKey: "History and Society.History" },
  { id: "military-and-warfare", label: "Military History", keyword: "military-and-warfare", oresKey: "History and Society.Military and warfare" },
  { id: "politics-and-government", label: "Politics & Government", keyword: "politics-and-government", oresKey: "History and Society.Politics and government" },
  { id: "business-and-economics", label: "Business & Economics", keyword: "business-and-economics", oresKey: "History and Society.Business and economics" },
  { id: "society", label: "Society", keyword: "society", oresKey: "History and Society.Society" },
  { id: "transportation", label: "Transportation", keyword: "transportation", oresKey: "History and Society.Transportation" },
  { id: "education", label: "Education", keyword: "education", oresKey: "History and Society.Education" },
  // Culture
  { id: "visual-arts", label: "Visual Arts", keyword: "visual-arts", oresKey: "Culture.Visual arts.Visual arts*" },
  { id: "architecture", label: "Architecture", keyword: "architecture", oresKey: "Culture.Visual arts.Architecture" },
  { id: "music", label: "Music", keyword: "music", oresKey: "Culture.Media.Music" },
  { id: "films", label: "Film", keyword: "films", oresKey: "Culture.Media.Films" },
  { id: "literature", label: "Literature", keyword: "literature", oresKey: "Culture.Literature" },
  { id: "books", label: "Books", keyword: "books", oresKey: "Culture.Media.Books" },
  { id: "philosophy-and-religion", label: "Philosophy & Religion", keyword: "philosophy-and-religion", oresKey: "Culture.Philosophy and religion" },
  { id: "sports", label: "Sports", keyword: "sports", oresKey: "Culture.Sports" },
  { id: "food-and-drink", label: "Food & Drink", keyword: "food-and-drink", oresKey: "Culture.Food and drink" },
  { id: "linguistics", label: "Language", keyword: "linguistics", oresKey: "Culture.Linguistics" },
  { id: "performing-arts", label: "Performing Arts", keyword: "performing-arts", oresKey: "Culture.Performing arts" },
];

const BY_KEYWORD = new Map(TOPICS.map((t) => [t.keyword, t]));
const BY_ORES = new Map(TOPICS.map((t) => [t.oresKey, t]));

export function topicByKeyword(keyword: string): Topic | undefined {
  return BY_KEYWORD.get(keyword);
}
export function topicByOresKey(oresKey: string): Topic | undefined {
  return BY_ORES.get(oresKey);
}
