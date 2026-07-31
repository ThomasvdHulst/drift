// ---------------------------------------------------------------------------
// The registry for /notes: Drift's public writing journal.
//
// Metadata only. Each note's BODY is its own static route under
// `app/(app)/notes/<slug>/page.tsx`, because a body is JSX and src/lib stays
// React-free and unit-testable (CLAUDE.md §8.5). This file is what the index
// page renders from and what sitemap.ts submits, so the two can never disagree
// about which notes exist.
//
// The registry and the routes CAN drift apart, which is the one real hazard of
// splitting them, so `notes.test.ts` pins every slug to a real page file. This
// codebase has been bitten once by a writer and a reader disagreeing (the
// `sessionKey` fix); the same guard applies here.
//
// Newest first. `date` is the publication date, ISO, and is what the index and
// each page show.
// ---------------------------------------------------------------------------

export interface NoteMeta {
  /** URL segment: /notes/<slug>. Lowercase, hyphens, no leading or trailing dash. */
  slug: string;
  /** <h1> and the <title>. */
  title: string;
  /** The meta description, and the line under the title on the index. */
  description: string;
  /** ISO publication date (YYYY-MM-DD). */
  date: string;
  /** One or two sentences on the index page. Longer than `description`. */
  excerpt: string;
}

export const NOTES: NoteMeta[] = [
  {
    slug: "measuring-a-palette-you-designed-by-eye",
    title: "Measuring a palette I picked by eye",
    description:
      "Drift's colours were chosen by eye and never checked. A contrast audit found 258 pieces of text below the WCAG AA bar. What the fixes were, and what the tests now cover.",
    date: "2026-07-28",
    excerpt:
      "An audit found 258 pieces of text below the contrast bar, most of them from about six repeated decisions. Notes on the fixes and on why two separate checks are needed.",
  },
  {
    slug: "reading-the-news-without-a-news-api",
    title: "Reading the news without a news API",
    description:
      "Drift can wander the articles behind the month's stories without touching a news source, because Wikipedia's editors already maintain a list of them.",
    date: "2026-07-26",
    excerpt:
      "I wanted Drift to cover what is currently happening. A news API was the obvious route and a bad fit, so it reads Wikipedia's own current events pages instead. How that works.",
  },
  {
    slug: "the-endpoint-that-died",
    title: "The endpoint that was switched off",
    description:
      "The API call Drift was designed around returns 403 to everyone outside Wikimedia. What replaced it, and why the replacement turned out to be cheaper.",
    date: "2026-07-22",
    excerpt:
      "Drift needs to know which articles are near the one you are reading. The endpoint built for that question is disabled for external use. What I used instead.",
  },
  {
    slug: "why-drift-exists",
    title: "Why I built Drift",
    description:
      "A short account of what bothered me about ordinary feeds, which parts of them Drift inverts, and which of those choices have worked so far.",
    date: "2026-07-20",
    excerpt:
      "Drift started from a fairly ordinary complaint about feeds, and turned into a set of constraints. What the constraints are and how well they have held up.",
  },
];

/** A note by slug, or null. */
export function noteBySlug(slug: string): NoteMeta | null {
  return NOTES.find((n) => n.slug === slug) ?? null;
}

/** `2026-07-28` as `28 July 2026`. Deterministic (no locale, no timezone), so it
 *  renders the same on the server and in the browser and cannot mismatch on
 *  hydration. Returns the raw string if it is not a plain ISO date. */
export function formatNoteDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[Number(m[2]) - 1];
  if (!month) return iso;
  return `${Number(m[3])} ${month} ${m[1]}`;
}
