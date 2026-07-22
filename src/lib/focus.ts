import { topicByKeyword } from "./topics";
import { sectionById } from "./current";

// ---------------------------------------------------------------------------
// "Focused drift" (Phase 18) — an optional session *focus* that confines the
// passive drift gesture to a chosen area (threads stay free). Three kinds:
//   • field   — stay within one broad ORES topic ("Within Mathematics").
//   • orbit   — spiral outward from one seed page ("Orbiting Category theory").
//   • current — the articles behind this week's news in one subject, Phase 23
//               ("In the news: Sports").
// Pure + unit-tested: encode/decode the focus in /drift's URL params (so it
// survives reload and is linkable) and describe it for the banner. No React/DOM,
// no network. The orbit *engine* (the widening BFS pool) lives in orbit.ts, and
// the current-events pool in current.ts.
// ---------------------------------------------------------------------------

export type Focus =
  | { kind: "field"; bucket: string; label: string } // ORES topic keyword + friendly label
  | { kind: "orbit"; seedTitle: string; seedLabel: string }
  | { kind: "current"; section: string; label: string }; // news section slug + label

/** The URL query params that start this focused drift (appended to /drift?…).
 *  The homepage writes with this and /drift reads with `focusFromParams` below,
 *  so the two halves of the encoding can't drift apart. */
export function focusToParams(focus: Focus): Record<string, string> {
  if (focus.kind === "field") {
    return { focus: "field", bucket: focus.bucket, seed: focus.label };
  }
  if (focus.kind === "current") {
    return { focus: "current", section: focus.section, seed: focus.label };
  }
  return { focus: "orbit", title: focus.seedTitle, seed: focus.seedLabel };
}

/**
 * Parse a focus from /drift's query params, or null if none / invalid. A field
 * focus must name a known ORES topic keyword and a current focus a known news
 * section (both guard junk + injection); an orbit needs a seed title. Only
 * Encyclopedia focuses exist for now. Accepts anything with a `.get`
 * (URLSearchParams) so it stays testable without the DOM.
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
  if (kind === "current") {
    const section = sectionById(params.get("section"));
    if (!section) return null;
    return { kind: "current", section: section.id, label: section.label };
  }
  if (kind === "orbit") {
    const seedTitle = params.get("title") || params.get("seed") || "";
    if (!seedTitle) return null;
    return { kind: "orbit", seedTitle, seedLabel: params.get("seed") || seedTitle };
  }
  return null;
}

/** The focus banner's base label. Orbit appends a proximity word at runtime
 *  (see orbit.ts `proximityWord`) and a current drift appends "wandering wider"
 *  once its news pool runs out; this is the anchored part. */
export function describeFocus(focus: Focus): string {
  if (focus.kind === "field") return `Within ${focus.label}`;
  if (focus.kind === "current") return `In the news: ${focus.label}`;
  return `Orbiting ${focus.seedLabel}`;
}
