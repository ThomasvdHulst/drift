import type { Trail } from "./types";

// ---------------------------------------------------------------------------
// Trail export. `trailToText` is pure + unit-tested (spec §8.3: a nicely
// formatted text version with links, e.g. for pasting into a chat). PNG export
// is a thin browser-only wrapper over html-to-image and isn't unit-tested.
// ---------------------------------------------------------------------------

/** A shareable plain-text version of a trail: header line + numbered links, each
 *  with the sentence that led there when the hop carried one (Phase 28). Those
 *  quotes are what make the pasted trail read as something rather than scan as a
 *  bookmark list, and they are also why the licence notice below is now doing
 *  real work. */
export function trailToText(trail: Trail): string {
  const n = trail.steps.length;
  const header = `🧵 ${trail.name} · ${n} ${n === 1 ? "stop" : "stops"}`;
  const lines = trail.steps.map((s, i) => {
    const via =
      s.arrivedVia.type === "thread"
        ? ` (${s.arrivedVia.label})`
        : s.arrivedVia.type === "drift"
          ? " (drift)"
          : "";
    const bridge =
      s.arrivedVia.type === "thread" && s.arrivedVia.bridge
        ? `\n   “${s.arrivedVia.bridge}”`
        : "";
    return `${i + 1}. ${s.card.displayTitle}${via}${bridge}\n   ${s.card.sourceUrl}`;
  });
  return [header, "", ...lines, "", TEXT_EXPORT_NOTICE, "Mapped with Drift"].join(
    "\n",
  );
}

/**
 * The licence line on the text export (audit BP-2).
 *
 * ⚠️ THIS USED TO BE COURTESY. IT IS NOW REQUIRED, and the difference is worth
 * writing down so nobody "tidies" it away on the strength of the old reasoning.
 *
 * The audit's analysis (B-5, row iv) was that an export of trail name, display
 * titles and source URLs is not Adapted Material and does not even engage
 * CC BY-SA 4.0 §3(a): titles are too short to carry protected expression, URLs
 * are facts, and §8(a) says the licence "shall not be interpreted to ... impose
 * conditions on any use of the Licensed Material that could lawfully be made
 * without permission". All of that was true of the file this function used to
 * produce.
 *
 * Phase 28 changed the file. A bridge is a whole sentence of article prose, and
 * a sentence IS protected expression, so the export now redistributes Licensed
 * Material and §3(a) applies: attribution, licence and the indication of
 * modification all have to travel with it. That is exactly what this line says,
 * so the line did not need to change — but its justification did, and an export
 * that stops carrying it would now be a licence breach rather than a discourtesy.
 */
export const TEXT_EXPORT_NOTICE =
  "Titles from Wikipedia and The Art Institute of Chicago. Text under CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0), excerpted. Images not included.";
