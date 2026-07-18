// Pure arXiv helpers (no network — the server adapter fetches Atom XML and calls
// these). Kept separate from server/arxiv.ts so the parser + normalizers are
// unit-testable without importing server-only fetch code (CLAUDE.md §5).
//
// Only arXiv's DESCRIPTIVE METADATA is used (title, abstract, authors, categories)
// — dedicated to the public domain under CC0 1.0, so it is 100% free to display,
// remix, and store. We never rehost the PDF/source; the card links out to arXiv.

import type { Card, RelatedCandidate } from "../types";
import {
  categoryGroupOf,
  FIELD_STYLES,
  type FieldGroup,
  type MotifId,
} from "./arxiv.categories";

export interface ArxivEntry {
  id: string; // bare arXiv id (version stripped) — the native id / seen key
  idVersioned: string; // id with version, for the canonical links
  title: string;
  summary: string; // the CC0 abstract, whitespace-normalized
  authors: string[];
  primaryCategory?: string;
  categories: string[];
  published?: string; // ISO date string
  absUrl: string; // https://arxiv.org/abs/<id> (canonical, link-back)
  pdfUrl: string; // https://arxiv.org/pdf/<id> (linked, never rehosted)
}

// ----- Atom parsing -----------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&"); // last, so we don't double-decode
}

function whitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Collapse the newlines + runs of spaces arXiv wraps text with (used for plain
// fields like author names).
function collapse(s: string): string {
  return whitespace(decodeEntities(s));
}

// "detex-lite": arXiv titles/abstracts carry inline LaTeX ($N$, \textit{...},
// \ldots). We can't render math, but stripping the worst delimiters/commands
// makes the prose readable without changing its meaning (§2.5 — reshape, never
// invent). Conservative on purpose: unwrap text-formatting commands, drop math
// `$` delimiters (keep the content), unescape common chars, map ellipses. Genuine
// symbols we don't recognize are left untouched.
function detexLite(s: string): string {
  return s
    .replace(
      /\\(?:textit|textbf|textsc|texttt|emph|text|mathrm|mathbf|mathit|mathcal)\{([^{}]*)\}/g,
      "$1",
    )
    .replace(/\$\$?/g, "") // drop math delimiters, keep the content
    .replace(/\\(?:ldots|dots|cdots)/g, "\u2026")
    .replace(/\\([{}%&_#])/g, "$1") // unescape \{ \} \% \& \_ \#
    .replace(/~/g, " "); // LaTeX non-breaking space
}

// Decode entities, strip inline LaTeX, then collapse whitespace — for the title
// and abstract (the reader-facing prose).
function cleanText(s: string): string {
  return whitespace(detexLite(decodeEntities(s)));
}

function firstTag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : undefined;
}

/** Parse an arXiv Atom feed into entries. Tolerant by design: a malformed or
 *  error entry (arXiv returns one titled "Error" for a bad query) is dropped by
 *  isUsableEntry downstream. Pure + regex-based, so no XML dependency. */
export function parseArxivAtom(xml: string): ArxivEntry[] {
  const blocks = xml.match(/<entry\b[\s\S]*?<\/entry>/g) ?? [];
  const out: ArxivEntry[] = [];
  for (const block of blocks) {
    const rawId = (firstTag(block, "id") ?? "").trim();
    // The id is a URL like http://arxiv.org/abs/2401.01234v1 (or .../abs/hep-th/9901001v1).
    const afterAbs = rawId.split("/abs/")[1] ?? rawId.split("/").pop() ?? "";
    const idVersioned = afterAbs.trim();
    const id = idVersioned.replace(/v\d+$/, "");
    const title = cleanText(firstTag(block, "title") ?? "");
    const summary = cleanText(firstTag(block, "summary") ?? "");
    const authors = [...block.matchAll(/<name>([\s\S]*?)<\/name>/g)]
      .map((m) => collapse(m[1]))
      .filter(Boolean);
    const primaryCategory = block.match(
      /<arxiv:primary_category\b[^>]*\bterm="([^"]+)"/,
    )?.[1];
    const categories = [
      ...block.matchAll(/<category\b[^>]*\bterm="([^"]+)"/g),
    ].map((m) => m[1]);
    const published = firstTag(block, "published")?.trim();

    const altHref = block.match(
      /<link\b[^>]*\brel="alternate"[^>]*\bhref="([^"]+)"/,
    )?.[1];
    const pdfHref = block.match(
      /<link\b[^>]*\btitle="pdf"[^>]*\bhref="([^"]+)"/,
    )?.[1];
    const absUrl = (altHref || `https://arxiv.org/abs/${idVersioned}`).replace(
      /^http:/,
      "https:",
    );
    const pdfUrl = (pdfHref || `https://arxiv.org/pdf/${idVersioned}`).replace(
      /^http:/,
      "https:",
    );

    out.push({
      id,
      idVersioned,
      title,
      summary,
      authors,
      primaryCategory,
      categories: categories.length ? categories : primaryCategory ? [primaryCategory] : [],
      published,
      absUrl,
      pdfUrl,
    });
  }
  return out;
}

/** Usable as a card? A real id + title + abstract (drops arXiv error entries). */
export function isUsableEntry(e: ArxivEntry | null | undefined): e is ArxivEntry {
  return (
    !!e &&
    !!e.id &&
    !e.id.includes("api/errors") &&
    !!e.title.trim() &&
    !!e.summary.trim()
  );
}

// ----- cover styling ----------------------------------------------------------

export interface PaperCoverSpec {
  hue: string;
  motif: MotifId;
  seed: number;
}

// djb2 → a small, stable, non-negative seed. Same id ⇒ same cover (so a paper's
// generated cover is deterministic), different ids ⇒ different motif placements.
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h % 100000;
}

/** The generated, field-themed cover for a paper: a hue + motif from its field
 *  group, seeded by its id. Pure + deterministic (the component draws it). */
export function paperCover(group: FieldGroup, seedId: string): PaperCoverSpec {
  const style = FIELD_STYLES[group] ?? FIELD_STYLES.other;
  return { hue: style.hue, motif: style.motif, seed: hashSeed(seedId) };
}

// ----- mappers ----------------------------------------------------------------

function paperYear(e: ArxivEntry): string | undefined {
  return e.published?.slice(0, 4);
}

// "Author, Author · 2024" (first 3 authors, then "et al.").
function paperDescription(e: ArxivEntry): string | undefined {
  const names = e.authors.slice(0, 3).join(", ");
  const authorLine = e.authors.length > 3 ? `${names}, et al.` : names;
  const year = paperYear(e);
  return [authorLine, year].filter(Boolean).join(" · ") || undefined;
}

/** The "museum label" rows for a paper (Phase 14 pattern), reading order,
 *  skipping anything missing. Includes an honest preprint status (§2.5). */
export function arxivFacts(e: ArxivEntry): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value?: string | null) => {
    const v = (value ?? "").trim();
    if (v) rows.push({ label, value: v });
  };
  const group = categoryGroupOf(e.primaryCategory ?? e.categories[0]);
  if (e.authors.length) push("Authors", e.authors.join(", "));
  push("Field", FIELD_STYLES[group].label);
  if (e.categories.length) push("Categories", e.categories.join(", "));
  push("Submitted", e.published?.slice(0, 10));
  push("Status", "Preprint · not peer reviewed");
  return rows;
}

export function arxivToCard(e: ArxivEntry): Card {
  const group = categoryGroupOf(e.primaryCategory ?? e.categories[0]);
  return {
    pageTitle: e.id,
    displayTitle: e.title || e.id,
    description: paperDescription(e),
    extract: e.summary, // the full CC0 abstract
    sourceUrl: e.absUrl,
    source: "arxiv",
    facts: arxivFacts(e),
    cover: paperCover(group, e.id),
  };
}

/** A faceted related candidate (for "More in {category}" / "More by {author}").
 *  Carries facts + cover so a pulled thread lands on a full paper card. */
export function arxivToCandidate(
  e: ArxivEntry,
  threadLabel: string,
  facet: string,
  eyebrow?: string,
): RelatedCandidate {
  const group = categoryGroupOf(e.primaryCategory ?? e.categories[0]);
  return {
    pageTitle: e.id,
    displayTitle: e.title || e.id,
    description: paperDescription(e),
    extract: e.summary,
    source: "arxiv",
    sourceUrl: e.absUrl,
    threadLabel,
    facet,
    ...(eyebrow ? { eyebrow } : {}),
    facts: arxivFacts(e),
    cover: paperCover(group, e.id),
  };
}
