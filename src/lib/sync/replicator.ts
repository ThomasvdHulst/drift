// ---------------------------------------------------------------------------
// The local-first replicator (Phase 9). A thin, fully-guarded shell around the
// pure merge logic (./merge) and the storage.ts sync journal. It NEVER throws
// into the app: Supabase down / offline / malformed ⇒ it quietly degrades and
// the local app keeps working (CLAUDE.md §4).
//
// Two shapes of store:
//   • collections (trails, reactions) — one row per record, per-record LWW,
//     soft-delete tombstones; merged by mergeCollection().
//   • blobs (interests, settings, seen, sessions) — one row per user in user_kv.
//     interests/settings are whole-value LWW; seen/sessions UNION across devices
//     (a whole-value overwrite would drop the other device's entries).
//
// The server owns `updated_at` (a trigger), so it is the authoritative ordering
// clock. Flow: local change → debounced push of the journal; sign-in / focus /
// visibility / online → full pull+push; first sign-in → adopt the signed-out
// user's whole local world into the account.
// ---------------------------------------------------------------------------

import { getSupabase } from "@/lib/supabase/client";
import {
  subscribeStore,
  getSyncState,
  setCursor,
  setLastUserId,
  setBlobDirty,
  clearCollectionPending,
  clearAllLocalData,
  resetAllCursors,
  markAllDirtyForAdoption,
  listTrails,
  applyRemoteTrails,
  getReactions,
  applyRemoteReactions,
  getInterest,
  applyRemoteInterest,
  getSettings,
  applyRemoteSettings,
  loadSeen,
  applyRemoteSeen,
  listSessions,
  applyRemoteSessions,
  type StoreEvent,
  type Settings,
} from "@/lib/storage";
import { unionSeen } from "@/lib/seen";
import {
  mergeCollection,
  mergeSessions,
  indexBy,
  toMs,
  type RemoteRecord,
} from "./merge";
import type { Interest, Reaction } from "@/lib/interest";
import type { Trail, TrailStep, SessionStats } from "@/lib/types";

const EPOCH = "1970-01-01T00:00:00.000Z";
const PUSH_DEBOUNCE_MS = 1500;

export type SyncStatus = "disabled" | "idle" | "syncing" | "offline";

const newer = (a: string, b: string) => toMs(a) > toMs(b);

// ---- trail ⇄ row mapping (sync columns live only on the row) ----
type TrailRow = {
  id: string;
  name: string | null;
  realm: string | null;
  liked: boolean | null;
  created_at_ms: number | string | null;
  steps: unknown;
  updated_at: string;
  deleted: boolean | null;
};

function trailToRow(t: Trail, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    name: t.name,
    realm: t.realm ?? null,
    liked: t.liked,
    created_at_ms: t.createdAt,
    steps: t.steps,
    deleted: false,
  };
}

function rowToTrail(row: TrailRow): Trail {
  return {
    id: row.id,
    name: row.name ?? "",
    steps: (row.steps ?? []) as TrailStep[],
    createdAt: Number(row.created_at_ms) || 0,
    liked: !!row.liked,
    realm: (row.realm ?? undefined) as Trail["realm"],
  };
}

// ---- module state (one replicator per tab) ----
let running = false;
let currentUserId: string | null = null;
let unsub: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let onFocus: (() => void) | null = null;
let onVisible: (() => void) | null = null;
let onOnline: (() => void) | null = null;
let inFlight = false;
let rerun = false;

let status: SyncStatus = "disabled";
const statusListeners = new Set<(s: SyncStatus) => void>();

function setStatus(s: SyncStatus) {
  if (s === status) return;
  status = s;
  for (const fn of statusListeners) {
    try {
      fn(s);
    } catch {
      /* ignore */
    }
  }
}

// A sync cycle runs 12 sub-steps (6 pulls + 6 pushes). Each one used to set its
// own terminal status, so a later success silently overwrote an earlier
// failure's "offline" and the account page reported a clean sync that wasn't.
// Sub-steps now only report failure into this cycle-scoped flag; `run()` sets the
// one terminal status at the end.
let cycleFailed = false;

function markCycleFailed() {
  cycleFailed = true;
}

export function getSyncStatus(): SyncStatus {
  return status;
}
export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

// ======================= collections (trails, reactions) =======================
interface CollectionSpec<T> {
  store: "trails" | "reactions";
  table: string;
  onConflict: string;
  loadLocalMap: () => Promise<Record<string, T>>;
  applyRemote: (map: Record<string, T>) => Promise<void>;
  toUpsertRow: (id: string, data: T, userId: string) => Record<string, unknown>;
  toDeleteRow: (id: string, userId: string) => Record<string, unknown>;
  fromRow: (row: Record<string, unknown>) => RemoteRecord<T>;
}

async function pullCollection<T>(spec: CollectionSpec<T>): Promise<void> {
  const sb = getSupabase();
  if (!sb || !running) return;
  try {
    setStatus("syncing");
    const state = await getSyncState();
    const cursor = state.cursors[spec.store] ?? EPOCH;
    const { data, error } = await sb
      .from(spec.table)
      .select("*")
      .gt("updated_at", cursor)
      .order("updated_at", { ascending: true });
    if (error) throw error;
    const remote = (data ?? []).map((r) => spec.fromRow(r as Record<string, unknown>));
    const localMap = await spec.loadLocalMap();
    const p = state.journal[spec.store];
    const dirty = new Set([...(p?.upserts ?? []), ...(p?.deletes ?? [])]);
    const merged = mergeCollection(localMap, remote, dirty, cursor);
    if (merged.changedIds.length) await spec.applyRemote(merged.next);
    if (merged.pulledAt !== cursor) await setCursor(spec.store, merged.pulledAt);
  } catch {
    markCycleFailed();
  }
}

async function pushCollection<T>(spec: CollectionSpec<T>): Promise<void> {
  const sb = getSupabase();
  if (!sb || !running || !currentUserId) return;
  const state = await getSyncState();
  const pending = state.journal[spec.store];
  if (!pending || (!pending.upserts.length && !pending.deletes.length)) return;
  const upsertIds = [...pending.upserts];
  const deleteIds = [...pending.deletes];
  try {
    setStatus("syncing");
    if (upsertIds.length) {
      const map = await spec.loadLocalMap();
      const rows = upsertIds
        .filter((id) => map[id] !== undefined)
        .map((id) => spec.toUpsertRow(id, map[id], currentUserId!));
      if (rows.length) {
        const { error } = await sb
          .from(spec.table)
          .upsert(rows, { onConflict: spec.onConflict });
        if (error) throw error;
      }
    }
    if (deleteIds.length) {
      const rows = deleteIds.map((id) => spec.toDeleteRow(id, currentUserId!));
      const { error } = await sb
        .from(spec.table)
        .upsert(rows, { onConflict: spec.onConflict });
      if (error) throw error;
    }
    await clearCollectionPending(spec.store, {
      upserts: upsertIds,
      deletes: deleteIds,
    });
  } catch {
    markCycleFailed(); // keep the journal; retry on next change / focus
  }
}

const trailsSpec: CollectionSpec<Trail> = {
  store: "trails",
  table: "trails",
  onConflict: "id",
  loadLocalMap: async () => indexBy(await listTrails(), (t) => t.id),
  applyRemote: (map) => applyRemoteTrails(Object.values(map)),
  toUpsertRow: (_id, t, uid) => trailToRow(t, uid),
  toDeleteRow: (id, uid) => ({ id, user_id: uid, deleted: true }),
  fromRow: (row) => {
    const r = row as TrailRow;
    return { id: r.id, data: rowToTrail(r), updatedAt: r.updated_at, deleted: !!r.deleted };
  },
};

const reactionsSpec: CollectionSpec<Reaction> = {
  store: "reactions",
  table: "reactions",
  onConflict: "user_id,card_id",
  loadLocalMap: () => getReactions(),
  applyRemote: (map) => applyRemoteReactions(map),
  toUpsertRow: (id, r, uid) => ({ user_id: uid, card_id: id, reaction: r, deleted: false }),
  // reaction is NOT NULL; a placeholder is fine — deleted rows are filtered out.
  toDeleteRow: (id, uid) => ({ user_id: uid, card_id: id, reaction: "like", deleted: true }),
  fromRow: (row) => {
    const r = row as { card_id: string; reaction: Reaction; updated_at: string; deleted: boolean };
    return { id: r.card_id, data: r.reaction, updatedAt: r.updated_at, deleted: !!r.deleted };
  },
};

// ======================= blobs (user_kv, one row per user) =======================
interface BlobSpec<T> {
  store: "interests" | "settings" | "seen" | "sessions";
  loadLocal: () => Promise<T>;
  applyRemote: (v: T) => Promise<void>;
  // Present ⇒ union store (seen/sessions): combine local+remote instead of LWW.
  union?: (local: T, remote: T) => T;
}

async function pullBlob<T>(spec: BlobSpec<T>): Promise<void> {
  const sb = getSupabase();
  if (!sb || !running) return;
  try {
    setStatus("syncing");
    const state = await getSyncState();
    const cursor = state.cursors[spec.store] ?? EPOCH;
    const dirty = !!state.journal[spec.store]?.dirty;
    const { data, error } = await sb
      .from("user_kv")
      .select("value,updated_at")
      .eq("key", spec.store)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const remoteVal = data.value as T;
      const remoteAt = data.updated_at as string;
      const local = await spec.loadLocal();
      if (spec.union) {
        const merged = spec.union(local, remoteVal);
        if (JSON.stringify(merged) !== JSON.stringify(local)) {
          await spec.applyRemote(merged);
          await setBlobDirty(spec.store, true); // push the union back so both converge
        }
        if (newer(remoteAt, cursor)) await setCursor(spec.store, remoteAt);
      } else if (!dirty && newer(remoteAt, cursor)) {
        if (JSON.stringify(remoteVal) !== JSON.stringify(local))
          await spec.applyRemote(remoteVal);
        await setCursor(spec.store, remoteAt);
      }
    }
  } catch {
    markCycleFailed();
  }
}

async function pushBlob<T>(spec: BlobSpec<T>): Promise<void> {
  const sb = getSupabase();
  if (!sb || !running || !currentUserId) return;
  const state = await getSyncState();
  if (!state.journal[spec.store]?.dirty) return;
  try {
    setStatus("syncing");
    const value = await spec.loadLocal();
    const { data, error } = await sb
      .from("user_kv")
      .upsert({ user_id: currentUserId, key: spec.store, value }, { onConflict: "user_id,key" })
      .select("updated_at")
      .single();
    if (error) throw error;
    await setBlobDirty(spec.store, false);
    if (data?.updated_at) await setCursor(spec.store, data.updated_at as string);
  } catch {
    markCycleFailed();
  }
}

const interestsSpec: BlobSpec<Interest> = {
  store: "interests",
  loadLocal: getInterest,
  applyRemote: applyRemoteInterest,
};
const settingsSpec: BlobSpec<Settings> = {
  store: "settings",
  loadLocal: getSettings,
  applyRemote: applyRemoteSettings,
};
const seenSpec: BlobSpec<string[]> = {
  store: "seen",
  loadLocal: loadSeen,
  applyRemote: applyRemoteSeen,
  union: unionSeen,
};
const sessionsSpec: BlobSpec<SessionStats[]> = {
  store: "sessions",
  loadLocal: listSessions,
  applyRemote: applyRemoteSessions,
  union: (local, remote) => mergeSessions(local, remote),
};

// ======================= orchestration =======================
async function pullAll(): Promise<void> {
  await pullCollection(trailsSpec);
  await pullCollection(reactionsSpec);
  await pullBlob(interestsSpec);
  await pullBlob(settingsSpec);
  await pullBlob(seenSpec);
  await pullBlob(sessionsSpec);
}

async function pushAll(): Promise<void> {
  await pushCollection(trailsSpec);
  await pushCollection(reactionsSpec);
  await pushBlob(interestsSpec);
  await pushBlob(settingsSpec);
  await pushBlob(seenSpec);
  await pushBlob(sessionsSpec);
}

// Coalesce overlapping cycles; if a change lands mid-cycle, run one more push.
async function run(withPull: boolean): Promise<void> {
  if (inFlight) {
    rerun = true;
    return;
  }
  inFlight = true;
  cycleFailed = false;
  try {
    if (withPull) await pullAll();
    await pushAll();
  } finally {
    inFlight = false;
    // One terminal status for the whole cycle: any failed sub-step means we are
    // not actually in sync, so don't report "idle" just because the last store
    // happened to succeed.
    if (running) setStatus(cycleFailed ? "offline" : "idle");
    if (rerun) {
      rerun = false;
      void run(false);
    }
  }
}

async function syncNow(): Promise<void> {
  return run(true);
}

/**
 * Best-effort push of any pending local changes to the cloud — called right
 * before sign-out (Phase 13), so an un-pushed trail isn't lost when local data
 * is then wiped. No-op when not running; fully guarded (never throws).
 */
export async function flushSync(): Promise<void> {
  if (!running) return;
  try {
    await run(false);
  } catch {
    /* offline / backend down — nothing more we can do; local wipe follows */
  }
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void run(false);
  }, PUSH_DEBOUNCE_MS);
}

async function handleSignIn(userId: string): Promise<void> {
  const state = await getSyncState();
  if (state.lastUserId !== userId) {
    if (!state.lastUserId) {
      // First account on this device (anon/local → account): adopt the local
      // world into the new account, then pull its full set.
      await resetAllCursors();
      await markAllDirtyForAdoption();
    } else {
      // Switching to a DIFFERENT account on this device: wipe the previous
      // account's local world so nothing bleeds across (this also clears the
      // journal, cursors, and lastUserId), then pull the new account's set.
      await clearAllLocalData();
    }
    await setLastUserId(userId);
  }
  await syncNow();
}

/**
 * Start syncing for a signed-in user. Idempotent per user; safe to call on every
 * auth change. No-op (stays local-only) when Supabase isn't configured.
 */
export async function startSync(userId: string): Promise<void> {
  if (!getSupabase()) return;
  if (running && currentUserId === userId) return;
  if (running) stopSync();

  running = true;
  currentUserId = userId;

  // Only local edits need pushing; remote merges must not loop back into a push.
  unsub = subscribeStore((e: StoreEvent) => {
    if (e.source === "local") schedulePush();
  });

  // Focus / tab-visible / regained-connectivity → full sync (pull picks up other
  // devices; push flushes anything journaled while offline).
  onFocus = () => void syncNow();
  onVisible = () => {
    if (document.visibilityState === "visible") void syncNow();
  };
  onOnline = () => void syncNow();
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);

  await handleSignIn(userId);
}

/**
 * Stop syncing (sign-out). Cancels timers/listeners and clears status, but LEAVES
 * local IndexedDB and the journal intact so the app keeps working locally and any
 * un-pushed changes still sync on the next sign-in.
 */
export function stopSync(): void {
  running = false;
  currentUserId = null;
  if (unsub) {
    unsub();
    unsub = null;
  }
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (onFocus) window.removeEventListener("focus", onFocus);
  if (onVisible) document.removeEventListener("visibilitychange", onVisible);
  if (onOnline) window.removeEventListener("online", onOnline);
  onFocus = onVisible = onOnline = null;
  setStatus("disabled");
}
