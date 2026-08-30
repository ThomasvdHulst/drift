// ---------------------------------------------------------------------------
// Deterministic day-stable ordering, shared by everything that windows into a
// list of Met object ids: room pools, artist rings, form/period slices, and
// (since Phase 35) the baked facet lists behind a card's threads.
//
// It lived inside `realms/server/met.ts` until Phase 35, which made it awkward
// twice over: `met.window.test.ts` had to RE-IMPLEMENT `windowStart` to test it,
// because importing the server adapter pulls in server-only fetch code, and the
// new pure facet module could not reach it at all. It is pure logic with no
// network and no DOM, so per CLAUDE.md §8.4 it belongs here.
// ---------------------------------------------------------------------------

/** A small deterministic PRNG (mulberry32) so a shuffle can be reproduced. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, for turning a seed string into a PRNG seed. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Shuffle a pool with a seed that is stable for one key for one day.
 *
 * WHY SHUFFLE AT ALL. The museum returns ids in roughly accession order, so an
 * unshuffled window would serve the same corner of a department to everybody and
 * would front-load its oldest accessions.
 *
 * WHY DAY-STABLE. The discover route caches a batch at the edge for a day. If
 * the order moved per request, every reader would get a cache miss and every
 * miss is upstream traffic — the exact traffic that trips the 403. A seed that
 * turns over at midnight gives variety across days while letting one day's
 * windows be shared.
 */
export function dailyWindowOrder(
  key: string,
  ids: number[],
  today = new Date(),
): number[] {
  const day = today.toISOString().slice(0, 10);
  const rnd = mulberry32(hash(`${key}:${day}`));
  const out = ids.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Where in a pool a batch starts.
 *
 * ⚠️ `offset` IS A CARD INDEX, not a page number. `randomOffset` (lib/discover.ts)
 * returns a card index already aligned to the window size, and the feed's
 * sequential artist paging advances it by whole windows too. Multiplying it by
 * `limit` here — which the adapter did at first — squares the stride: a refill
 * meant to move 12 cards along moved 144, which for a small oeuvre wrapped
 * chaotically and re-served work the reader had just seen.
 *
 * Wraps rather than running off the end, so a reader who drifts deeper than the
 * pool is long loops through it again instead of hitting a wall.
 */
export function windowStart(offset: number, poolSize: number): number {
  return poolSize > 0 ? offset % poolSize : 0;
}
