// Core data model (see drift-spec.md §7). Phase 1 uses Card / RelatedCandidate /
// Thread; TrailStep / Trail / SessionStats are defined now but exercised in Phase 2.

export type Card = {
  pageTitle: string; // canonical Wikipedia title — unique id
  displayTitle: string;
  description?: string; // Wikipedia short description
  extract: string; // 2–3 sentence hook
  longExtract?: string; // fetched lazily on "read more" (Phase 2)
  imageUrl?: string;
  sourceUrl: string; // canonical Wikipedia URL
};

// A related page returned by the morelike generator — already carries enough to
// render a Card without a second fetch (we synthesize the canonical URL).
export type RelatedCandidate = {
  pageTitle: string;
  displayTitle: string;
  description?: string;
  extract?: string;
  imageUrl?: string;
};

// A chosen, labeled next-step shown as a chip on the card.
export type Thread = {
  candidate: RelatedCandidate;
  label: string;
};

export type ArrivedVia =
  | { type: "seed"; seedName: string }
  | { type: "thread"; label: string; fromTitle: string }
  // A drift may carry the topic it landed in (interesting-random, M8) and why
  // that topic was chosen (M9): "interest" = weighted by what you like,
  // "wildcard" = the serendipity floor. Optional → back-compatible with trails
  // saved before Phase 4.
  | {
      type: "drift";
      topic?: { id: string; label: string };
      reason?: "interest" | "wildcard";
    };

export type TrailStep = {
  card: Card;
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
};

export type SessionStats = {
  id: string; // per drift-session id (one page-load of /drift); lets us upsert
  startedAt: number;
  stops: number;
  threadsPulled: number;
  drifts: number;
  durationMs?: number;
};
