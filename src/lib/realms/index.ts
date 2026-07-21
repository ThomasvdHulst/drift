// Client-side realm registry: metadata + URL builders + the per-realm "how do I
// discover the next drift card" strategy. The feed (drift/page.tsx) is
// realm-agnostic — it asks the descriptor here instead of hard-coding Wikipedia.
//
// Server-side fetching lives in realms/server/*; this module is import-safe from
// client components (no server-only deps).

import type { Interest } from "../interest";
import { pickDriftTopic } from "../interest";
import { uniformTopic } from "../discover";
import { pickRandom } from "../pick";
import type { RealmId, RealmMeta, DiscoverPick, SeedTile } from "./types";
import { ARTIC_BUCKETS, articBucketById } from "./artic.buckets";
import { ARXIV_BUCKETS, arxivBucketById } from "./arxiv.categories";
import encyclopediaSeedData from "../../data/seeds.json";

// The Papers realm (Phase 17) is behind a flag so it can be dropped/hidden with
// one env var while we test the feel locally. Off ⇒ no homepage tab, no behavior
// change anywhere; the realm still resolves via getRealm so a saved Papers trail
// still opens. The logged-out landing page never enumerates realms, so it is
// untouched regardless.
const PAPERS_ENABLED = process.env.NEXT_PUBLIC_REALM_PAPERS === "1";

export interface RealmClient extends RealmMeta {
  /** Homepage seed tiles for this realm. */
  seeds: SeedTile[];
  /** Choose one bucket to pull a discover batch from (called once per bucket in
   *  a buffer refill). Interest-weighting applies only where hasInterestModel. */
  pickDiscover(opts: { interest?: Interest; personalize: boolean }): DiscoverPick;
  /** Friendly label for a bucket id (for the "why this card" line). */
  bucketLabel(bucketId: string): string;
}

type EncSeed = { name: string; glyph: string; tint: string; blurb: string; titles: string[] };

const encyclopedia: RealmClient = {
  id: "encyclopedia",
  contentSource: "wikipedia",
  label: "Encyclopedia",
  glyph: "✦",
  blurb: "Wander all of Wikipedia. Pull a thread on anything.",
  hasInterestModel: true,
  threadMode: "diverse",
  seeds: (encyclopediaSeedData as EncSeed[]).map((s) => ({
    label: s.name,
    glyph: s.glyph,
    blurb: s.blurb,
    tint: s.tint,
    titles: s.titles,
  })),
  pickDiscover({ interest, personalize }) {
    if (personalize && interest) {
      const { topic, reason } = pickDriftTopic(interest);
      return { id: topic.id, label: topic.label, bucket: topic.keyword, reason };
    }
    const topic = uniformTopic();
    return { id: topic.id, label: topic.label, bucket: topic.keyword };
  },
  bucketLabel: (id) => id, // encyclopedia's bucket is an ORES keyword; the label
  // shown comes from pickDiscover's DiscoverPick, so this fallback is rarely used.
};

const gallery: RealmClient = {
  id: "gallery",
  contentSource: "artic",
  label: "Gallery",
  glyph: "❖",
  blurb: "Public-domain masterpieces from the Art Institute of Chicago.",
  hasInterestModel: false,
  threadMode: "facet",
  seeds: ARTIC_BUCKETS.map((b) => ({
    label: b.label,
    glyph: b.glyph,
    blurb: b.blurb,
    tint: b.tint,
    bucket: b.id,
  })),
  pickDiscover() {
    const b = pickRandom(ARTIC_BUCKETS) ?? ARTIC_BUCKETS[0];
    return { id: b.id, label: b.label, bucket: b.id };
  },
  bucketLabel: (id) => articBucketById(id)?.label ?? id,
};

// Papers realm (Phase 17): arXiv preprints, read as text-forward, field-themed
// cards. No interest model, facet threads (like Gallery). Dusty-blue accent.
const papers: RealmClient = {
  id: "papers",
  contentSource: "arxiv",
  label: "Papers",
  glyph: "◈",
  blurb: "Open research from arXiv. Wander the frontier of knowledge.",
  hasInterestModel: false,
  threadMode: "facet",
  seeds: ARXIV_BUCKETS.map((b) => ({
    label: b.label,
    glyph: b.glyph,
    blurb: b.blurb,
    tint: b.tint,
    bucket: b.id,
  })),
  pickDiscover() {
    const b = pickRandom(ARXIV_BUCKETS) ?? ARXIV_BUCKETS[0];
    return { id: b.id, label: b.label, bucket: b.id };
  },
  bucketLabel: (id) => arxivBucketById(id)?.label ?? id,
};

const REALMS: Partial<Record<RealmId, RealmClient>> = {
  encyclopedia,
  gallery,
  papers,
};

/** The realm client for an id, defaulting to Encyclopedia for unknown/absent. */
export function getRealm(id: string | null | undefined): RealmClient {
  return (id ? REALMS[id as RealmId] : undefined) ?? encyclopedia;
}

/** All realms shown as homepage tabs, in registration order. Papers is gated by
 *  its flag (still resolvable via getRealm when off, just not offered as a tab). */
export function listRealms(): RealmClient[] {
  return Object.values(REALMS).filter(
    (r): r is RealmClient => !!r && (r.id !== "papers" || PAPERS_ENABLED),
  );
}

// ----- URL builders for the generic /api/realm/[realm]/* routes -----

export function discoverUrl(
  realm: RealmId,
  p: { bucket: string; offset: number; limit: number },
): string {
  return `/api/realm/${realm}/discover?bucket=${encodeURIComponent(p.bucket)}&offset=${p.offset}&limit=${p.limit}`;
}

export function relatedUrl(realm: RealmId, id: string): string {
  return `/api/realm/${realm}/related?id=${encodeURIComponent(id)}`;
}

/** The cross-realm doorway for a card (Phase 15): the one genuinely-related card
 *  in the OTHER realm, or {} if there's none. */
export function doorwayUrl(realm: RealmId, id: string): string {
  return `/api/doorway?realm=${realm}&id=${encodeURIComponent(id)}`;
}

export function summaryUrl(
  realm: RealmId,
  id: string,
  opts: { extended?: boolean; full?: boolean } = {},
): string {
  const q = opts.extended ? "&extended=1" : opts.full ? "&full=1" : "";
  return `/api/realm/${realm}/summary?id=${encodeURIComponent(id)}${q}`;
}
