// ---------------------------------------------------------------------------
// The load-test harness (scripts/bots/) has to speak the app's exact API, but it
// runs under plain Node and cannot import the app's modules — extensionless
// relative specifiers ("../interest") are resolved by the bundler, not by Node's
// ESM loader. So scripts/bots/urls.mjs carries a copy of the four URL builders,
// the bucket lists and the discover constants.
//
// This file is what makes that copy safe. It imports BOTH sides and asserts they
// agree. Change `relatedUrl` in the app, or add a topic, or retune
// DISCOVER_LIMIT, and this goes red — instead of the load test quietly measuring
// an app that no longer exists and reporting a healthy number for it.
//
// It lives in src/ (not scripts/) purely so the existing `npm run test` glob,
// `src/**/*.test.ts`, picks it up. No new vitest config, no new tooling.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  discoverUrl as appDiscoverUrl,
  relatedUrl as appRelatedUrl,
  doorwayUrl as appDoorwayUrl,
  summaryUrl as appSummaryUrl,
} from "./realms";
import { randomOffset as appRandomOffset } from "./discover";
import { QUEUE_AHEAD as appQueueAhead } from "./feedqueue";
import { TOPICS } from "./topics";
import { MET_BUCKETS } from "./realms/met.buckets";
import {
  discoverUrl as botDiscoverUrl,
  relatedUrl as botRelatedUrl,
  doorwayUrl as botDoorwayUrl,
  summaryUrl as botSummaryUrl,
  randomOffset as botRandomOffset,
  ENCYCLOPEDIA_BUCKETS,
  GALLERY_BUCKETS,
  REFILL_TOPICS,
  DISCOVER_LIMIT,
  SEED_LIMIT,
  QUEUE_AHEAD,
} from "../../scripts/bots/urls.mjs";

// Titles chosen to exercise the encoding: a space, an ampersand, a slash, a
// non-ASCII character and an apostrophe are all real Wikipedia titles, and each
// one is a way encodeURIComponent could be got wrong.
const IDS = [
  "Octopus",
  "Cerro Torre",
  "Rock & Roll",
  "AC/DC",
  "Ædelsten",
  "Bee's knees",
  "436535",
];

describe("load-bot URL builders match the app's", () => {
  it("builds identical related URLs", () => {
    for (const id of IDS) {
      expect(botRelatedUrl("encyclopedia", id)).toBe(
        appRelatedUrl("encyclopedia", id),
      );
      expect(botRelatedUrl("gallery", id)).toBe(appRelatedUrl("gallery", id));
    }
  });

  it("builds identical doorway URLs", () => {
    for (const id of IDS) {
      expect(botDoorwayUrl("encyclopedia", id)).toBe(
        appDoorwayUrl("encyclopedia", id),
      );
      expect(botDoorwayUrl("gallery", id)).toBe(appDoorwayUrl("gallery", id));
    }
  });

  it("builds identical summary URLs, plain and extended", () => {
    for (const id of IDS) {
      expect(botSummaryUrl("encyclopedia", id)).toBe(
        appSummaryUrl("encyclopedia", id),
      );
      expect(botSummaryUrl("encyclopedia", id, { extended: true })).toBe(
        appSummaryUrl("encyclopedia", id, { extended: true }),
      );
      expect(botSummaryUrl("gallery", id, { full: true })).toBe(
        appSummaryUrl("gallery", id, { full: true }),
      );
    }
  });

  it("builds identical discover URLs", () => {
    for (const bucket of ["biology", "philosophy-and-religion", "ukiyo-e"]) {
      const p = { bucket, offset: 40, limit: 4 };
      expect(botDiscoverUrl("encyclopedia", p)).toBe(
        appDiscoverUrl("encyclopedia", p),
      );
    }
  });
});

describe("load-bot buckets are ones the server will accept", () => {
  // The discover route rejects an unknown bucket with a 400 (its allowlist is
  // the injection guard). In a report that would look like a request that
  // worked and found nothing, which is the most misleading shape a bug can take
  // here — so prove membership rather than trusting the copy.
  it("every Encyclopedia bucket is a real topic keyword", () => {
    const known = new Set(TOPICS.map((t) => t.keyword));
    for (const b of ENCYCLOPEDIA_BUCKETS) expect(known).toContain(b);
  });

  it("every Gallery bucket is a real Met bucket id", () => {
    const known = new Set(MET_BUCKETS.map((b) => b.id));
    for (const b of GALLERY_BUCKETS) expect(known).toContain(b);
  });

  // Not just a subset: the whole point of the swarm is to spread across the
  // corpus the way a real population does. Silently dropping half the topics
  // would concentrate the bots onto fewer buckets and inflate the cache hit
  // ratio, which is the headline number of the report.
  it("covers every topic and every Met bucket", () => {
    expect(ENCYCLOPEDIA_BUCKETS.length).toBe(TOPICS.length);
    expect(GALLERY_BUCKETS.length).toBe(MET_BUCKETS.length);
  });
});

describe("load-bot discover constants match the feed's", () => {
  // These decide how often a drift costs a network call, which is most of the
  // difference between the real ~2.4 requests per card and a made-up number.
  // Read from the session engine, where they are declared as REFILL_TOPICS,
  // DISCOVER_LIMIT and (inside the bucket-seed branch) SEED_LIMIT.
  //
  // ⚠️ THE PATH MOVED ONCE AND THIS TEST IS WHY WE NOTICED. They used to live in
  // `drift/page.tsx`; Phase 1 of the continuous-feed work split that file into a
  // shell and `useDriftSession.ts`, and this went red the moment they moved,
  // which is exactly its job. If it goes red again after a refactor, re-point
  // it — do NOT relax the regex into something that can silently match nothing.
  const engine = new URL("../app/(app)/drift/useDriftSession.ts", import.meta.url);

  it("matches REFILL_TOPICS, DISCOVER_LIMIT and SEED_LIMIT in the feed", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(engine, "utf8"),
    );
    const read = (name: string): number => {
      const m = src.match(new RegExp(`const ${name} = (\\d+);`));
      if (!m) throw new Error(`${name} not found in useDriftSession.ts`);
      return Number(m[1]);
    };
    expect(REFILL_TOPICS).toBe(read("REFILL_TOPICS"));
    expect(DISCOVER_LIMIT).toBe(read("DISCOVER_LIMIT"));
    expect(SEED_LIMIT).toBe(read("SEED_LIMIT"));
  });

  // QUEUE_AHEAD is the one the continuous feed added, and it is the most
  // consequential of the four: it decides how many cards a thread pull hands back
  // to the buffer and how far ahead the threads lookahead runs, so getting it
  // wrong moves requests-per-card in both directions at once.
  //
  // Imported rather than scraped, because unlike the three above it lives in
  // `src/lib` and vitest can simply read it. A direct comparison cannot silently
  // match nothing, which is the failure mode the regex above has to guard against
  // by hand.
  it("matches QUEUE_AHEAD in the feed queue", () => {
    expect(QUEUE_AHEAD).toBe(appQueueAhead);
  });

  it("aligns offsets exactly as the app does", () => {
    // Same sequence into both, so a difference in the arithmetic shows up
    // rather than being hidden by two different random draws.
    for (const r of [0, 0.13, 0.5, 0.87, 0.999]) {
      const rng = () => r;
      expect(botRandomOffset(rng, 400, DISCOVER_LIMIT)).toBe(
        appRandomOffset(rng, 400, DISCOVER_LIMIT),
      );
      expect(botRandomOffset(rng, 400, SEED_LIMIT)).toBe(
        appRandomOffset(rng, 400, SEED_LIMIT),
      );
    }
  });
});
