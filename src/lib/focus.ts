import { topicByKeyword } from "./topics";

// ---------------------------------------------------------------------------
// "Focused drift" (Phase 18) — an optional session *focus* that confines the
// passive drift gesture to a chosen area (threads stay free). Two kinds:
//   • field  — stay within one broad ORES topic ("Within Mathematics").
//   • orbit  — spiral outward from one seed page ("Orbiting Category theory").
// Pure + unit-tested: encode/decode the focus in /drift's URL params (so it
// survives reload and is linkable) and describe it for the banner. No React/DOM,
// no network. The orbit *engine* (the widening BFS pool) lives in orbit.ts.
// ---------------------------------------------------------------------------

export type Focus =
  | { kind: "field"; bucket: string; label: string } // ORES topic keyword + friendly label
  | { kind: "orbit"; seedTitle: string; seedLabel: string };

/** The URL query params that start this focused drift (appended to /drift?…).
 *  The homepage writes with this and /drift reads with `focusFromParams` below,
 *  so the two halves of the encoding can't drift apart. */
export function focusToParams(focus: Focus): Record<string, string> {
  if (focus.kind === "field") {
    return { focus: "field", bucket: focus.bucket, seed: focus.label };
  }
  return { focus: "orbit", title: focus.seedTitle, seed: focus.seedLabel };
}

/**
 * Parse a focus from /drift's query params, or null if none / invalid. A field
 * focus must name a known ORES topic keyword (guards junk + injection); an orbit
 * needs a seed title. Only Encyclopedia focuses exist for now. Accepts anything
 * with a `.get` (URLSearchParams) so it stays testable without the DOM.
 */
export function focusFromParams(params: {
  get(key: string): string | null;
}): Focus | null {
  const kind = params.get("focus");
  if (kind === "field") {
    const topic = topicByKeyword(params.get("bucket") ?? "");
    if (!topic) return null;
    return { kind: "field", bucket: topic.keyword, label: topic.label };
  }
  if (kind === "orbit") {
    const seedTitle = params.get("title") || params.get("seed") || "";
    if (!seedTitle) return null;
    return { kind: "orbit", seedTitle, seedLabel: params.get("seed") || seedTitle };
  }
  return null;
}

/** The focus banner's base label. Orbit appends a proximity word at runtime
 *  (see orbit.ts `proximityWord`); this is the anchored part. */
export function describeFocus(focus: Focus): string {
  return focus.kind === "field"
    ? `Within ${focus.label}`
    : `Orbiting ${focus.seedLabel}`;
}
