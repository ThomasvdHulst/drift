// Core data model (see drift-spec.md §7). Card / RelatedCandidate / Thread drive
// the feed; TrailStep / Trail / SessionStats drive saved trails and the stats view.

import type { SourceId, RealmId } from "./realms/types";
import type { Block } from "./wikihtml";
import type { ImageCredit } from "./imagecredit";

export type Card = {
  // Source-native id / key. For Wikipedia this is the canonical title (used in
  // morelike/summary calls); for other realms it's the source's own id (e.g. an
  // Art Institute artwork id). The app-wide unique id is `cardId` = source +
  // ":" + pageTitle (see lib/card.ts).
  pageTitle: string;
  displayTitle: string; // the human title
  description?: string; // short description / subtitle
  extract: string; // 2–3 sentence hook
  longExtract?: string; // fetched lazily on "read more" (Phase 2)
  imageUrl?: string;
  sourceUrl: string; // canonical URL at the content source
  // Where the content comes from. Absent ⇒ "wikipedia" (back-compat with trails
  // saved before Phase 5's realms).
  source?: SourceId;
  // Optional richer card fields (Phase 14 — Gallery, Deepened). All optional and
  // back-compatible: absent on Wikipedia cards and on trails saved before Phase 14.
  facts?: { label: string; value: string }[]; // structured "museum label" rows
  zoomUrl?: string; // hi-res image for the deep-zoom lightbox (art: IIIF 1686px)
  blurDataUrl?: string; // tiny base64 placeholder for a blur-up load (art: lqip)
  imageAlt?: string; // real alt text when the source provides one (art: alt_text)
  // A generated, field-themed "cover" for image-less realms (Phase 17 — Papers):
  // a hue + motif + seed the card renders instead of a photo. Only arXiv sets it.
  cover?: { hue: string; motif: string; seed: number };
  // Creator + licence of `imageUrl`, which is a SEPARATE work from the article
  // text with its own author and its own licence (compliance audit B-4). Absent
  // means "not looked up", and `mayDisplayImage` treats that as "do not show the
  // image" — which is what makes cards saved before this existed fail closed.
  // See lib/imagecredit.ts.
  imageCredit?: ImageCredit;
  // The licence of the card's TEXT, carried with the data rather than living only
  // in the rendered card (audit M-11). Every persisted card and every cached API
  // payload gets one, so a trail in the database, a share in transit and an export
  // are all self-describing rather than looking like unattributed extracts.
  attribution?: Attribution;
};

/** The licence of a card's text, travelling with the card. */
export type Attribution = {
  source: string; // "English Wikipedia"
  sourceUrl: string;
  license: string; // "CC BY-SA 4.0"
  licenseUrl: string;
  /** CC BY-SA 4.0 §3(a)(1)(B) requires modification to be indicated. */
  modified: boolean;
  modification?: string; // "excerpted and reformatted"
};

/**
 * "The bridge" (Phase 28): the sentence in which the article you are on links to
 * the page a thread would take you to, quoted from that article rather than
 * guessed. It is what makes a thread a citation instead of a recommendation, and
 * it is the app's honest answer to "why is this chip here?" (§2.1).
 *
 * Never invented and never truncated (see lib/bridge.ts). Absent means the lead
 * did not link there, or did so in a sentence too long to quote — the chip then
 * reads exactly as it did before bridges existed.
 */
export type Bridge = {
  sentence: string;
  /** The words inside the sentence that carry the link. */
  anchor: string;
};

// A related page returned by a realm's "related" endpoint — already carries
// enough to render a Card without a second fetch (we synthesize the canonical
// URL). `threadLabel`/`facet` are set by realms whose threads are facet-based
// (Gallery/Library: "More by {artist}", "Other {style}", …); Wikipedia leaves
// them unset and the client derives a label from the description.
export type RelatedCandidate = {
  pageTitle: string;
  displayTitle: string;
  description?: string;
  extract?: string;
  imageUrl?: string;
  /** File name of `imageUrl`, so a candidate that LANDS on a card can have its
   *  image credited without a second lookup (see lib/imagecredit.ts). */
  imageFile?: string;
  imageCredit?: ImageCredit;
  source?: SourceId;
  sourceUrl?: string; // set by non-Wikipedia realms (Wikipedia synthesizes it)
  threadLabel?: string;
  facet?: string;
  // A short uppercase facet word shown above the label on a facet-realm chip
  // (Gallery: "MORE BY" / "THE MOVEMENT" / "THE SUBJECT" …). The facet-realm
  // parallel to the Encyclopedia's directional `kind` (Phase 14 M-G3).
  eyebrow?: string;
  // Rich card fields carried through so a candidate that LANDS on a card keeps its
  // museum label / zoom / blur-up / alt (Phase 14 fields). Only art sets these.
  zoomUrl?: string;
  blurDataUrl?: string;
  imageAlt?: string;
  facts?: { label: string; value: string }[];
  cover?: { hue: string; motif: string; seed: number }; // Papers: field-themed cover
  /** The sentence in which the CURRENT card's article links here (Phase 28).
   *  Encyclopedia only, and only when the lead links here in a quotable line. */
  bridge?: Bridge;
};

// The "direction" a thread takes you (Phase 6). Encyclopedia threads are
// classified into these; facet realms (Gallery) leave kind undefined.
export type ThreadKind = "deeper" | "zoomout" | "nearby" | "tangent";

// A chosen, labeled next-step shown as a chip on the card.
export type Thread = {
  candidate: RelatedCandidate;
  label: string;
  kind?: ThreadKind;
  // Facet-realm eyebrow (Gallery). Distinct from `kind` (Encyclopedia). At most
  // one of `kind` / `eyebrow` is set.
  eyebrow?: string;
  // A cross-realm "doorway" (Phase 15): presence marks this chip a realm-crossing,
  // the value is the destination realm. Pulling it lands you in the other realm.
  doorway?: RealmId;
  /** The quoted reason this thread exists (Phase 28), when there is one. */
  bridge?: Bridge;
};

export type ArrivedVia =
  | { type: "seed"; seedName: string }
  // `kind` records the thread's direction (Phase 6); optional ⇒ back-compatible
  // with trails saved before it, and with facet realms (Gallery) that omit it.
  // `crossedFrom` (Phase 15) is set when this step crossed into a new realm (the
  // realm you came FROM) — powers the honest "Crossed to …" line + a distinct
  // trail-map / atlas edge. Absent ⇒ an in-realm thread.
  | {
      type: "thread";
      label: string;
      fromTitle: string;
      kind?: ThreadKind;
      crossedFrom?: RealmId;
      /** The sentence that justified this step, quoted from the card you left
       *  (Phase 28). Only the sentence is persisted, not the anchor: a saved
       *  trail is read, not re-highlighted, and every byte here is synced. */
      bridge?: string;
    }
  // A drift may carry the topic it landed in (interesting-random, M8) and why
  // that topic was chosen (M9): "interest" = weighted by what you like,
  // "wildcard" = the serendipity floor. "field"/"orbit" are the Phase 18 focused
  // drifts (confined to a field / spiraling out from a seed), and "form" is the
  // Phase 24 Gallery slice (one art form, optionally one period). Optional →
  // back-compatible with trails saved before Phase 4.
  | {
      type: "drift";
      topic?: { id: string; label: string };
      reason?:
        | "interest"
        | "wildcard"
        | "field"
        | "orbit"
        | "current"
        | "form"
        | "artist";
      // Set only on an orbit drift (Phase 18): the seed being orbited + the ring
      // (distance) this card sits at, for the honest "Orbiting X · nearby" chip.
      orbit?: { seedLabel: string; ring: number };
      // Set only on an "in the news" drift (Phase 23): which news section, how
      // recently the article was in the news, whether the section's news pool had
      // run out so we were widening into related pages, and whether this is an
      // already-read article gently re-shown because you've caught up on the whole
      // section. Drives the honest "In the news · 3 days ago" / "· wandering wider"
      // / "· seen before" chip.
      current?: {
        section: string;
        label: string;
        daysAgo?: number;
        widened?: boolean;
        revisit?: boolean;
      };
      // Set when a horizontal swipe crossed into a new realm with no doorway (a
      // fresh wander into the other realm) — the realm you came FROM (Phase 15).
      crossedFrom?: RealmId;
      // Set when this drift followed a related thread because you ♥-liked the
      // previous card ("keep me in this stream"). The value is that liked card's
      // title, for an honest "More like {title}" mode chip.
      fromLiked?: string;
    };

/**
 * A thread that was offered at a stop and not taken (Phase 28) — "a door you
 * left open". Flattened rather than holding a whole candidate, because this is
 * persisted with the trail and synced: enough to name it, explain it and reopen
 * it, and nothing else. The logic lives in lib/doors.ts.
 */
export type Door = {
  pageTitle: string;
  displayTitle: string;
  kind?: ThreadKind;
  /** The realm it leads into. Absent ⇒ Wikipedia, as everywhere in this model. */
  source?: SourceId;
  /** The sentence that justified it, when the thread carried one. */
  bridge?: string;
};

export type TrailStep = {
  card: Card;
  /** The threads this stop offered and you did NOT take (Phase 28), recorded
   *  only for stops you actually engaged with. See lib/doors.ts. Optional, so
   *  every trail saved before it still resolves. */
  doorsLeft?: Door[];
  arrivedVia: ArrivedVia;
  timestamp: number;
  dwellMs?: number;
  expanded: boolean;
};

export type Trail = {
  id: string;
  name: string;
  steps: TrailStep[];
  createdAt: number;
  liked: boolean;
  // Which realm this trail was drifted in. Absent ⇒ "encyclopedia" (back-compat).
  realm?: RealmId;
};

export type SessionStats = {
  id: string; // per drift-session id (one page-load of /drift); lets us upsert
  startedAt: number;
  stops: number;
  threadsPulled: number;
  drifts: number;
  durationMs?: number;
};

// What `?extended=1` answers with: the body a card reveals on "Read more".
//
// `extract` is always present — plain paragraphs joined by blank lines, the shape
// the card has rendered since Phase 2, and the thing it falls back to. `blocks`
// (Phase 26) is the same body with its TABLES kept, in reading order, so a
// paragraph saying "as the table below shows" is followed by that table; `facts`
// is the page's infobox as label/value rows for the card's Details disclosure.
// Both are optional: only the Encyclopedia realm has them, and a card renders
// perfectly well without them. Neither is ever stored on a `Card`, so saved
// trails and the cloud sync payload stay exactly the size they are.
export type ExtendedBody = {
  extract: string;
  hasMore: boolean;
  blocks?: Block[];
  facts?: { label: string; value: string }[];
};
