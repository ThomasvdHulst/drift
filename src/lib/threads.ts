import type { Card, RelatedCandidate, Thread, ThreadKind } from "./types";
import { bridgeKey } from "./bridge";
import { classOf } from "./diversity";
import { cardId } from "./card";
import { isJunk } from "./wiki";

// ---------------------------------------------------------------------------
// "Threads with intention" (Phase 6) — classify Wikipedia `morelike` candidates
// into *directions* so pulling a thread is a deliberate move, not picking from a
// lookalike list. Pure + unit-tested; runs client-side in the Encyclopedia feed
// (Gallery keeps its facet threads). Uses only the current card's text + the
// candidates' title/description/rank — no new API, no AI.
//
// Kinds: deeper (a more specific instance) · zoomout (the broader concept) ·
// tangent (the most lateral neighbour) · nearby (the closest related — the
// honest fallback so there are ALWAYS three labeled chips). A chip only claims a
// direction its signal justifies; otherwise it's `nearby`, never a guess (§2.1).
// ---------------------------------------------------------------------------

/** Lowercase alphanumeric word tokens. */
function words(s: string): string[] {
  return (s ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Does `hay` contain `needle` as a contiguous whole-word phrase? */
function phraseContains(hay: string, needle: string): boolean {
  const n = words(needle).join(" ");
  if (!n) return false;
  const h = ` ${words(hay).join(" ")} `;
  return h.includes(` ${n} `);
}

/** Does `hay`'s word sequence END with `needle` (the head noun)? "Giant Pacific
 *  octopus" ends with "Octopus" (a real hypernym) but not "Pacific" (a modifier). */
function phraseEndsWith(hay: string, needle: string): boolean {
  const h = words(hay).join(" ");
  const n = words(needle).join(" ");
  if (!n) return false;
  return h === n || h.endsWith(` ${n}`);
}

/** The current card's opening sentence, lowercased. */
function firstSentence(text: string): string {
  const t = (text ?? "").trim();
  const m = t.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : t).toLowerCase();
}

// "Species of…", "Genus of…", "Branch of…" — a candidate described as a narrower
// rank/part of something. Combined with a current-title-word match, it marks a
// "go deeper" (a specific instance within the current subject's scope).
const RANK_OF_RE =
  /\b(species|subspecies|genus|type|variety|form|kind|breed|example|subfamily|suborder|family|subclass|order|class|branch|subfield|field|discipline|category|group|member)\s+of\b/i;

/** Candidate is a more specific instance of the current subject. */
export function isDeeper(current: Card, c: RelatedCandidate): boolean {
  if (!c.pageTitle || c.pageTitle === current.pageTitle) return false;
  // Title containment: the candidate title is longer and contains the current
  // title as a phrase ("Octopus" ⊂ "Common octopus").
  if (
    c.displayTitle.length > current.displayTitle.length &&
    phraseContains(c.displayTitle, current.displayTitle)
  ) {
    return true;
  }
  // "…of {current}" description referencing the current topic ("Species of octopus").
  const desc = c.description ?? "";
  if (RANK_OF_RE.test(desc)) {
    const hay = words(`${desc} ${c.extract ?? ""}`);
    for (const w of words(current.displayTitle)) {
      if (w.length >= 4 && hay.includes(w)) return true;
    }
  }
  return false;
}

/** Candidate is the broader concept the current subject sits inside. */
export function isZoomOut(current: Card, c: RelatedCandidate): boolean {
  if (!c.pageTitle || c.pageTitle === current.pageTitle) return false;
  // The candidate is the head noun of the current title — the general term it IS
  // ("Octopus" ends "Giant Pacific octopus" → zoom out; "Pacific" does not).
  if (
    c.displayTitle.length < current.displayTitle.length &&
    phraseEndsWith(current.displayTitle, c.displayTitle)
  ) {
    return true;
  }
  // Candidate appears as a whole word in the current card's first sentence /
  // description ("…is a large marine cephalopod…" → the "Cephalopod" candidate).
  const cWords = words(c.displayTitle);
  if (cWords.length === 0) return false;
  // Require the candidate to read as a general term (single word, or shorter).
  const general =
    cWords.length === 1 || c.displayTitle.length < current.displayTitle.length;
  if (!general) return false;
  // Precision guard: reject when the candidate is just the current title's own
  // words (that's the subject itself, not a hypernym drawn from the prose).
  const curTitleWords = new Set(words(current.displayTitle));
  if (cWords.every((w) => curTitleWords.has(w))) return false;
  const haystack = `${firstSentence(current.extract)} ${(current.description ?? "").toLowerCase()}`;
  return phraseContains(haystack, c.displayTitle);
}

// A candidate-shaped view of the current card, for classOf.
function currentAsCandidate(current: Card): RelatedCandidate {
  return {
    pageTitle: current.pageTitle,
    displayTitle: current.displayTitle,
    description: current.description,
    extract: current.extract,
  };
}

/** The most lateral of the (inherently similar) related set: a candidate whose
 *  description-class diverges from the current's, preferring a further rank. */
function pickTangent(
  current: Card,
  pool: RelatedCandidate[],
  used: Set<string>,
): RelatedCandidate | undefined {
  const curClass = classOf(currentAsCandidate(current));
  let best: RelatedCandidate | undefined;
  let bestRank = -1;
  pool.forEach((c, i) => {
    if (used.has(cardId(c))) return;
    if (classOf(c) !== curClass && i > bestRank) {
      best = c;
      bestRank = i;
    }
  });
  if (best) return best;
  // Fallback: the furthest-rank remaining candidate.
  for (let i = pool.length - 1; i >= 0; i--) {
    if (!used.has(cardId(pool[i]))) return pool[i];
  }
  return undefined;
}

/**
 * Classify related candidates into up to `count` directional threads. Always
 * returns three when the pool has ≥3 usable items (empty direction slots fall
 * back to `nearby`); fewer only for genuinely thin pages. Display order is
 * [deeper, zoomout/nearby, tangent].
 */
/**
 * How far down the relevance ranking a bridge is allowed to promote a candidate.
 *
 * morelike returns its 20 in relevance order and the interesting ones are at the
 * top; without a bound, "Charles Babbage's Saturday night soirées" (bridged,
 * rank 18) would beat "Analytical engine" (unbridged, rank 1) and the feature
 * would be making threads worse in order to make them explainable.
 *
 * Twelve, not eight, from measuring where quotable candidates actually sit: over
 * ten articles, 30 candidates had a usable lead sentence, 19 of them inside the
 * top 8 and 25 inside the top 12. The five beyond it are the tail this bound
 * exists to refuse.
 */
const BRIDGE_WINDOW = 12;

export function classifyThreads(
  current: Card,
  candidates: RelatedCandidate[],
  opts: { seen?: Set<string>; count?: number } = {},
): Thread[] {
  const count = opts.count ?? 3;
  const seen = opts.seen ?? new Set<string>();
  const pool = candidates.filter(
    (c) =>
      c.pageTitle &&
      !seen.has(cardId(c)) &&
      !isJunk({ title: c.pageTitle, extract: c.extract }),
  );
  if (pool.length === 0) return [];

  const used = new Set<string>();
  const take = (c?: RelatedCandidate): RelatedCandidate | undefined => {
    if (c) used.add(cardId(c));
    return c;
  };

  // Among the candidates that satisfy a slot, the one the article itself
  // explains wins (Phase 28). The slot's own test is unchanged, so a "deeper"
  // chip is still deeper — the bridge only breaks a tie, and only inside the
  // relevance window: reaching into the tail of the morelike ranking for a
  // quotable candidate would trade a good thread for an explained bad one.
  const explained = (test: (c: RelatedCandidate) => boolean) => {
    const fits = (c: RelatedCandidate) => !used.has(cardId(c)) && test(c);
    return (
      pool.slice(0, BRIDGE_WINDOW).find((c) => c.bridge && fits(c)) ??
      pool.find(fits)
    );
  };

  const deeper = take(explained((c) => isDeeper(current, c)));
  const zoom = take(explained((c) => isZoomOut(current, c)));
  const tangent = take(pickTangent(current, pool, used));

  const slots: { kind: ThreadKind; cand?: RelatedCandidate }[] = [
    { kind: "deeper", cand: deeper },
    { kind: zoom ? "zoomout" : "nearby", cand: zoom },
    { kind: "tangent", cand: tangent },
  ];
  // Fill any empty slot with the next unused (closest) candidate, as `nearby`.
  for (const slot of slots) {
    if (!slot.cand) {
      const next = explained(() => true);
      if (next) {
        slot.cand = take(next);
        slot.kind = "nearby";
      }
    }
  }

  // One sentence is quoted once per card. An article's lead often explains
  // several of its neighbours in a single line ("…grouped within the class
  // Cephalopoda with squids, cuttlefish, and nautiloids"), and three chips
  // repeating it verbatim would look broken and would say nothing about the
  // difference between them. Applied HERE, over the three actually shown,
  // rather than upstream over all twenty candidates: see lib/bridge.ts for the
  // bug that taught us the difference.
  const quoted = new Set<string>();
  const out: Thread[] = [];
  for (const slot of slots) {
    if (slot.cand && out.length < count) {
      const bridge = slot.cand.bridge;
      const fresh = bridge && !quoted.has(bridgeKey(bridge.sentence));
      if (bridge && fresh) quoted.add(bridgeKey(bridge.sentence));
      out.push({
        candidate: slot.cand,
        label: slot.cand.displayTitle || slot.cand.pageTitle,
        kind: slot.kind,
        ...(fresh ? { bridge } : {}),
      });
    }
  }
  return out;
}

/**
 * Threads minus any pointing at a page this trail ALREADY holds (Phase 30).
 *
 * Threads are chosen against the seen-set at the moment they are fetched, and
 * the result is cached per card. Going back to an earlier stop reuses that
 * cache, so its chips still offer whatever you went on to read AFTER standing
 * there — and pulling one adds the same page to the trail a second time. Before
 * branching that produced a confusing repeat; now it produces two siblings with
 * one title, and a "two ways from here" switch offering the same word twice is
 * simply a lie about the shape of the trail.
 *
 * Filtered against the trail rather than the whole seen-list on purpose. The
 * seen-list spans every session ever, and threads were already selected against
 * it; the only staleness is what THIS trail picked up since. Narrowing to that
 * repairs the leak without quietly emptying the chip row.
 */
export function threadsNotInTrail(
  threads: Thread[],
  steps: { card: Pick<Card, "source" | "pageTitle"> }[],
): Thread[] {
  if (steps.length === 0) return threads;
  const held = new Set(steps.map((s) => cardId(s.card)));
  return threads.filter((t) => !held.has(cardId(t.candidate)));
}
