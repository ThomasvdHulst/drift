import { topicByKeyword } from "./topics";
import { sectionById } from "./current";
import {
  ERA_ALL,
  describeSlice,
  formBucketId,
  parseFormBucket,
} from "./realms/artic.forms";
import { artistBucketId, type ArtistRing } from "./realms/artic.artist";
import type { RealmId } from "./realms/types";

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
//
// A session holds a *stack* of these, not one (see "the focus stack" below):
// each focus belongs to ONE realm and can hold a narrower focus inside it.
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

// ---------------------------------------------------------------------------
// The focus stack
//
// A focus used to be a single value, which made two things wrong at once:
//
//   1. It had no realm. A thread (always free, §2.2) can carry you from a field
//      drift in the Encyclopedia through a doorway into the Gallery — where the
//      field means nothing, so the drift went free while the banner still
//      promised "Within Mathematics", and crossing back was blocked because
//      crossing was disabled outright whenever a focus was set. That is a trap:
//      the only way home was to abandon the focus.
//   2. It had no depth. Anchoring an orbit on an interesting page THREW AWAY the
//      field you found it in, so "done circling this, back to mathematics" was
//      not expressible — letting the orbit go dropped you into a free drift.
//
// So: each focus belongs to a realm (`focusRealm`), and a realm's focuses are
// ordered broad → narrow. `focusForRealm` is the one that governs a realm's
// passive drift right now; the others are dormant, waiting for you to come back
// to their realm or to release the one nested inside them.
// ---------------------------------------------------------------------------

/** The realm a focus governs. A focus is a promise about ONE realm's drift:
 *  a field, a news section and a page orbit are Encyclopedia; an art form and an
 *  artist are the Gallery. Crossing out of it suspends the focus rather than
 *  ending it — nothing else could be honest, since the promise cannot be kept
 *  somewhere its cards do not exist. */
export function focusRealm(focus: Focus): RealmId {
  return focus.kind === "form" || focus.kind === "artist"
    ? "gallery"
    : "encyclopedia";
}

/** How narrow a focus is. A broad area (a field, a news section, an art form)
 *  can hold a narrow one (one page's orbit, one artist) inside it; a narrow one
 *  replaces its peer instead of nesting, so orbiting page after page can't grow
 *  a stack you'd have to unwind one tap at a time. */
function focusDepth(focus: Focus): number {
  return focus.kind === "orbit" || focus.kind === "artist" ? 1 : 0;
}

/** Enter a focus. It nests inside anything broader already set for its realm,
 *  and replaces anything equally narrow (or narrower) there. Other realms are
 *  left alone, so a Gallery focus and an Encyclopedia focus can both be live. */
export function pushFocus(stack: Focus[], next: Focus): Focus[] {
  const kept = stack.filter(
    (f) =>
      focusRealm(f) !== focusRealm(next) || focusDepth(f) < focusDepth(next),
  );
  return [...kept, next];
}

/** The focus governing `realm`'s passive drift: the innermost one entered for
 *  it, or null (drift there is free). */
export function focusForRealm(stack: Focus[], realm: RealmId): Focus | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (focusRealm(stack[i]) === realm) return stack[i];
  }
  return null;
}

/** Let go of `realm`'s innermost focus, revealing whatever broader one it was
 *  entered inside ("done circling this page, back to Mathematics"). Other realms
 *  are untouched. */
export function releaseFocusIn(stack: Focus[], realm: RealmId): Focus[] {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (focusRealm(stack[i]) === realm) {
      return [...stack.slice(0, i), ...stack.slice(i + 1)];
    }
  }
  return stack;
}

/** What releasing `realm`'s focus would reveal, or null if it means drifting
 *  freely there. Names the banner's release control, so letting go is never a
 *  surprise (§2.1). */
export function focusUnder(stack: Focus[], realm: RealmId): Focus | null {
  return focusForRealm(releaseFocusIn(stack, realm), realm);
}

/** What the focus banner should show while reading in `realm`, or null for no
 *  banner at all. `dormant` means this focus belongs to the OTHER realm: it is
 *  not steering the drift here, and the banner has to say so rather than quietly
 *  keep promising something it isn't doing. */
export function bannerFocus(
  stack: Focus[],
  realm: RealmId,
): { focus: Focus; dormant: boolean } | null {
  const active = focusForRealm(stack, realm);
  if (active) return { focus: active, dormant: false };
  const waiting = stack[stack.length - 1];
  return waiting ? { focus: waiting, dormant: true } : null;
}

/**
 * The params that decide WHICH session /drift is showing: the realm, the focus
 * and everything a focus is spelled with, plus the session mode and a continued
 * trail. Anything not in here can change without disturbing a drift in progress.
 *
 * `door` is here for a reason worth stating: without it `?continue=X&door=3.0`
 * and `?continue=X` are the same key, so reopening a saved trail through a door
 * would resume the trail and silently never take the branch.
 */
export const SESSION_PARAMS = [
  "realm",
  "focus",
  "bucket",
  "title",
  "seed",
  "section",
  "form",
  "era",
  "artist",
  "works",
  "under",
  "mode",
  "continue",
  "door",
  "from",
] as const;

/** Every param that spells a focus. Cleared before a new one is written, so a
 *  leftover `section=` from a released news drift can't haunt a field drift. */
export const FOCUS_PARAMS = [
  "focus",
  "bucket",
  "title",
  "seed",
  "section",
  "form",
  "era",
  "artist",
  "works",
  "under",
] as const;

/**
 * A stable string identifying the session those params ask for.
 *
 * /drift used to read its params ONCE, on mount, from `window.location.search`,
 * which quietly assumed that arriving with new params always means a new
 * component. When that assumption does not hold — a router that reuses the page,
 * a restored client, anything — the params are simply never read, the drift keeps
 * whatever it was doing, and picking a field or a page to orbit appears to do
 * nothing at all until the app is reloaded. Comparing this key each render is what
 * makes the session follow the URL instead of the mount.
 */
export function sessionKey(params: { get(key: string): string | null }): string {
  return SESSION_PARAMS.map((k) => `${k}=${params.get(k) ?? ""}`).join("&");
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

/** How long an `under` param may be before it is ignored. It only ever holds one
 *  focus's params (a few dozen characters); anything bigger is junk. */
const MAX_UNDER = 512;

/**
 * Parse a whole focus stack from /drift's params: the innermost focus in the
 * ordinary params, the one it is nested inside in `under` (itself a param
 * string). Two levels are encoded, which is as deep as entering a focus can go
 * — a session reaches three only by holding one focus per realm, and the realm
 * you are not in is the one that can be re-entered from the homepage anyway.
 *
 * The parent is validated by pushing it, so a hand-edited URL claiming a nesting
 * that entering a focus would never produce collapses to just the inner focus.
 */
export function focusStackFromParams(params: {
  get(key: string): string | null;
}): Focus[] {
  const top = focusFromParams(params);
  if (!top) return [];
  const under = params.get("under") ?? "";
  if (!under || under.length > MAX_UNDER) return [top];
  const parent = focusFromParams(new URLSearchParams(under));
  return parent ? pushFocus([parent], top) : [top];
}

/** The URL params for a focus stack — the inverse of `focusStackFromParams`. */
export function focusStackToParams(stack: Focus[]): Record<string, string> {
  const top = stack[stack.length - 1];
  if (!top) return {};
  const params = focusToParams(top);
  const parent = stack[stack.length - 2];
  if (!parent) return params;
  return {
    ...params,
    under: new URLSearchParams(focusToParams(parent)).toString(),
  };
}

/** Rewrite search params so they spell exactly this stack and nothing of the one
 *  it replaces. /drift writes its own URL this way when a focus is entered or
 *  released, so a reload resumes the drift you are actually in. */
export function writeFocusParams(sp: URLSearchParams, stack: Focus[]): void {
  for (const key of FOCUS_PARAMS) sp.delete(key);
  for (const [key, value] of Object.entries(focusStackToParams(stack))) {
    sp.set(key, value);
  }
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

/** The bare NAME of a focus, for use inside a sentence ("Back to Mathematics")
 *  where `describeFocus`'s framing word would read as "Back to Within
 *  Mathematics". */
export function focusName(focus: Focus): string {
  if (focus.kind === "current") return `${focus.label} news`;
  if (focus.kind === "orbit") return focus.seedLabel;
  return focus.label;
}
