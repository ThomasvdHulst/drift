// ---------------------------------------------------------------------------
// "In the news" (Phase 23) — the pure core of a drift confined to the Wikipedia
// articles behind current stories.
//
// THE SOURCE, and why it is this one. Drift never shows news: a news realm was
// researched and parked (all-rights-reserved outlets, EU Copyright Directive
// Art. 15 on snippets, Wikinews shut down). Instead we use news only as a SIGNAL
// for which Wikipedia articles are current, and the signal comes from Wikipedia
// itself — `Portal:Current events`, a daily page where volunteers summarise world
// news, already grouped into ten subject sections, with every notable entity
// already wikilinked. Same CC BY-SA corpus the Encyclopedia realm already ships,
// so there is no new licensing exposure, no scraping and no publisher images. We
// read only the LINK TARGETS; the prose and the external refs are discarded.
//
// The day pages look like `Portal:Current events/2026 July 22` (no zero padding)
// and their wikitext is pleasantly regular:
//
//     '''Sports'''
//     *[[2026 FIFA World Cup]]
//     **[[Spain national football team|Spain]] beat [[Argentina...]] in the
//       [[2026 FIFA World Cup final|final]]. [https://example.com (Reuters)]
//
// A bullet that is ONLY a link is the story's subject ("header"); a bullet that
// is a sentence links things incidentally ("prose"). That distinction is the
// whole ranking: it is what puts "2026 FIFA World Cup" above "New York (state)".
//
// No React, no DOM, no network — the route in app/api/wiki/current wires fetches
// to these, exactly as the feed wires fetches to orbit.ts.
// ---------------------------------------------------------------------------

/** One browsable news section: a `Portal:Current events` heading, given a face.
 *  Carries the same glyph/blurb/tint a topic does, so it renders through the
 *  homepage's `TileGrid` unchanged (structurally a `Tile`; this module stays a
 *  React-free leaf rather than importing the component's type). */
export interface CurrentSection {
  /** Stable slug used in the URL + `ArrivedVia`. */
  id: string;
  label: string;
  /** Heading spellings accepted from the wikitext (matched loosely, see
   *  `normalizeHeading`). Editors have renamed these over the years, so each
   *  section carries its variants rather than assuming today's wording. */
  headings: string[];
  glyph: string;
  blurb: string;
  tint: string;
}

// Ordered LIGHTER FIRST, deliberately. Every section Wikipedia publishes is
// offered (§2.1: no hidden curation, you choose what to read), but a calm app
// should not open with war, so the conversation topics lead and armed conflict
// comes last. Tints follow the same six-family cycle as topics.ts — sand, green,
// blue, rose, teal, violet — which keeps neighbouring cards distinguishable in a
// 2-, 3- or 4-column grid (see topics.ts's header note; current.test.ts asserts it).
export const CURRENT_SECTIONS: CurrentSection[] = [
  {
    id: "sports",
    label: "Sports",
    headings: ["Sports"],
    glyph: "⚑",
    tint: "#e6d8b2",
    blurb: "Matches, records, and who is winning right now",
  },
  {
    id: "science-and-technology",
    label: "Science & Technology",
    headings: ["Science and technology"],
    glyph: "◈",
    tint: "#d0e7c5",
    blurb: "Launches, discoveries, and what was just built",
  },
  {
    id: "arts-and-culture",
    label: "Arts & Culture",
    headings: ["Arts and culture"],
    glyph: "❖",
    tint: "#b3c7e5",
    blurb: "Prizes, premieres, and the culture of the moment",
  },
  {
    id: "business-and-economy",
    label: "Business & Economy",
    headings: ["Business and economy", "Business and economics"],
    glyph: "⇗",
    tint: "#edc9d4",
    blurb: "Markets, deals, and where the money is moving",
  },
  {
    id: "health-and-environment",
    label: "Health & Environment",
    headings: ["Health and environment", "Health and medicine"],
    glyph: "✚",
    tint: "#a2d7d7",
    blurb: "The planet and the people living on it",
  },
  {
    id: "politics-and-elections",
    label: "Politics & Elections",
    headings: ["Politics and elections"],
    glyph: "☰",
    tint: "#d5b2e1",
    blurb: "Votes, leaders, and who holds power",
  },
  {
    id: "international-relations",
    label: "International Relations",
    headings: ["International relations", "Diplomacy"],
    glyph: "⇄",
    tint: "#e8deba",
    blurb: "Treaties, talks, and how countries are getting on",
  },
  {
    id: "law-and-crime",
    label: "Law & Crime",
    headings: ["Law and crime"],
    glyph: "§",
    tint: "#d4eacd",
    blurb: "Courts, rulings, and the cases being argued",
  },
  {
    id: "disasters-and-accidents",
    label: "Disasters & Accidents",
    headings: ["Disasters and accidents", "Disasters"],
    glyph: "◭",
    tint: "#bbcae8",
    blurb: "Storms, quakes, and what the world is recovering from",
  },
  {
    id: "armed-conflicts",
    label: "Armed Conflicts",
    headings: ["Armed conflicts and attacks", "Attacks and armed conflicts"],
    glyph: "†",
    tint: "#f0d1d9",
    blurb: "Wars and attacks, and the history underneath them",
  },
];

const BY_ID = new Map(CURRENT_SECTIONS.map((s) => [s.id, s]));

/** The section for a slug, or undefined. The URL-param guard: an unknown or
 *  injected `section` yields no focus, exactly as `topicByKeyword` guards a field. */
export function sectionById(id: string | null | undefined): CurrentSection | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Loose heading match: case, punctuation and spacing are all noise here, and
 *  "&" is just another way to write "and" (editors use both). */
function normalizeHeading(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

const BY_HEADING = new Map(
  CURRENT_SECTIONS.flatMap((s) =>
    s.headings.map((h) => [normalizeHeading(h), s.id] as const),
  ),
);

/** The section a wikitext heading belongs to, or undefined for one we don't
 *  track. Unknown headings are DROPPED rather than guessed into a neighbour. */
export function sectionIdForHeading(heading: string): string | undefined {
  return BY_HEADING.get(normalizeHeading(heading));
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The `Portal:Current events/<Y> <Month> <D>` titles for the `days` days ending
 * at (and including) `today`, most recent first — so an entry's index in this
 * array IS its age in days, which is what `rankCurrent` weights by.
 * No zero padding: the pages are "2026 July 1", not "2026 July 01".
 */
export function dayPageTitles(today: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i),
    );
    out.push(
      `Portal:Current events/${d.getUTCFullYear()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
    );
  }
  return out;
}

/** One wikilink found under a section on one day. */
export interface CurrentEntry {
  sectionId: string;
  title: string;
  /** The bullet was nothing but this link ⇒ it is the story's subject. */
  header: boolean;
  /** 0 = today. Equals the day page's index in `dayPageTitles`. */
  daysAgo: number;
}

const LINK = /\[\[([^\]|#]+?)(?:\|[^\]]*?)?\]\]/g;
const EXTERNAL_REF = /\[https?:\/\/[^\]]*\]/g;
const HEADING = /^'''(.+?)'''$/;
// Link targets that are never a readable article.
const SKIP_PREFIX = [
  "File:", "Image:", "Category:", "Wikipedia:", "Portal:",
  "Template:", "Help:", "Special:", "Talk:", "Draft:", "Module:",
];

/**
 * Pull every tracked wikilink out of one day page's wikitext.
 *
 * A line is a HEADER when removing its wikilinks and bare external refs leaves
 * nothing behind (`***[[2026 Strait of Hormuz crisis]]`) and PROSE when it
 * leaves a sentence. Prose links are still collected — during a World Cup
 * "association football" only ever appears mid-sentence, and it is a card you
 * want — they just score lower than the story subjects.
 */
export function parseCurrentEvents(wikitext: string, daysAgo: number): CurrentEntry[] {
  const out: CurrentEntry[] = [];
  let sectionId: string | undefined;
  for (const raw of wikitext.split("\n")) {
    const line = raw.trim();
    const heading = HEADING.exec(line);
    if (heading) {
      sectionId = sectionIdForHeading(heading[1]);
      continue;
    }
    if (!sectionId || !line.startsWith("*")) continue;
    const body = line.replace(/^\*+/, "").trim();

    const titles: string[] = [];
    for (const m of body.matchAll(LINK)) {
      const title = m[1].trim();
      if (title && !SKIP_PREFIX.some((p) => title.startsWith(p))) titles.push(title);
    }
    if (titles.length === 0) continue;

    const rest = body
      .replace(LINK, "")
      .replace(EXTERNAL_REF, "")
      .replace(/[\s.,;:'"()–—-]/g, "");
    const header = rest.length === 0;

    for (const title of titles) out.push({ sectionId, title, header, daysAgo });
  }
  return out;
}

/** A ranked article in a section's pool. */
export interface RankedCurrent {
  title: string;
  /** Freshest sighting, for the honest "in the news · 3 days ago" chip. */
  daysAgo: number;
  score: number;
}

// A story subject counts for much more than a passing mention, and something
// that stayed in the news for several days counts for more than a one-day blip.
const HEADER_WEIGHT = 3;
const PROSE_WEIGHT = 1;
const DAY_WEIGHT = 1;
// Recency decay: a mention today is worth ~2x one from a month ago, so the pool
// leads with what is happening now without discarding the month's context.
const RECENCY_HALF_LIFE = 30;

/**
 * Collapse a window's entries into one section's ranked, deduplicated pool.
 * Ties break on title so the order is stable (and testable) rather than
 * dependent on the order Wikipedia happened to return the day pages in.
 */
export function rankCurrent(entries: CurrentEntry[], sectionId: string): RankedCurrent[] {
  const acc = new Map<
    string,
    { headers: number; prose: number; days: Set<number>; freshest: number; score: number }
  >();
  for (const e of entries) {
    if (e.sectionId !== sectionId) continue;
    const cur = acc.get(e.title) ?? {
      headers: 0,
      prose: 0,
      days: new Set<number>(),
      freshest: e.daysAgo,
      score: 0,
    };
    if (e.header) cur.headers++;
    else cur.prose++;
    cur.days.add(e.daysAgo);
    cur.freshest = Math.min(cur.freshest, e.daysAgo);
    const recency = 2 ** (-e.daysAgo / RECENCY_HALF_LIFE);
    cur.score += (e.header ? HEADER_WEIGHT : PROSE_WEIGHT) * recency;
    acc.set(e.title, cur);
  }
  return [...acc.entries()]
    .map(([title, v]) => ({
      title,
      daysAgo: v.freshest,
      score: v.score + DAY_WEIGHT * v.days.size,
    }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

/** "today" / "yesterday" / "3 days ago" — the chip's honest recency word. */
export function freshnessWord(daysAgo: number): string {
  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  return `${daysAgo} days ago`;
}
