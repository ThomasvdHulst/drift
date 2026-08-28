// Server realm registry: maps a RealmId to the functions the generic
// /api/realm/[realm]/* routes call. `discover` is realm-specific (Encyclopedia
// = articletopic); `related`/`summary`/`extended` come from the realm's content
// source. Adding a realm = adding one entry here (+ its adapter module).

import type { Card, ExtendedBody, RelatedCandidate } from "@/lib/types";
import type { RealmId } from "../types";
import { topicByKeyword } from "@/lib/topics";
import { arxivBucketById } from "../arxiv.categories";
import {
  wikiRelated,
  wikiSummary,
  wikiExtended,
  wikiDiscoverTopic,
} from "./wikipedia";
import {
  metDiscover,
  metRelated,
  metSummary,
  metExtended,
  metValidateBucket,
} from "./met";
import {
  arxivDiscover,
  arxivRelated,
  arxivSummary,
  arxivExtended,
} from "./arxiv";

export interface ServerRealm {
  /** Reject unknown buckets (injection guard — bucket is interpolated upstream). */
  validateBucket(bucket: string): boolean;
  discover(p: {
    bucket: string;
    offset: number;
    limit: number;
  }): Promise<Card[]>;
  related(id: string): Promise<RelatedCandidate[]>;
  summary(id: string, opts: { full?: boolean }): Promise<Card | null>;
  /** The "Read more" body. `extract` + `hasMore` are the contract every realm
   *  meets; the Encyclopedia additionally returns `blocks` (paragraphs and the
   *  tables between them) and the page's infobox `facts` — see lib/types.ts. */
  extended(id: string): Promise<ExtendedBody | null>;
}

const encyclopedia: ServerRealm = {
  validateBucket: (b) => !!topicByKeyword(b),
  discover: ({ bucket, offset, limit }) =>
    wikiDiscoverTopic(bucket, offset, limit),
  related: (id) => wikiRelated(id),
  summary: (id, opts) => wikiSummary(id, opts),
  extended: (id) => wikiExtended(id),
};

const gallery: ServerRealm = {
  // One bucket shape for now: a room in the museum. The Art Institute realm this
  // replaces also understood "form:<form>:<era>" slices and "artist:<id>:<ring>"
  // drifts; both were built on Elasticsearch aggregations the Met does not
  // expose, and both come back in Phase B against the fields it does have.
  // Anything else is rejected before it can reach the upstream query.
  validateBucket: (b) => metValidateBucket(b),
  discover: ({ bucket, offset, limit }) => metDiscover(bucket, offset, limit),
  related: (id) => metRelated(id),
  summary: (id) => metSummary(id),
  extended: (id) => metExtended(id),
};

const papers: ServerRealm = {
  validateBucket: (b) => !!arxivBucketById(b),
  discover: ({ bucket, offset, limit }) => arxivDiscover(bucket, offset, limit),
  related: (id) => arxivRelated(id),
  summary: (id) => arxivSummary(id),
  extended: (id) => arxivExtended(id),
};

const REALMS: Partial<Record<RealmId, ServerRealm>> = {
  encyclopedia,
  gallery,
  papers,
};

/**
 * Realms that only exist while their flag is on.
 *
 * ⚠️ A FLAG READ IN ONLY ONE OF THE TWO REGISTRIES IS NOT A FLAG. `PAPERS_ENABLED`
 * lived in the CLIENT registry alone (`realms/index.ts`), where it removes Papers
 * from the realm tabs — so the feature looked switched off while
 * `/api/realm/papers/discover` and `/api/realm/papers/summary` went on answering
 * anyone on the internet with live arXiv abstracts. Measured against production on
 * 27 August 2026: `bucket=ml&limit=2` returned two real papers with their arXiv
 * URLs. Nothing in the UI reached it, which is exactly why nobody noticed.
 *
 * That is not merely an unused endpoint. CLAUDE.md §2.5 requires arXiv to be named
 * in `/sources`, `/privacy`, `/colophon` and `docs/processing-record.md` BEFORE the
 * realm serves anything, and it is named in none of them — so the live site was
 * redistributing a third source that two published legal documents say is not there.
 *
 * The gate belongs here rather than in each route: `serverRealm` is the one door
 * all three generic `/api/realm/[realm]/*` routes come through, so a realm that is
 * off is simply not known, and every route answers its existing "unknown realm"
 * 400 with no new branch to keep in sync.
 */
const FLAGGED: Partial<Record<RealmId, boolean>> = {
  papers: process.env.NEXT_PUBLIC_REALM_PAPERS === "1",
};

/** The server adapter for a realm, or null if the realm isn't known/wired/enabled. */
export function serverRealm(realm: string): ServerRealm | null {
  const id = realm as RealmId;
  if (FLAGGED[id] === false) return null;
  return REALMS[id] ?? null;
}
