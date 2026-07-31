// ---------------------------------------------------------------------------
// A two-rule inline markup parser, for prose that has to render as both HTML and
// Markdown from one source (see lib/terms.ts and DSA Article 14(1)).
//
// The rules are `**strong**` and `[label](href)`, and there are deliberately no
// others: no nesting, no emphasis, no code. Every extra rule is another way for
// the two renderings to disagree, and legal prose needs a lead-in phrase and a
// link and nothing else. Anything unmatched, including a stray `**` or a bracket
// that is not a link, comes through as literal text rather than being swallowed.
// ---------------------------------------------------------------------------

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "link"; text: string; href: string };

// One alternation, so a single pass walks the string in order. `[^\]]` rather
// than a lazy `.` keeps a bracket that never closes from eating the rest of the
// paragraph.
const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Split prose into renderable segments. Never throws; unmatched markup is text. */
export function parseInline(source: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of source.matchAll(INLINE)) {
    const at = m.index;
    if (at > last) out.push({ kind: "text", text: source.slice(last, at) });
    if (m[1] !== undefined) {
      out.push({ kind: "strong", text: m[1] });
    } else {
      out.push({ kind: "link", text: m[2], href: m[3] });
    }
    last = at + m[0].length;
  }
  if (last < source.length) out.push({ kind: "text", text: source.slice(last) });
  return out;
}

/** The same prose with every link made absolute, for a document that will be
 *  read outside the site. App-relative hrefs only; anything already absolute is
 *  left alone. */
export function absolutizeLinks(source: string, origin: string): string {
  return source.replace(
    /\[([^\]]+)\]\((\/[^)\s]*)\)/g,
    (_all, label: string, href: string) => `[${label}](${origin}${href})`,
  );
}
