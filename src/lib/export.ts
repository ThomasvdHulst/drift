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
  return [header, "", ...lines, "", "— mapped with Drift"].join("\n");
}
