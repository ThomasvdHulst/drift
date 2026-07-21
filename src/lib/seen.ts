// ---------------------------------------------------------------------------
// Persistent "seen" list with FIFO decay (spec §5): newest titles at the end,
// oldest dropped once we pass the cap — so revisits eventually become possible
// again instead of a page being blacklisted forever. Pure + unit-tested.
// ---------------------------------------------------------------------------

export const SEEN_CAP = 500;

/** Return a new list with `title` recorded as most-recently-seen (deduped, capped). */
export function pushSeen(
  list: string[],
  title: string,
  cap = SEEN_CAP,
): string[] {
  if (!title) return list;
  const next = list.filter((t) => t !== title); // drop any existing → move to newest
  next.push(title);
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/**
 * Union another device's seen-list into this one (cloud sync, Phase 9).
 *
 * Deliberately NOT `remote.reduce(pushSeen)`: that is O(n·m) with a fresh array
 * per entry, and it promotes every remote title to "most recently seen", so the
 * other device's stale entries would outrank this device's genuinely-recent ones
 * and the cap would decay the wrong ones. This keeps local recency order intact
 * and appends only titles this device hasn't seen, in one pass.
 */
export function unionSeen(
  local: string[],
  remote: string[],
  cap = SEEN_CAP,
): string[] {
  const known = new Set(local);
  const merged = local.slice();
  for (const title of remote) {
    if (!title || known.has(title)) continue;
    known.add(title);
    merged.push(title);
  }
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}
