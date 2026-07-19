// ---------------------------------------------------------------------------
// Math in Wikipedia extracts (Phase 18 follow-up). The Action API `explaintext`
// extractor renders a `<math>` tag as a flattened-MathML "garble" — each symbol
// on its own deeply-indented line — immediately followed by the TeX annotation
// `{\displaystyle …}`. Raw, that reads like:
//
//     is the equality\n\n  \n    e\n      i\n      π\n    +\n    1\n    =\n    0\n    {\displaystyle e^{i\pi }+1=0}\n\nwhere
//
// which is unreadable, and the stray newlines also corrupt paragraph splitting
// (read-more). `preprocessMath` (server-side) throws away the garble and keeps
// only the LaTeX, wrapped in private-use markers; `splitMath` (client-side) turns
// that marked text into segments the <MathText> component renders with KaTeX.
// Pure + unit-tested; no KaTeX import here (that's client-only).
// ---------------------------------------------------------------------------

/** Private-use markers wrapping a LaTeX fragment inside preprocessed text. */
export const MATH_OPEN = "";
export const MATH_CLOSE = "";

export type MathSegment =
  | { type: "text"; value: string }
  | { type: "math"; value: string };

// A "garble line" is a leftover flattened-MathML token: either whitespace-only,
// or an INDENTED short run (the MathML nesting indents each symbol, e.g. a lone
// "a" under eight spaces). Prose connectors between adjacent inline formulae
// (", and", "with") sit at column 0, so requiring indentation keeps them.
function isGarbleLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return true;
  return /^\s/.test(line) && t.length <= 6;
}

/** Drop the trailing flattened-MathML garble from already-emitted text. */
function stripTrailingGarble(s: string): string {
  const lines = s.split("\n");
  let k = lines.length - 1;
  while (k >= 0 && isGarbleLine(lines[k])) k--;
  return lines.slice(0, k + 1).join("\n").replace(/[ \t]+$/, "");
}

/** Advance past the flattened-MathML garble that follows an annotation. */
function skipLeadingGarble(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    const nl = text.indexOf("\n", i);
    const end = nl === -1 ? text.length : nl;
    if (!isGarbleLine(text.slice(i, end))) break;
    if (nl === -1) {
      i = text.length;
      break;
    }
    i = nl + 1;
  }
  return i;
}

/** Tidy spacing after garble removal without destroying paragraph breaks. */
function normalizeWhitespace(s: string): string {
  return s
    .replace(/[ \t]*\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n") // 3+ newlines → paragraph break
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ +([,.;:)])/g, "$1") // no space before punctuation left by garble removal
    .trim();
}

/**
 * Replace each garble + `{\displaystyle …}` (or `{\textstyle …}`) blob with a
 * clean inline `⟦LaTeX⟧` marker. Non-math text is returned essentially unchanged
 * (a fast path bails when there's no annotation at all). Balanced-brace aware, so
 * nested `{}` in the LaTeX are kept. Safe on any string.
 */
export function preprocessMath(text: string): string {
  if (!text || (!text.includes("\\displaystyle") && !text.includes("\\textstyle"))) {
    return text;
  }
  // MediaWiki wraps inline math in invisible word-joiner / math-operator chars
  // (U+2060–U+2064); strip them so they don't clutter the text between formulae.
  text = text.replace(/[⁠-⁤]/g, "");
  const re = /\{\\(?:displaystyle|textstyle)\s?/g;
  let out = "";
  let i = 0;
  while (i < text.length) {
    re.lastIndex = i;
    const m = re.exec(text);
    if (!m) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, m.index);
    // Walk balanced braces from the opening `{` to find the annotation's end.
    let depth = 0;
    let close = -1;
    for (let j = m.index; j < text.length; j++) {
      const ch = text[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          close = j;
          break;
        }
      }
    }
    if (close === -1) {
      out += text.slice(m.index); // unbalanced — leave the rest untouched
      break;
    }
    const latex = text.slice(m.index + m[0].length, close).trim();
    out = stripTrailingGarble(out);
    if (latex) out += ` ${MATH_OPEN}${latex}${MATH_CLOSE} `;
    i = skipLeadingGarble(text, close + 1);
  }
  return normalizeWhitespace(out);
}

/** Split preprocessed text into plain-text and math segments for rendering. */
export function splitMath(text: string): MathSegment[] {
  const segs: MathSegment[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf(MATH_OPEN, i);
    if (open === -1) {
      segs.push({ type: "text", value: text.slice(i) });
      break;
    }
    if (open > i) segs.push({ type: "text", value: text.slice(i, open) });
    const close = text.indexOf(MATH_CLOSE, open + 1);
    if (close === -1) {
      segs.push({ type: "text", value: text.slice(open + 1) });
      break;
    }
    segs.push({ type: "math", value: text.slice(open + 1, close) });
    i = close + 1;
  }
  return segs;
}

/** True if the (preprocessed) text contains at least one math marker. */
export function hasMath(text: string): boolean {
  return text.includes(MATH_OPEN);
}

/** Drop the invisible math markers, leaving the LaTeX source inline. For plain-
 *  text contexts that don't render KaTeX (e.g. a shared-card preview). */
export function stripMathMarkers(text: string): string {
  return text.split(MATH_OPEN).join("").split(MATH_CLOSE).join("");
}
