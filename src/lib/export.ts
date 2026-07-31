import type { Trail } from "./types";

// ---------------------------------------------------------------------------
// Trail export. `trailToText` is pure + unit-tested (spec §8.3: a nicely
// formatted text version with links, e.g. for pasting into a chat). PNG export
// is a thin browser-only wrapper over html-to-image and isn't unit-tested.
// ---------------------------------------------------------------------------

/** A shareable plain-text version of a trail: header line + numbered links. */
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
    return `${i + 1}. ${s.card.displayTitle}${via}\n   ${s.card.sourceUrl}`;
  });
  return [header, "", ...lines, "", TEXT_EXPORT_NOTICE, "Mapped with Drift"].join(
    "\n",
  );
}

/**
 * The licence line on the text export (audit BP-2).
 *
 * NOT required, and it is worth being precise about why, because the reasoning
 * is what stops someone "tidying" it away or over-claiming with it. The audit's
 * own analysis (B-5, row iv) is that a plain-text export of trail name, display
 * titles and source URLs is NOT Adapted Material and does not even engage
 * §3(a): titles are too short to carry protected expression and URLs are facts,
 * and CC BY-SA 4.0 §8(a) says the licence "shall not be interpreted to ... impose
 * conditions on any use of the Licensed Material that could lawfully be made
 * without permission".
 *
 * So this is one line of courtesy that makes an artefact designed to leave Drift
 * self-describing. It names where the titles came from and says images are not
 * included, which is true and is the thing a reader would otherwise wonder about.
 * It does not claim the text file is licensed, because it is not.
 */
export const TEXT_EXPORT_NOTICE =
  "Titles from Wikipedia and The Art Institute of Chicago. Text under CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0), excerpted. Images not included.";
