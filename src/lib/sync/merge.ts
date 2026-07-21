// ---------------------------------------------------------------------------
// Pure merge logic for local-first sync (Phase 9). No React/DOM/Supabase here —
// just data in, data out — so it's fully unit-testable and portable to a future
// app (CLAUDE.md future-app guidance).
//
// Model: the SERVER owns `updatedAt` (a Postgres timestamptz string); it is the
// authoritative ordering clock. Sync is last-write-wins with two safety rules:
//   1. A local record marked "dirty" (an un-pushed local edit) is NEVER
//      overwritten by a remote row — the local edit wins and will be pushed,
//      where the server settles the order. This prevents a background pull from
//      clobbering something the user just did offline.
//   2. Deletes travel as remote rows with `deleted = true` (soft-delete), so a
//      delete on one device propagates instead of silently reappearing.
// ---------------------------------------------------------------------------

/** A row pulled from the server, normalized to the app's shape. */
export interface RemoteRecord<T> {
  id: string;
  data: T; // the app object (Trail, Reaction, …) with no sync columns
  updatedAt: string; // ISO timestamptz from the server
  deleted: boolean;
}

export interface MergeResult<T> {
  /** The local id→record map after merging. */
  next: Record<string, T>;
  /** ids added / updated / removed — lets the caller skip no-op writes + events. */
  changedIds: string[];
  /** New cursor: the newest `updatedAt` seen (or the prior cursor if none newer). */
  pulledAt: string;
}

/** Parse a server timestamp to ms, treating anything malformed as the epoch so
 *  a bad clock value can never win a comparison. Shared with the replicator. */
export function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function sameData<T>(a: T | undefined, b: T): boolean {
  // We construct these objects ourselves (stable key order), so a stringify
  // compare is a sound, cheap change-detector. A false "different" only costs
  // one redundant local write — never incorrect.
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Merge remote rows into a local collection (last-write-wins, dirty-aware,
 * soft-delete-aware). Pure: returns the next state without mutating inputs.
 */
export function mergeCollection<T>(
  local: Record<string, T>,
  remote: RemoteRecord<T>[],
  dirtyIds: ReadonlySet<string>,
  priorPulledAt: string,
): MergeResult<T> {
  const next: Record<string, T> = { ...local };
  const changedIds: string[] = [];
  let bestIso = priorPulledAt;
  let bestMs = toMs(priorPulledAt);

  for (const r of remote) {
    const rMs = toMs(r.updatedAt);
    if (rMs > bestMs) {
      bestMs = rMs;
      bestIso = r.updatedAt;
    }
    // A pending local edit outranks whatever the server currently holds.
    if (dirtyIds.has(r.id)) continue;

    if (r.deleted) {
      if (r.id in next) {
        delete next[r.id];
        changedIds.push(r.id);
      }
    } else if (!sameData(next[r.id], r.data)) {
      next[r.id] = r.data;
      changedIds.push(r.id);
    }
  }

  return { next, changedIds, pulledAt: bestIso };
}

/** Convenience: index an array of records by a key field into a map. */
export function indexBy<T>(items: T[], key: (t: T) => string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const it of items) out[key(it)] = it;
  return out;
}

/**
 * Union two id-keyed lists (used for the `sessions` blob so two devices' session
 * histories combine instead of one whole list clobbering the other). Local wins
 * on an id collision (session ids are unique per device, so this is rare). Order
 * isn't meaningful for these records, so it's not preserved.
 */
export function mergeSessions<T extends { id: string }>(
  local: T[],
  remote: T[],
): T[] {
  const map = new Map<string, T>();
  for (const s of remote) map.set(s.id, s);
  for (const s of local) map.set(s.id, s); // local is the fresher truth on collision
  return [...map.values()];
}
