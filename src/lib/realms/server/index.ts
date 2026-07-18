// Server realm registry: maps a RealmId to the functions the generic
// /api/realm/[realm]/* routes call. `discover` is realm-specific (Encyclopedia
// = articletopic); `related`/`summary`/`extended` come from the realm's content
// source. Adding a realm = adding one entry here (+ its adapter module).

import type { Card, RelatedCandidate } from "@/lib/types";
import type { RealmId } from "../types";
import { topicByKeyword } from "@/lib/topics";
import { articBucketById } from "../artic.buckets";
import { arxivBucketById } from "../arxiv.categories";
import {
  wikiRelated,
  wikiSummary,
  wikiExtended,
  wikiDiscoverTopic,
} from "./wikipedia";
import {
  articDiscover,
  articRelated,
  articSummary,
  articExtended,
} from "./artic";
import {
  arxivDiscover,
  arxivRelated,
  arxivSummary,
  arxivExtended,
} from "./arxiv";

/** Thrown for an invalid/injection bucket so the route can answer 400. */
export class BadRequestError extends Error {}

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
  extended(id: string): Promise<{ extract: string; hasMore: boolean } | null>;
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
  validateBucket: (b) => !!articBucketById(b),
  discover: ({ bucket, offset, limit }) => articDiscover(bucket, offset, limit),
  related: (id) => articRelated(id),
  summary: (id) => articSummary(id),
  extended: (id) => articExtended(id),
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

/** The server adapter for a realm, or null if the realm isn't known/wired. */
export function serverRealm(realm: string): ServerRealm | null {
  return REALMS[realm as RealmId] ?? null;
}
