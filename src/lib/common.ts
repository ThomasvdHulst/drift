// ---------------------------------------------------------------------------
// "The one you never opened" (Phase 28) — the page that several of a trail's
// stops all link to, and the reader never went to.
//
// This is the only thing in Drift that is computed from the SHAPE of a path
// rather than from any single card, which is exactly why it is worth building:
// the encyclopedia belongs to everyone, but the intersection of the four pages
// one person happened to read this evening belongs to nobody else. Measured on
// real trails while designing it: Black hole + Time dilation + GPS all point at
// General relativity; Bauhaus + Graphic design at Form follows function; Ada
// Lovelace + Silk + Sericulture at Yarn.
//
// Pure: the route fetches the link sets, this ranks them. No network, no DOM.
//
// UNDER-ANSWER RATHER THAN ANSWER BADLY. A weak answer here is worse than
// silence: it is the app claiming to have noticed something about your reading
// when it has only noticed that many articles cite ISSNs. Hence a floor of
// three stops, an aggressive junk filter, and callers that render nothing at all
// when this returns nothing.
// ---------------------------------------------------------------------------

import type { TrailStep } from "./types";
import { cardSource } from "./card";
import { engagedWith } from "./doors";

/** One page linked from several of the trail's stops. */
export interface CommonPage {
  title: string;
  /** The stops that link to it, in trail order — the question's subject. */
  from: string[];
}

export interface CommonOptions {
  /** Titles the reader has already seen (this trail and the persistent seen
   *  list). The whole point is a page they did NOT open. */
  visited?: Iterable<string>;
  /** Pages linked from some stop's lead, which the bridge fetch already knows
   *  (Phase 28, lib/bridge.ts). A page an article thought worth mentioning in
   *  its opening lines is a concept, not a citation target; this is what
   *  separates "General relativity" from "Bibcode". */
  lead?: Iterable<string>;
  /** How many stops must link to it. Three is the floor for "several". */
  minStops?: number;
  max?: number;
}

/**
 * Citation infrastructure. Every one of these turned up at 3/4 or 4/4 on real
 * trails, because academic articles cite, and it says precisely nothing about
 * what the reader was reading.
 */
const CITATION =
  /\((identifier|disambiguation)\)$|^(Bibcode|ISSN|ISBN|OCLC|S2CID|PMID|PMC|Doi|DOI|ArXiv|arXiv|Hdl|HDL|JSTOR|Wayback Machine|Internet Archive|Digital object identifier|Library of Congress|WorldCat|Google Books|Semantic Scholar)$/;

/**
 * Too big to mean anything. A trail through European art will "share" France;
 * that is a property of Europe, not of the trail. Deliberately short: over-
 * filtering costs a good answer, and the stop-count floor already does most of
 * the work.
 */
const GENERIC =
  /^(United States|United Kingdom|England|Scotland|Wales|Ireland|France|Germany|Italy|Spain|Netherlands|Belgium|Switzerland|Austria|Russia|China|Japan|India|Canada|Australia|Europe|Asia|Africa|North America|South America|London|Paris|Berlin|New York City|Rome|Latin|Ancient Greek|Greek language|English language|French language|German language|Latin alphabet|World War I|World War II|Christianity|Islam|Judaism)$/;

/** A bare year, decade or century is a date, not an idea. */
const DATELIKE = /^(\d{1,4}(s|st|nd|rd|th)?( (century|BC|AD|BCE|CE))?|\d{1,2}(st|nd|rd|th) century)$/;

const norm = (s: string): string => s.replace(/_/g, " ").trim();

/** Is this a page worth calling an answer? */
export function isMeaningful(title: string): boolean {
  const t = norm(title);
  if (t.length === 0) return false;
  if (CITATION.test(t)) return false;
  if (GENERIC.test(t)) return false;
  if (DATELIKE.test(t)) return false;
  // Namespaces and the list/index pages the feed already refuses as cards.
  if (/^(Wikipedia|Help|Template|Category|Portal|File|Special|Talk|User|Draft|Module|Book):/i.test(t))
    return false;
  if (/^(List of|Lists of|Index of|Outline of|Timeline of|Glossary of)\b/i.test(t))
    return false;
  return true;
}

/**
 * Which stops to ask about.
 *
 * The stops you READ, not every card that went past: a trail's character lives
 * in the handful you stayed with, and the ones you scrolled through would only
 * add noise to the intersection (the same reason they leave no doors). Wikipedia
 * only, because a museum object has no article links. Falls back to the whole
 * trail when nothing was read for long, so a fast session is not silently
 * excluded from the one thing the exit has to say.
 */
export function stopsToProbe(steps: TrailStep[], max = 8): string[] {
  const wiki = steps.filter((s) => cardSource(s.card) === "wikipedia");
  const read = wiki.filter((s) =>
    engagedWith({
      expanded: s.expanded,
      reacted: (s.doorsLeft?.length ?? 0) > 0,
      dwellMs: s.dwellMs,
    }),
  );
  const chosen = read.length >= 3 ? read : wiki;
  // Keep the most recent when trimming: the end of a trail is where it got
  // specific, and the beginning is often a seed the reader did not choose.
  return chosen.slice(-max).map((s) => s.card.pageTitle);
}

/**
 * The pages most of these stops point at and the reader never opened, best
 * first.
 *
 * Ranking, in order: how many stops link to it (a page four of your stops cite
 * is a stronger claim than one two do), then whether some stop thought it
 * important enough to name in its opening lines, then the shorter title — a
 * blunt but surprisingly good proxy for "a concept" over "a specific" ("Yarn"
 * over "History of silk in Calabria").
 */
export function commonPages(
  links: Record<string, string[]>,
  opts: CommonOptions = {},
): CommonPage[] {
  const minStops = opts.minStops ?? 3;
  const max = opts.max ?? 3;
  const visited = new Set([...(opts.visited ?? [])].map(norm));
  const lead = new Set([...(opts.lead ?? [])].map(norm));

  const stopsFor = new Map<string, string[]>();
  for (const [stop, targets] of Object.entries(links)) {
    // One stop cannot vouch for a page twice.
    for (const target of new Set(targets.map(norm))) {
      if (visited.has(target) || !isMeaningful(target)) continue;
      const list = stopsFor.get(target);
      if (list) list.push(stop);
      else stopsFor.set(target, [stop]);
    }
  }

  const order = Object.keys(links);
  const ranked = [...stopsFor.entries()]
    .filter(([, stops]) => stops.length >= minStops)
    .map(([title, stops]) => ({
      title,
      from: stops.sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    }));

  ranked.sort(
    (a, b) =>
      b.from.length - a.from.length ||
      Number(lead.has(b.title)) - Number(lead.has(a.title)) ||
      a.title.length - b.title.length ||
      a.title.localeCompare(b.title),
  );
  return ranked.slice(0, max);
}
