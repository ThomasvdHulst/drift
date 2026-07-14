// ---------------------------------------------------------------------------
// "Read more" body-text extraction (pure — no network here; the route fetches).
//
// The card's default extract is the intro's first ~3 sentences; "Read more"
// wants the first several BODY paragraphs so a reader can keep going without
// leaving for Wikipedia. The Action API's `exchars` is hard-capped at ~1200
// chars (< a typical lead) and `exsentences` at 10, so neither can exceed the
// lead — the only way to get body paragraphs is the FULL plaintext extract
// (`explaintext` with no `exintro`). We fetch it with `exsectionformat=wiki`,
// which renders section headers as `== Heading ==` markup, then drop those
// heading lines and keep the first N paragraphs (the user wants continuous
// prose, no headings). This slicing lives here so the route ships a small
// payload instead of the whole (often 30k+ char) article.
// ---------------------------------------------------------------------------

// A `== Heading ==` / `=== Sub-heading ===` line from `exsectionformat=wiki`.
const HEADING_RE = /^\s*=+.*=+\s*$/;

// Belt-and-suspenders: some responses can carry raw section control chars
// (RS \x1e / US \x1f) instead of wiki markup; strip them if present.
const CONTROL_RE = /[\x1e\x1f]/g;

export interface TopParagraphs {
  text: string; // the kept paragraphs, joined by blank lines
  hasMore: boolean; // were there more paragraphs we didn't include?
}

export interface TopParagraphsOptions {
  maxParagraphs?: number; // default 8
  maxChars?: number; // default 3500
}

/**
 * Take the first few body paragraphs from a full plaintext extract.
 * Drops blank lines and `== Heading ==` markup, then accumulates whole
 * paragraphs until either `maxParagraphs` or `maxChars` is reached (whichever
 * comes first). Always keeps at least the first paragraph if one exists.
 * `hasMore` is true when qualifying paragraphs remained beyond what we kept —
 * it drives the card's "there's more on Wikipedia" fade.
 */
export function topParagraphs(
  raw: string,
  opts: TopParagraphsOptions = {},
): TopParagraphs {
  const maxParagraphs = opts.maxParagraphs ?? 8;
  const maxChars = opts.maxChars ?? 3500;

  const paragraphs = (raw ?? "")
    .split("\n")
    .map((line) => line.replace(CONTROL_RE, "").trim())
    .filter((line) => line.length > 0 && !HEADING_RE.test(line));

  const kept: string[] = [];
  let chars = 0;
  let hasMore = false;
  for (const p of paragraphs) {
    if (kept.length >= maxParagraphs || chars >= maxChars) {
      hasMore = true; // we stopped on a cap with paragraphs still to go
      break;
    }
    kept.push(p);
    chars += p.length;
  }

  return { text: kept.join("\n\n"), hasMore };
}
