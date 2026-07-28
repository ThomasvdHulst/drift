// ---------------------------------------------------------------------------
// Wikipedia article HTML → ordered reading blocks (Phase 26). Pure: no network,
// no DOM, no dependency. The route fetches (`action=parse&prop=text`), this turns
// the markup into data, and the card renders that data as React elements — so no
// Wikipedia HTML is ever injected into the page (there is no sanitizer in this
// codebase and there does not need to be one).
//
// WHY IT EXISTS. A card's body used to come from `prop=extracts&explaintext`,
// which keeps prose and silently throws away everything else. A paragraph reading
// "as the table below shows" therefore arrived with no table anywhere, and the
// infobox — where a lot of a page's actual answers live — never appeared at all.
// Parsing the real HTML instead means a table can sit exactly where the prose
// refers to it.
//
// LICENSING. Tables, infoboxes and paragraphs are all the same CC BY-SA 4.0
// article text, covered by the card's link to the article (whose history credits
// the authors) plus the licence notice beside it (see lib/licenses.ts). Images
// are NOT: a file in an article may be non-free, so `<img>` is dropped from every
// cell rather than reused. That is a licensing decision, not a layout one — do
// not "improve" it by rendering cell images.
//
// The style here follows lib/realms/arxiv.ts (regex Atom parsing, "so no XML
// dependency") and lib/mathtext.ts: small functions, one job each, unit-tested.
// ---------------------------------------------------------------------------

import { preprocessMath, MATH_OPEN, MATH_CLOSE } from "./mathtext";

// ----- shapes ---------------------------------------------------------------

export interface TableCell {
  text: string;
  /** A `<th>`: the column head, or a row's leading label cell. */
  header?: boolean;
  colSpan?: number;
  rowSpan?: number;
}

export interface CardTableData {
  /** The table's own `<caption>`, else the section it was found in. */
  caption?: string;
  /** Header row first when `headerRow` is true. */
  rows: TableCell[][];
  headerRow: boolean;
  /** Pre-cap sizes, so the card can say honestly what it left out. */
  totalRows: number;
  totalCols: number;
  /** This table had images in it and they are not being shown. The card says so:
   *  a Wikipedia table can introduce itself with "…with images of the reference
   *  minerals in the rightmost column", and a reader hunting for a column that we
   *  removed on licensing grounds deserves to be told, not left puzzled. */
  imagesOmitted?: boolean;
}

export type Block =
  | { kind: "p"; text: string }
  | { kind: "table"; table: CardTableData };

export interface Fact {
  label: string;
  value: string;
}

// ----- caps -----------------------------------------------------------------
// A card is a calm read, not a data browser: a table is shown so the sentence
// next to it makes sense, and the footer links the full one on Wikipedia.

const MAX_TABLE_ROWS = 10; // data rows, excluding the header row
const MAX_TABLE_COLS = 6;
// Wider than this and it is not a table a card can carry: the periodic table's
// own grid comes back 19 columns wide. Columns can only be capped safely when no
// cell spans (capping a spanned grid corrupts its shape), so a very wide spanned
// table is refused outright and the card's link to the article carries it.
const MAX_SPANNED_COLS = 10;
const MAX_CELL_CHARS = 140;
const MAX_FACTS = 10;
const MAX_FACT_CHARS = 120;
const MAX_SPAN = 8; // clamp colspan/rowspan; a bigger one is broken markup

// ----- entities + tags ------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  ndash: "–",
  mdash: "—",
  minus: "−",
  times: "×",
  middot: "·",
  bull: "•",
  deg: "°",
  prime: "′",
  Prime: "″",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  shy: "",
};

/**
 * Decode the entities MediaWiki's HTML actually uses: mostly numeric
 * (`&#160;`, `&#x2032;`) plus a handful of named ones. (arxiv.ts has a private
 * near-twin of this for Atom feeds; deliberately not merged, so a working realm
 * stays untouched by this phase.)
 */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) =>
      name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : m,
    );
}

/** Where the element opening at `from` ends (index just past its close tag).
 *  Depth-aware, because tables and divs nest. Returns the string length when the
 *  markup is unbalanced, so a caller always makes progress. */
export function elementEnd(html: string, from: number, tag: string): number {
  const open = new RegExp(`<${tag}\\b`, "gi");
  const close = new RegExp(`</${tag}\\s*>`, "gi");
  let depth = 0;
  let i = from;
  for (;;) {
    open.lastIndex = i;
    close.lastIndex = i;
    const o = open.exec(html);
    const c = close.exec(html);
    if (!c) return html.length; // unbalanced
    if (o && o.index < c.index) {
      depth++;
      i = o.index + o[0].length;
      continue;
    }
    depth--;
    i = c.index + c[0].length;
    if (depth <= 0) return i;
  }
}

/** Drop every `<tag …>…</tag>` element, optionally only those whose OPEN TAG
 *  passes `test` (used to drop junk by class while keeping the rest).
 *
 *  An element that fails the test is stepped INTO, not over: a lead section is one
 *  big `<div class="mw-parser-output">`, and skipping past a kept element would
 *  skip its whole subtree with it, leaving every nested hatnote and short
 *  description in place (it did, until a test caught it). */
function dropElements(
  html: string,
  tag: string,
  test?: (openTag: string) => boolean,
): string {
  const re = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  let out = "";
  let i = 0;
  for (;;) {
    re.lastIndex = i;
    const m = re.exec(html);
    if (!m) return out + html.slice(i);
    if (test && !test(m[0])) {
      const afterOpen = m.index + m[0].length;
      out += html.slice(i, afterOpen);
      i = afterOpen; // keep looking inside this one
      continue;
    }
    out += html.slice(i, m.index);
    i = elementEnd(html, m.index, tag);
  }
}

const classOf = (openTag: string): string =>
  /class="([^"]*)"/i.exec(openTag)?.[1] ?? "";

const hasClass = (openTag: string, re: RegExp): boolean => re.test(classOf(openTag));

/** Flatten a fragment to reading text: `<br>` becomes a space, every other tag
 *  disappears, entities decode, whitespace collapses. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div|li|tr|dd|dt)>/gi, " ")
      .replace(/<[^>]*>/g, ""),
  )
    .split(IMG_MARK)
    .join("")
    .replace(/\s+/g, " ")
    .replace(/ ([,.;:!?)])/g, "$1")
    .trim();
}

// ----- math -----------------------------------------------------------------

/**
 * Replace each `<span class="mwe-math-element">…</span>` with the LaTeX it
 * carries, wrapped in the markers `<MathText>` already renders with KaTeX.
 *
 * This is where HTML beats the plaintext extractor outright. MediaWiki gives the
 * TeX twice in machine-readable form — `<annotation encoding="application/x-tex">`
 * and the fallback image's `alt` — both spelled `{\displaystyle …}`, which is
 * exactly the string `preprocessMath` was written to convert. So math costs no new
 * logic, and the flattened-MathML "garble" that preprocessMath has to clean up
 * after `explaintext` never even appears.
 */
export function replaceMath(html: string): string {
  const re = /<span\b[^>]*class="[^"]*\bmwe-math-element\b[^"]*"[^>]*>/gi;
  let out = "";
  let i = 0;
  for (;;) {
    re.lastIndex = i;
    const m = re.exec(html);
    if (!m) return out + html.slice(i);
    const end = elementEnd(html, m.index, "span");
    const inner = html.slice(m.index, end);
    const tex =
      /<annotation\b[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>/i
        .exec(inner)?.[1] ??
      /class="[^"]*\bmwe-math-fallback-image[^"]*"[^>]*alt="([^"]*)"/i.exec(inner)?.[1] ??
      "";
    out += html.slice(i, m.index) + marker(decodeEntities(tex).trim());
    i = end;
  }
}

/** A math marker for one TeX fragment. `preprocessMath` handles the usual
 *  `{\displaystyle …}` wrapper; bare TeX is marked directly. */
function marker(tex: string): string {
  if (!tex) return "";
  const pre = preprocessMath(tex);
  if (pre.includes(MATH_OPEN)) return ` ${pre.trim()} `;
  return ` ${MATH_OPEN}${tex}${MATH_CLOSE} `;
}

// ----- cleaning -------------------------------------------------------------

// Containers that are chrome, not reading: maintenance notices, navigation,
// "not to be confused with" hatnotes, the short description, edit links, figures
// (their images are not ours to reuse), and inline TemplateStyles CSS — which is
// the one that MUST go first: `<style>` blocks live INSIDE table cells, so
// stripping tags without removing them first pours raw CSS into the card.
const JUNK_DIV = /\b(hatnote|shortdescription|navigation-not-searchable|mw-editsection|reflist|refbegin|navbox|metadata|ambox|asbox|stub|thumb|thumbinner|quotebox|sistersitebox|side-box|mw-collapsible-toggle|noprint|mbox|toc)\b/i;
// `geo-nondefault` + `geo-multi-punct` are the SECOND and third spellings of a
// coordinate ("40°42′21″N 73°59′47″W / 40.7057°N 73.9964°W / 40.7057; -73.9964").
// Dropping them leaves the readable degrees form, which is what an infobox row
// should say.
const JUNK_SPAN =
  /\b(mw-editsection|cite-bracket|mw-reflink-text|sortkey|mw-invert|geo-nondefault|geo-multi-punct)\b/i;
// MediaWiki's own error messages, which a reader must never see. The one that
// actually turned up: parsing a section on its own leaves the footnote group
// without its list, so the section HTML ends with `<span class="error
// mw-ext-cite-error">Cite error: There are <ref group=lower-alpha> tags…</span>`.
// Found by running the parser over ten live articles rather than fixtures alone.
const ERROR_CLASS = /\b(error|mw-ext-cite-error|scribunto-error)\b/i;

/** Strip the chrome and normalize the math, leaving prose and real tables. */
export function cleanArticleHtml(html: string): string {
  let out = html;
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = dropElements(out, "style");
  out = dropElements(out, "script");
  out = replaceMath(out); // before tags are stripped, while the annotation exists
  out = dropElements(out, "sup", (t) => hasClass(t, /\b(reference|noprint)\b/i));
  out = dropElements(out, "span", (t) => hasClass(t, JUNK_SPAN));
  for (const tag of ["span", "p", "div", "strong", "code"]) {
    out = dropElements(out, tag, (t) => hasClass(t, ERROR_CLASS));
  }
  // Hidden markup is not reading content. Wikipedia hides alternative spellings of
  // a value this way: an infobox coordinate ships as DMS + decimal + a
  // `display:none` machine form, and without this the card read
  // "40.7057°N 73.9964°W / 40.7057; -73.9964".
  for (const tag of ["span", "div"]) {
    out = dropElements(out, tag, (t) =>
      /style="[^"]*display\s*:\s*none/i.test(t),
    );
  }
  out = dropElements(out, "figure");
  out = dropElements(out, "figcaption");
  out = dropElements(out, "div", (t) => hasClass(t, JUNK_DIV));
  out = dropElements(out, "div", (t) => /role="note"/i.test(t));
  out = out.replace(/<link\b[^>]*>/gi, "");
  // Never reuse a file: it may be non-free. Leaving a marker (rather than nothing)
  // lets a table notice it HAD images, so the card can admit they are missing.
  out = out.replace(/<img\b[^>]*>/gi, IMG_MARK);
  return out;
}

/** Stands in for an image we removed. A C0 control character, so it can never
 *  collide with article text, and `htmlToText` strips it from anything read. */
const IMG_MARK = "";

// ----- tables ---------------------------------------------------------------

// `wikitable` is the strong positive signal for a real data table. These classes
// mean the opposite, whatever else the table carries.
const JUNK_TABLE = /\b(navbox|navbox-inner|vertical-navbox|ambox|metadata|sidebar|infobox|toc|succession-box|mbox-small|nomobile|plainlinks)\b/i;

/** Parse one `<table>…</table>` into card data, or null when it is not a table a
 *  reader wants: navigation/maintenance chrome, a nested-table layout, or too
 *  small to be data. */
export function htmlTable(
  rawTableHtml: string,
  fallbackCaption?: string,
): CardTableData | null {
  const openTag = /^<table\b[^>]*>/i.exec(rawTableHtml)?.[0] ?? "";
  const cls = classOf(openTag);
  if (JUNK_TABLE.test(cls)) return null;
  if (/role="presentation"/i.test(openTag)) return null;
  const isWikitable = /\bwikitable\b/i.test(cls);

  // Clean here as well as in `htmlBlocks`, so this is safe to call on raw markup:
  // a cell can hold TemplateStyles CSS, a footnote or an image, and cleaning is
  // idempotent. Without it a header read "Absolute hardness[13]" and the
  // image-only column looked full.
  const tableHtml = cleanArticleHtml(rawTableHtml);
  const body = tableHtml.replace(/^<table\b[^>]*>/i, "").replace(/<\/table\s*>$/i, "");
  if (/<table\b/i.test(body)) return null; // nested layout table: not worth guessing

  const caption = (() => {
    const m = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(body);
    const text = m ? htmlToText(m[1]) : "";
    return text || fallbackCaption || undefined;
  })();

  const rows: ParsedCell[][] = [];
  const trRe = /<tr\b[^>]*>/gi;
  let i = 0;
  for (;;) {
    trRe.lastIndex = i;
    const m = trRe.exec(body);
    if (!m) break;
    const end = elementEnd(body, m.index, "tr");
    const cells = parseCells(body.slice(m.index, end));
    i = end;
    if (cells.length > 0) rows.push(cells);
  }

  const width = rows.reduce((n, r) => Math.max(n, r.length), 0);
  if (rows.length < 2 || width < 2) return null;
  // An unclassed table is only data if it labels itself with a header cell;
  // otherwise it is almost always being used for layout.
  if (!isWikitable && !rows.some((r) => r.some((c) => c.header))) return null;

  const headerRow = rows[0].every((c) => c.header);
  const dataRows = headerRow ? rows.slice(1) : rows;
  const totalRows = dataRows.length;

  const spanned = rows.some((r) => r.some((c) => c.colSpan || c.rowSpan));
  if (spanned && width > MAX_SPANNED_COLS) return null;
  const kept = [
    ...(headerRow ? [rows[0]] : []),
    ...dataRows.slice(0, MAX_TABLE_ROWS),
  ];
  // Column work (pruning empties, capping width) reads the row arrays as a grid,
  // which is only true without spans. With spans, keep every column and let the
  // card scroll sideways rather than corrupt the shape.
  const pruned = spanned ? kept : pruneEmptyColumns(kept, headerRow);
  // `totalCols` counts the columns that HAVE data, measured after the empties are
  // gone, so the card's footer only ever admits to cutting something a reader
  // could have read. An "Example image" column emptied by our no-images rule is
  // not a column we are hiding from them.
  const totalCols = pruned.reduce((n, r) => Math.max(n, r.length), 0);
  const shaped = spanned ? pruned : capColumns(pruned);
  // Pruning can leave a table with nothing to compare: an "Example image" column
  // beside one label column is not a table once the images are gone.
  if (totalCols < 2) return null;

  // Did this table carry images anywhere (in a column we pruned, or inside a cell
  // we kept)? Measured over ALL rows, not just the ones shown, because the prose
  // can promise images the reader would otherwise hunt for.
  const imagesOmitted = rows.some((r) => r.some((c) => c.hadImage));

  return {
    ...(caption ? { caption } : {}),
    rows: plainCells(shaped),
    headerRow,
    totalRows,
    totalCols,
    ...(imagesOmitted ? { imagesOmitted: true } : {}),
  };
}

/** A cell plus the parse-time fact that it held an image. The flag never reaches
 *  the card: it is summarized as one `imagesOmitted` boolean per table. */
type ParsedCell = TableCell & { hadImage?: boolean };

function parseCells(rowHtml: string): ParsedCell[] {
  const cells: ParsedCell[] = [];
  const re = /<(th|td)\b([^>]*)>/gi;
  let i = 0;
  for (;;) {
    re.lastIndex = i;
    const m = re.exec(rowHtml);
    if (!m) return cells;
    const tag = m[1].toLowerCase();
    const end = elementEnd(rowHtml, m.index, tag);
    const inner = rowHtml
      .slice(m.index, end)
      .replace(/^<(th|td)\b[^>]*>/i, "")
      .replace(/<\/(th|td)\s*>$/i, "");
    cells.push({
      text: clamp(htmlToText(inner), MAX_CELL_CHARS),
      ...(tag === "th" ? { header: true } : {}),
      ...(inner.includes(IMG_MARK) ? { hadImage: true } : {}),
      ...span(m[2], "colspan"),
      ...span(m[2], "rowspan"),
    });
    i = end;
  }
}

/** Strip the parse-time flag, so only card data crosses the wire. */
function plainCells(rows: ParsedCell[][]): TableCell[][] {
  return rows.map((r) =>
    r.map(({ text, header, colSpan, rowSpan }) => ({
      text,
      ...(header ? { header } : {}),
      ...(colSpan ? { colSpan } : {}),
      ...(rowSpan ? { rowSpan } : {}),
    })),
  );
}

function span(attrs: string, name: "colspan" | "rowspan") {
  const raw = new RegExp(`${name}="?(\\d+)`, "i").exec(attrs)?.[1];
  const n = raw ? Math.min(Math.max(parseInt(raw, 10), 1), MAX_SPAN) : 1;
  if (n <= 1) return {};
  return name === "colspan" ? { colSpan: n } : { rowSpan: n };
}

/** Drop columns whose DATA is empty. Usually an "Example image" column, emptied
 *  because we never reuse a file (see the licensing note at the top) — its header
 *  still says "Example image", so the header row cannot be what keeps a column
 *  alive, or every emptied column would survive with nothing under it. */
function pruneEmptyColumns(
  rows: ParsedCell[][],
  headerRow: boolean,
): ParsedCell[][] {
  const width = rows.reduce((n, r) => Math.max(n, r.length), 0);
  const data = headerRow ? rows.slice(1) : rows;
  const keep: number[] = [];
  for (let c = 0; c < width; c++) {
    if (data.some((r) => (r[c]?.text ?? "").length > 0)) keep.push(c);
  }
  if (keep.length === width) return rows;
  // Pad rather than filter, so a ragged row cannot shift the grid sideways.
  return rows.map((r) => keep.map((c) => r[c] ?? { text: "" }));
}

function capColumns(rows: ParsedCell[][]): ParsedCell[][] {
  const width = rows.reduce((n, r) => Math.max(n, r.length), 0);
  if (width <= MAX_TABLE_COLS) return rows;
  return rows.map((r) => r.slice(0, MAX_TABLE_COLS));
}

function clamp(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Tidy the commas left where `<br>`s became separators. */
function tidyList(s: string): string {
  return s
    .replace(/\s*,(\s*,)+/g, ",")
    .replace(/,\s*([),.;])/g, "$1")
    .replace(/^\s*,\s*|\s*,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ----- infobox --------------------------------------------------------------

/**
 * The lead infobox as label/value rows, ready for the card's existing "Details"
 * disclosure (the same shape `artFacts`/`arxivFacts` produce). Handles both
 * modern infoboxes (`th.infobox-label` + `td.infobox-data`) and taxoboxes, which
 * write the label as a plain `<td>` ending in a colon.
 *
 * Skipped: the title row, image rows, captions, and anything without both halves.
 */
export function infoboxFacts(html: string): Fact[] {
  const re = /<table\b[^>]*class="[^"]*\binfobox\b[^"]*"[^>]*>/i;
  const m = re.exec(html);
  if (!m) return [];
  const table = cleanArticleHtml(html.slice(m.index, elementEnd(html, m.index, "table")));

  const facts: Fact[] = [];
  const seen = new Set<string>();
  const trRe = /<tr\b[^>]*>/gi;
  let i = 0;
  for (;;) {
    trRe.lastIndex = i;
    const tr = trRe.exec(table);
    if (!tr) break;
    const end = elementEnd(table, tr.index, "tr");
    const rowHtml = table.slice(tr.index, end);
    i = end;
    if (/\binfobox-(above|image|caption|subheader|header|below|navbar)\b/i.test(rowHtml)) {
      continue;
    }
    // A `<br>` inside an infobox value is a list ("5 lanes of roadway", "bicycles
    // and pedestrians"), so it reads as a comma here rather than the plain space
    // htmlToText uses for prose and table headers.
    const cells = parseCells(rowHtml.replace(/<br\s*\/?>/gi, ", "));
    if (cells.length !== 2) continue;
    const label = cells[0].text.replace(/[:\s]+$/, "");
    const value = clamp(tidyList(cells[1].text), MAX_FACT_CHARS);
    // A taxobox writes its labels as plain cells, so accept a `<td>` label only
    // when it announced itself with a colon.
    const looksLikeLabel = cells[0].header || /:\s*$/.test(cells[0].text);
    if (!looksLikeLabel || !label || !value) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue; // CardView keys facts by label
    seen.add(key);
    facts.push({ label, value });
    if (facts.length >= MAX_FACTS) break;
  }
  return facts;
}

// ----- blocks ---------------------------------------------------------------

/** Article HTML → paragraphs and tables, in the order they are read.
 *  `caption` names the section, used for a table that has no `<caption>`. */
export function htmlBlocks(
  html: string,
  opts: { caption?: string } = {},
): Block[] {
  const clean = cleanArticleHtml(html);
  const blocks: Block[] = [];
  const re = /<(p|table)\b[^>]*>/gi;
  let i = 0;
  for (;;) {
    re.lastIndex = i;
    const m = re.exec(clean);
    if (!m) break;
    const tag = m[1].toLowerCase();
    const end = elementEnd(clean, m.index, tag);
    const el = clean.slice(m.index, end);
    i = end;
    if (tag === "p") {
      const text = htmlToText(el.replace(/^<p\b[^>]*>/i, "").replace(/<\/p\s*>$/i, ""));
      if (text.length > 0) blocks.push({ kind: "p", text });
    } else {
      const table = htmlTable(el, opts.caption);
      if (table) blocks.push({ kind: "table", table });
    }
  }
  return blocks;
}

// ----- the reading budget ---------------------------------------------------

export interface BlockBudget {
  maxParagraphs?: number; // default 8, as lib/extract.ts
  maxChars?: number; // default 3500, as lib/extract.ts
  maxTables?: number; // default 3
}

export interface TakenBlocks {
  blocks: Block[];
  /** More of the article remained: drives the card's soft fade, exactly as
   *  `topParagraphs().hasMore` does for the plaintext path. */
  hasMore: boolean;
}

/**
 * Keep as much of the body as a card should hold. The paragraph caps are the same
 * as the plaintext path's, so on an article without tables the reader sees exactly
 * what they see today.
 *
 * Tables sit OUTSIDE the paragraph and character budget (they have their own
 * count). That is deliberate, and it is what makes "as the table below shows…"
 * resolve: a table immediately after the last paragraph we can afford still comes
 * along, instead of the budget stopping one block short of the thing the reader
 * was just promised.
 */
export function takeBlocks(blocks: Block[], opts: BlockBudget = {}): TakenBlocks {
  const maxParagraphs = opts.maxParagraphs ?? 8;
  const maxChars = opts.maxChars ?? 3500;
  const maxTables = opts.maxTables ?? 3;

  const kept: Block[] = [];
  let paragraphs = 0;
  let chars = 0;
  let tables = 0;
  let hasMore = false;

  for (const b of blocks) {
    if (b.kind === "table") {
      if (tables >= maxTables) {
        hasMore = true; // a table we could not show is still "more on Wikipedia"
        continue;
      }
      kept.push(b);
      tables++;
      continue;
    }
    if (paragraphs >= maxParagraphs || chars >= maxChars) {
      hasMore = true;
      break;
    }
    kept.push(b);
    paragraphs++;
    chars += b.text.length;
  }

  return { blocks: kept, hasMore };
}

/** The kept paragraphs as one string, in the shape the card's plaintext path
 *  expects (`split("\n\n")`). Keeps `extract` populated on every response, so a
 *  failure anywhere downstream still has prose to render. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .filter((b): b is { kind: "p"; text: string } => b.kind === "p")
    .map((b) => b.text)
    .join("\n\n");
}
