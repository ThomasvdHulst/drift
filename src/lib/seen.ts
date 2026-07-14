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
