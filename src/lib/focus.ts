import { topicByKeyword } from "./topics";
import { sectionById } from "./current";
import {
  ERA_ALL,
  describeSlice,
  formBucketId,
  parseFormBucket,
} from "./realms/artic.forms";
import { artistBucketId, type ArtistRing } from "./realms/artic.artist";

// ---------------------------------------------------------------------------
// "Focused drift" (Phase 18) — an optional session *focus* that confines the
// passive drift gesture to a chosen area (threads stay free). Four kinds:
//   • field   — stay within one broad ORES topic ("Within Mathematics").
//   • orbit   — spiral outward from one seed page ("Orbiting Category theory").
//   • current — the articles behind this week's news in one subject, Phase 23
//               ("In the news: Sports").
//   • form    — one art form, optionally narrowed to a period, Phase 24
//               ("Paintings, 1850 to 1899"). Gallery realm.
//   • artist  — one artist's work, widening outward once it runs out, Phase 24
//               ("Vincent van Gogh"). Gallery realm.
// Pure + unit-tested: encode/decode the focus in /drift's URL params (so it
// survives reload and is linkable) and describe it for the banner. No React/DOM,
// no network. The orbit *engine* (the widening BFS pool) lives in orbit.ts, the
// current-events pool in current.ts, and the art-form registry in
// realms/artic.forms.ts.
// ---------------------------------------------------------------------------

export type Focus =
  | { kind: "field"; bucket: string; label: string } // ORES topic keyword + friendly label
  | { kind: "orbit"; seedTitle: string; seedLabel: string }
  | { kind: "current"; section: string; label: string } // news section slug + label
  | { kind: "form"; form: string; era: string; label: string } // art form + era slug
  | { kind: "artist"; artistId: string; label: string; works?: number };

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
  if (focus.kind === "form") {
    // `bucket` rides along so /drift seeds the first card through the same
    // bucket path a Gallery seed tile uses; `form`/`era` are what the parser
    // actually reads back.
    return {
      focus: "form",
      form: focus.form,
      era: focus.era,
      bucket: formBucketId(focus.form, focus.era),
      seed: focus.label,
    };
  }
  if (focus.kind === "artist") {
    return {
      focus: "artist",
      artist: focus.artistId,
      // Ring 0 is where every artist drift starts; widening swaps the bucket.
      bucket: artistBucketId(focus.artistId, 0),
      seed: focus.label,
      ...(focus.works ? { works: String(focus.works) } : {}),
    };
  }
  return { focus: "orbit", title: focus.seedTitle, seed: focus.seedLabel };
}

/** The `bucket` a bucket-pinned focus pulls its discover batches from, or null
 *  for the kinds that serve their own pool (orbit, current). Kept here so the
 *  feed never has to know how a slice or a ring is spelled.
 *
 *  `ring` applies to an artist drift: it is the whole of widening, since bumping
 *  the ring is just a different bucket. */
export function focusBucket(focus: Focus, ring: ArtistRing = 0): string | null {
  if (focus.kind === "field") return focus.bucket;
  if (focus.kind === "form") return formBucketId(focus.form, focus.era);
  if (focus.kind === "artist") return artistBucketId(focus.artistId, ring);
  return null;
}

/**
 * Parse a focus from /drift's query params, or null if none / invalid. A field
 * focus must name a known ORES topic keyword, a current focus a known news
 * section, and a form focus a slice we actually offer (all three guard junk +
 * injection); an orbit needs a seed title. Accepts anything with a `.get`
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
  if (kind === "form") {
    // Validated by round-tripping through the registry, so an unknown form, an
    // unknown era, or a period the form is too thin for all fall back to "no
    // focus" rather than starting a drift that can never fill.
    const era = params.get("era") || ERA_ALL;
    const slice = parseFormBucket(
      formBucketId(params.get("form") ?? "", era),
    );
    if (!slice) return null;
    return {
      kind: "form",
      form: slice.form.id,
      era: slice.era?.id ?? ERA_ALL,
      label: describeSlice(slice.form, slice.era),
    };
  }
  if (kind === "artist") {
    // Digits only: the id is interpolated into a numeric term query upstream.
    const artistId = params.get("artist") ?? "";
    if (!/^\d{1,9}$/.test(artistId)) return null;
    // The label and count are display-only (the drift keys off the id), so a
    // missing one falls back rather than voiding the focus.
    const works = Number(params.get("works"));
    return {
      kind: "artist",
      artistId,
      label: params.get("seed") || "This artist",
      ...(Number.isFinite(works) && works > 0 ? { works } : {}),
    };
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
  // A slice already reads as a complete phrase ("Paintings, 1850 to 1899"), and
  // an artist's name speaks for itself, so neither needs a framing word.
  if (focus.kind === "form") return focus.label;
  if (focus.kind === "artist") return focus.label;
  return `Orbiting ${focus.seedLabel}`;
}
