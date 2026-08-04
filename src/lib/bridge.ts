import { cleanArticleHtml, elementEnd, htmlToText } from "./wikihtml";
import type { Bridge } from "./types";

// ---------------------------------------------------------------------------
// "The bridge" (Phase 28) — the sentence in which the article you are reading
// links to the one a thread would take you to. Pure: no network, no DOM. The
// server route fetches the lead HTML and calls this; the chip quotes what comes
// back.
//
// WHY IT EXISTS. Threads come from `morelike:`, a similarity search, so until
// now not even the app knew *why* a chip was there: `threads.ts` infers a
// direction from title and description overlap and honestly falls back to
// "Nearby" when the inference is weak. That is a good-faith stand-in for an
// answer, and principle §2.1 asks for the answer. An article's own lead already
// contains it, written by the people who wrote the article: "The boundary of no
// escape is called the event horizon." Quoting that turns a recommendation into
// a citation, which is close to the opposite of a slot machine.
//
// THE HONESTY RULES, and why each one is not negotiable:
//   • Whole sentences only, never truncated. A cut quote is a misquote, and the
//     card's whole claim is that this is what the source says. A sentence too
//     long to show is simply not shown (measured: leads carry both 54-character
//     gems and 434-character monsters, and the monsters are unreadable on a
//     chip).
//   • A sentence is quoted once per CARD, but that rule lives in threads.ts,
//     where the three chips are actually chosen. It was here first, over all
//     twenty candidates, and that was wrong in a way worth recording: Octopus's
//     lead explains Squid, Cephalopod and Cuttlefish in one line, so the line
//     went to Squid (rank 0) and Cephalopod (rank 1) was left bare — and
//     Cephalopod is the one the reader is shown, because it is the zoom-out.
//     Suppressing a quote for a candidate that never appears explains nothing.
//   • A sentence the reader can already see on the card is a weak explanation,
//     so one from further down the lead wins when both exist. It is a
//     preference, not a filter: the definition sentence is still better than no
//     bridge at all.
// ---------------------------------------------------------------------------

/** One link found in an article's lead, with the sentence it sits in. */
export interface LeadLink {
  /** The linked page's title, as the article's href spells it (underscores
   *  already turned back into spaces). May be a redirect; see `pickBridges`. */
  target: string;
  /** The words that carry the link ("the analytical engine"). */
  anchor: string;
  /** The whole sentence the link sits in. */
  sentence: string;
}

/** A lead is a handful of paragraphs; anything past this is a parse gone wrong,
 *  and we would rather do bounded work than trust the input. */
const MAX_LEAD_LINKS = 400;

/** MediaWiki namespaces that are never reading content. An article title MAY
 *  contain a colon ("Iron Man 2: The Video Game"), so this is a prefix list
 *  rather than "reject anything with a colon". */
const NAMESPACE =
  /^(file|image|media|help|wikipedia|category|template|special|portal|talk|user|mediawiki|module|draft|book|timedtext)$/i;

const INTERNAL_LINK = /<a\b[^>]*href="\/wiki\/([^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;

/**
 * Every internal link in the lead's paragraphs, each with the sentence it
 * appears in, in reading order.
 *
 * Paragraphs only, walked the way `htmlBlocks` walks them: a `<p>` scan steps
 * over the infobox and the navigation tables for free, and those are exactly the
 * links that would produce a bridge quoting nothing ("United States", "1815").
 */
export function leadLinks(html: string): LeadLink[] {
  const clean = cleanArticleHtml(html);
  const out: LeadLink[] = [];
  const re = /<p\b[^>]*>/gi;
  let i = 0;
  for (;;) {
    if (out.length >= MAX_LEAD_LINKS) break;
    re.lastIndex = i;
    const m = re.exec(clean);
    if (!m) break;
    const end = elementEnd(clean, m.index, "p");
    const inner = clean
      .slice(m.index, end)
      .replace(/^<p\b[^>]*>/i, "")
      .replace(/<\/p\s*>$/i, "");
    i = end;
    const text = htmlToText(inner);
    if (!text) continue;
    for (const link of inner.matchAll(INTERNAL_LINK)) {
      const target = decodeTarget(link[1]);
      if (!target) continue;
      const anchor = htmlToText(link[2]);
      if (!anchor) continue; // an image link, or a link we emptied while cleaning
      const sentence = sentenceAround(text, anchor);
      if (sentence) out.push({ target, anchor, sentence });
    }
  }
  return out;
}

/** An href's page title, or "" for anything that is not an article. */
function decodeTarget(raw: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw; // a malformed escape is not worth throwing over
  }
  const title = decoded.replace(/_/g, " ").trim();
  const colon = title.indexOf(":");
  if (colon > 0 && NAMESPACE.test(title.slice(0, colon))) return "";
  return title;
}

// Tokens that end in a period without ending a sentence. Kept short and
// concrete: every entry here is one that turned up in real lead paragraphs.
const ABBREVIATIONS = new Set([
  "c", "ca", "circa", "e.g", "i.e", "cf", "vs", "st", "mt", "mr", "mrs", "ms",
  "dr", "prof", "rev", "gen", "col", "sgt", "jr", "sr", "no", "nos", "fig",
  "approx", "est", "etc", "al", "vol", "ed", "eds", "pp", "op", "ft", "in",
  "km", "kg", "lb", "oz", "inc", "ltd", "co", "corp", "dept", "univ",
]);

/**
 * Where each sentence ends in `text`: the index just past a `.`, `!` or `?` that
 * genuinely closes one.
 *
 * The naive rule (any period followed by a capital) breaks a lead on every "c.
 * 1815", "e.g." and "J. R. R. Tolkien", which is how a quote ends up starting
 * mid-clause. So a mark is only a boundary when whitespace and a capital follow
 * AND the token before it is neither a single letter (an initial) nor a known
 * abbreviation.
 */
function boundaries(text: string): number[] {
  const out: number[] = [];
  const re = /[.!?]["'’)\]]?(?=\s+["'“([]?[A-Z0-9])/g;
  for (const m of text.matchAll(re)) {
    const at = m.index;
    // Only a LETTER token can be an initial or an abbreviation. Requiring one
    // was a bug with teeth: Octopus opens "…of the order Octopoda (/ɒkˈtɒpədə/,
    // ok-TOP-ə-də)." and Ada Lovelace's lead has sentences ending in a year, and
    // in both cases the character before the full stop is a bracket or a digit,
    // so the guard found no token, read that as "an initial", and refused the
    // boundary. The whole paragraph then merged into one 400-character
    // "sentence" and every bridge in it was thrown away for being too long.
    const token = /([A-Za-z]+)\.?$/.exec(text.slice(Math.max(0, at - 14), at))?.[1];
    if (token) {
      const word = token.toLowerCase();
      if (word.length <= 1 || ABBREVIATIONS.has(word)) continue;
    }
    out.push(at + m[0].length);
  }
  return out;
}

/** Case-insensitive fallback, because a link's anchor is often lower-cased in
 *  running text while the sentence starts with it capitalised. */
function indexOfPhrase(text: string, phrase: string): number {
  const exact = text.indexOf(phrase);
  if (exact >= 0) return exact;
  return text.toLowerCase().indexOf(phrase.toLowerCase());
}

/** The whole sentence of `text` containing `phrase`, or null if it is not there. */
export function sentenceAround(text: string, phrase: string): string | null {
  if (!text || !phrase) return null;
  const at = indexOfPhrase(text, phrase);
  if (at < 0) return null;
  const marks = boundaries(text);
  let start = 0;
  let end = text.length;
  for (const b of marks) {
    if (b <= at) start = b;
    else if (b > at + phrase.length - 1) {
      end = b;
      break;
    }
  }
  const sentence = text.slice(start, end).trim();
  return sentence || null;
}

export interface BridgeOptions {
  /** Text the reader can already see on the card. A sentence they are looking at
   *  explains nothing, so one they cannot wins when both are available. */
  avoid?: string;
  minLength?: number;
  maxLength?: number;
}

/** Short enough and long enough to be worth a chip. Both measured against real
 *  leads: below 40 characters a "sentence" is usually a stray fragment, above
 *  200 it is the four-clause monster that Bauhaus opens with. */
const MIN_LENGTH = 40;
const MAX_LENGTH = 200;

const norm = (s: string): string => s.replace(/_/g, " ").trim().toLowerCase();

/** A sentence's identity for the used-once rule: whitespace and case removed, so
 *  the same line reached through two different anchors counts as one. */
const sentenceKey = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * The best available bridge for each requested title, or no entry at all.
 *
 * Every title is answered independently: which of them the reader will actually
 * be shown is decided later, by `classifyThreads`, and that is also where two
 * chips are stopped from quoting the same line (see the header).
 *
 * ⚠️ A lead link that points at a REDIRECT does not match its canonical title
 * ("octopuses" → Octopus), so a few bridges are missed. Resolving them costs
 * another batched call for something that is already a bonus, so it is not done.
 */
export function pickBridges(
  titles: string[],
  links: LeadLink[],
  opts: BridgeOptions = {},
): Map<string, Bridge> {
  const min = opts.minLength ?? MIN_LENGTH;
  const max = opts.maxLength ?? MAX_LENGTH;
  const visible = sentenceKey(opts.avoid ?? "");

  const byTarget = new Map<string, LeadLink[]>();
  for (const link of links) {
    const key = norm(link.target);
    const list = byTarget.get(key);
    if (list) list.push(link);
    else byTarget.set(key, [link]);
  }

  const out = new Map<string, Bridge>();
  for (const title of titles) {
    const usable = (byTarget.get(norm(title)) ?? []).filter(
      (l) => l.sentence.length >= min && l.sentence.length <= max,
    );
    if (usable.length === 0) continue;
    usable.sort(
      (a, b) =>
        Number(onScreen(a, visible)) - Number(onScreen(b, visible)) ||
        a.sentence.length - b.sentence.length,
    );
    const best = usable[0];
    out.set(title, { sentence: best.sentence, anchor: best.anchor });
  }
  return out;
}

/** A sentence's identity for the quoted-once rule, exported so the chip
 *  selection can apply it over the three it actually shows. */
export const bridgeKey = sentenceKey;

/** Is this sentence part of what the card is already showing? Compared on a
 *  normalized prefix, because the card's extract comes from a different endpoint
 *  and differs in whitespace and punctuation details. */
function onScreen(link: LeadLink, visible: string): boolean {
  if (!visible) return false;
  const key = sentenceKey(link.sentence);
  return key.length > 0 && visible.includes(key.slice(0, 60));
}
