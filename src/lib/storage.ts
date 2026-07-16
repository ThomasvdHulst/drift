import localforage from "localforage";
import type { Trail, SessionStats } from "./types";
import type { RealmId } from "./realms/types";
import type { Interest, Reaction } from "./interest";
import { pushSeen } from "./seen";
import { normalizeSeenEntry } from "./card";

// ---------------------------------------------------------------------------
// Thin IndexedDB wrapper (via localforage) — the app's only persistence. No
// server DB (spec §4). Client-only: the instance is created lazily so nothing
// touches IndexedDB during SSR. Keys: trails / settings / seen / sessions /
// interests / reactions / topicsCache. Pure list-mangling (FIFO seen) lives in
// seen.ts; the interest model lives in interest.ts; this file is just I/O.
// ---------------------------------------------------------------------------

const KEY = {
  trails: "trails",
  settings: "settings",
  seen: "seen",
  sessions: "sessions",
  interests: "interests",
  reactions: "reactions",
  topicsCache: "topicsCache",
  syncState: "syncState", // Phase 9: journal + pull cursors + last user (sync only)
} as const;

let _store: ReturnType<typeof localforage.createInstance> | null = null;
function db() {
  if (!_store) {
    _store = localforage.createInstance({ name: "drift", storeName: "drift" });
  }
  return _store;
}

// ---------------------------------------------------------------------------
// Sync plumbing (Phase 9). storage.ts stays the app's ONLY persistence seam; the
// replicator (src/lib/sync) layers cloud sync on top by (a) listening to change
// events, (b) reading/clearing a durable "journal" of un-pushed local changes so
// an offline edit/delete survives a reload, and (c) tracking a per-store pull
// cursor. All of it is inert when signed out (recording defaults off), so the
// local-only app is byte-for-byte unchanged.
// ---------------------------------------------------------------------------

export type SyncStore =
  | "trails"
  | "reactions"
  | "interests"
  | "settings"
  | "seen"
  | "sessions";

export interface StoreEvent {
  store: SyncStore;
  source: "local" | "remote";
}

const storeListeners = new Set<(e: StoreEvent) => void>();

/** Subscribe to store changes (local mutations + remote merges). Returns an
 *  unsubscribe. The replicator uses "local" to push; views use it to re-read. */
export function subscribeStore(fn: (e: StoreEvent) => void): () => void {
  storeListeners.add(fn);
  return () => storeListeners.delete(fn);
}

function emitStore(store: SyncStore, source: "local" | "remote"): void {
  for (const fn of storeListeners) {
    try {
      fn({ store, source });
    } catch {
      /* a listener throwing must never break a write */
    }
  }
}

// Journaling is off unless a user is signed in (the replicator flips it on), so
// signed-out mutations record nothing and cost nothing.
let recording = false;
export function setSyncRecording(on: boolean): void {
  recording = on;
}

interface CollectionPending {
  upserts: string[];
  deletes: string[];
}
export interface SyncJournal {
  trails?: CollectionPending;
  reactions?: CollectionPending;
  interests?: { dirty: boolean };
  settings?: { dirty: boolean };
  seen?: { dirty: boolean };
  sessions?: { dirty: boolean };
}
export interface SyncState {
  lastUserId?: string;
  cursors: Partial<Record<SyncStore, string>>;
  journal: SyncJournal;
}

let syncChain: Promise<unknown> = Promise.resolve();

export async function getSyncState(): Promise<SyncState> {
  const s = await db().getItem<SyncState>(KEY.syncState);
  return s ?? { cursors: {}, journal: {} };
}

// All syncState writes funnel through one chain so mutation-journaling and the
// replicator's cursor writes can't race on the read-modify-write.
function writeSyncState(mutate: (s: SyncState) => void): Promise<void> {
  const run = syncChain.then(async () => {
    const s = (await db().getItem<SyncState>(KEY.syncState)) ?? {
      cursors: {},
      journal: {},
    };
    s.cursors ??= {};
    s.journal ??= {};
    mutate(s);
    await db().setItem(KEY.syncState, s);
  });
  syncChain = run.catch(() => {});
  return run as Promise<void>;
}

function collectionPending(
  j: SyncJournal,
  store: "trails" | "reactions",
): CollectionPending {
  const cur = j[store] ?? { upserts: [], deletes: [] };
  j[store] = cur;
  return cur;
}

function recordUpsert(store: "trails" | "reactions", id: string): void {
  if (!recording) return;
  void writeSyncState((s) => {
    const p = collectionPending(s.journal, store);
    if (!p.upserts.includes(id)) p.upserts.push(id);
    p.deletes = p.deletes.filter((d) => d !== id);
  });
}

function recordDelete(store: "trails" | "reactions", id: string): void {
  if (!recording) return;
  void writeSyncState((s) => {
    const p = collectionPending(s.journal, store);
    if (!p.deletes.includes(id)) p.deletes.push(id);
    p.upserts = p.upserts.filter((u) => u !== id);
  });
}

/** Replicator: advance a store's pull cursor (newest server updatedAt merged). */
export function setCursor(store: SyncStore, pulledAt: string): Promise<void> {
  return writeSyncState((s) => {
    s.cursors[store] = pulledAt;
  });
}

/** Replicator: record which account this device's synced state belongs to. */
export function setLastUserId(uid: string | undefined): Promise<void> {
  return writeSyncState((s) => {
    s.lastUserId = uid;
  });
}

/** Replicator: drop successfully-pushed ids from a collection's journal, keeping
 *  any ids that arrived during the push. */
export function clearCollectionPending(
  store: "trails" | "reactions",
  pushed: { upserts?: string[]; deletes?: string[] },
): Promise<void> {
  return writeSyncState((s) => {
    const p = s.journal[store];
    if (!p) return;
    if (pushed.upserts?.length)
      p.upserts = p.upserts.filter((id) => !pushed.upserts!.includes(id));
    if (pushed.deletes?.length)
      p.deletes = p.deletes.filter((id) => !pushed.deletes!.includes(id));
  });
}

type BlobStore = "interests" | "settings" | "seen" | "sessions";

function recordBlobDirty(store: BlobStore): void {
  if (!recording) return;
  void setBlobDirty(store, true);
}

/** Replicator/mutation: set or clear a blob store's dirty flag. */
export function setBlobDirty(store: BlobStore, dirty: boolean): Promise<void> {
  return writeSyncState((s) => {
    s.journal[store] = { dirty };
  });
}

/** First-sign-in adoption: mark every local record (trails, reactions, blobs)
 *  as needing upload so a signed-out user's whole world migrates into their new
 *  account. A safety net beyond the live journal, for data that predates it.
 *
 *  Crucially, only NON-EMPTY blobs are marked dirty: a fresh device with default
 *  (empty) settings/interests/seen/sessions must PULL the account's values, not
 *  push its blanks over them. */
export async function markAllDirtyForAdoption(): Promise<void> {
  const trails = (await db().getItem<Trail[]>(KEY.trails)) ?? [];
  const reactions = await getReactions();
  const interest = await getInterest();
  const settings = await getSettings();
  const seen = await loadSeen();
  const sessions = await listSessions();
  return writeSyncState((s) => {
    const tp = collectionPending(s.journal, "trails");
    for (const t of trails) if (!tp.upserts.includes(t.id)) tp.upserts.push(t.id);
    const rp = collectionPending(s.journal, "reactions");
    for (const id of Object.keys(reactions))
      if (!rp.upserts.includes(id)) rp.upserts.push(id);
    if (Object.keys(interest).length) s.journal.interests = { dirty: true };
    if (Object.keys(settings).length) s.journal.settings = { dirty: true };
    if (seen.length) s.journal.seen = { dirty: true };
    if (sessions.length) s.journal.sessions = { dirty: true };
  });
}

/** Account switch on one device: drop all pending so the previous account's
 *  un-pushed edits don't bleed into the new account. */
export function clearAllPending(): Promise<void> {
  return writeSyncState((s) => {
    s.journal = {};
  });
}

/** Reset every store's pull cursor (e.g. on first sign-in / account switch, to
 *  pull the account's full set). */
export function resetAllCursors(): Promise<void> {
  return writeSyncState((s) => {
    s.cursors = {};
  });
}

/** Phase 13: wipe EVERY local store — used on sign-out and on switching to a
 *  different account, so no account's trails/interests/etc. ever linger for the
 *  next person on this device. Clears the sync journal + cursors + lastUserId too
 *  (so the next sign-in pulls that account's full set fresh). Does NOT touch
 *  localStorage — the `drift-theme` UI mirror stays (no theme flash) and Supabase
 *  clears its own `drift-auth` session key. Emits a "remote"-source event per
 *  store (not journaled) so any open view re-reads to an empty state. */
export async function clearAllLocalData(): Promise<void> {
  await Promise.all(
    Object.values(KEY).map((k) => db().removeItem(k).catch(() => {})),
  );
  const stores: SyncStore[] = [
    "trails",
    "reactions",
    "interests",
    "settings",
    "seen",
    "sessions",
  ];
  for (const store of stores) emitStore(store, "remote");
}

// ----- Trails -----

// Serialize all trail read-modify-writes: user actions and the background
// replicator now run concurrently, so an unguarded read-modify-write could lose
// updates. Every trails write goes through this chain.
let trailsChain: Promise<unknown> = Promise.resolve();
function withTrails<T>(
  fn: (all: Trail[]) => { result: T; next?: Trail[] },
): Promise<T> {
  const run = trailsChain.then(async () => {
    const all = (await db().getItem<Trail[]>(KEY.trails)) ?? [];
    const { result, next } = fn(all);
    if (next) await db().setItem(KEY.trails, next);
    return result;
  });
  trailsChain = run.catch(() => {});
  return run as Promise<T>;
}

export async function listTrails(): Promise<Trail[]> {
  const all = (await db().getItem<Trail[]>(KEY.trails)) ?? [];
  // Newest first for display.
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}

export async function getTrail(id: string): Promise<Trail | null> {
  const all = await listTrails();
  return all.find((t) => t.id === id) ?? null;
}

/** Insert or update a trail (matched by id). */
export async function saveTrail(trail: Trail): Promise<void> {
  await withTrails((all) => {
    const idx = all.findIndex((t) => t.id === trail.id);
    if (idx >= 0) all[idx] = trail;
    else all.push(trail);
    return { result: undefined, next: all };
  });
  recordUpsert("trails", trail.id);
  emitStore("trails", "local");
}

async function patchTrail(
  id: string,
  patch: Partial<Trail>,
): Promise<Trail | null> {
  const updated = await withTrails<Trail | null>((all) => {
    const idx = all.findIndex((t) => t.id === id);
    if (idx < 0) return { result: null };
    all[idx] = { ...all[idx], ...patch };
    return { result: all[idx], next: all };
  });
  if (updated) {
    recordUpsert("trails", id);
    emitStore("trails", "local");
  }
  return updated;
}

export function renameTrail(id: string, name: string): Promise<Trail | null> {
  return patchTrail(id, { name });
}

export function setTrailLiked(
  id: string,
  liked: boolean,
): Promise<Trail | null> {
  return patchTrail(id, { liked });
}

export async function deleteTrail(id: string): Promise<void> {
  await withTrails((all) => ({
    result: undefined,
    next: all.filter((t) => t.id !== id),
  }));
  recordDelete("trails", id);
  emitStore("trails", "local");
}

/** Replicator-only: overwrite the local trail set with a cloud-merged one
 *  WITHOUT journaling it (it's remote data, not a local edit) and announce it so
 *  open views re-read. */
export async function applyRemoteTrails(trails: Trail[]): Promise<void> {
  await withTrails(() => ({ result: undefined, next: trails }));
  emitStore("trails", "remote");
}

// ----- Settings -----

export interface Settings {
  theme?: "light" | "dark" | "system";
  // Whether drift is personalized by the interest model (M9). Undefined = on;
  // the user can switch it off from the /interests page.
  personalize?: boolean;
  // The realm tab the user last used on the homepage (Phase 5). Undefined =
  // Encyclopedia.
  lastRealm?: RealmId;
}

export async function getSettings(): Promise<Settings> {
  return (await db().getItem<Settings>(KEY.settings)) ?? {};
}

let settingsChain: Promise<void> = Promise.resolve();

export function setSettings(patch: Settings): Promise<void> {
  settingsChain = settingsChain
    .then(async () => {
      const current = (await db().getItem<Settings>(KEY.settings)) ?? {};
      await db().setItem(KEY.settings, { ...current, ...patch });
    })
    .catch(() => {});
  recordBlobDirty("settings");
  emitStore("settings", "local");
  return settingsChain;
}

/** Replicator-only: overwrite settings from the cloud (no journaling). */
export function applyRemoteSettings(settings: Settings): Promise<void> {
  settingsChain = settingsChain
    .then(() => db().setItem(KEY.settings, settings))
    .then(() => {})
    .catch(() => {});
  const p = settingsChain;
  emitStore("settings", "remote");
  return p;
}

// ----- Interest model (M9) -----

export async function getInterest(): Promise<Interest> {
  return (await db().getItem<Interest>(KEY.interests)) ?? {};
}

let interestChain: Promise<void> = Promise.resolve();

/** Persist the whole interest map (the caller holds it as in-memory truth). */
export function setInterest(interest: Interest): Promise<void> {
  interestChain = interestChain
    .then(() => db().setItem(KEY.interests, interest))
    .then(() => {})
    .catch(() => {});
  recordBlobDirty("interests");
  emitStore("interests", "local");
  return interestChain;
}

/** Replicator-only: overwrite the interest map from the cloud (no journaling). */
export function applyRemoteInterest(interest: Interest): Promise<void> {
  interestChain = interestChain
    .then(() => db().setItem(KEY.interests, interest))
    .then(() => {})
    .catch(() => {});
  const p = interestChain;
  emitStore("interests", "remote");
  return p;
}

export async function getReactions(): Promise<Record<string, Reaction>> {
  const raw = (await db().getItem<Record<string, Reaction>>(KEY.reactions)) ?? {};
  // Migrate legacy title-keyed reactions to cardId keys (Phase 5). Pure remap on
  // read; the next setReaction persists the normalized shape.
  const out: Record<string, Reaction> = {};
  for (const [k, v] of Object.entries(raw)) out[normalizeSeenEntry(k)] = v;
  return out;
}

let reactionChain: Promise<void> = Promise.resolve();

/** Set (or clear, with null) a card's ♥/✕ reaction, keyed by cardId. Serialized
 *  to avoid races. */
export function setReaction(
  id: string,
  reaction: Reaction | null,
): Promise<void> {
  reactionChain = reactionChain
    .then(async () => {
      const all = await getReactions();
      if (reaction === null) delete all[id];
      else all[id] = reaction;
      await db().setItem(KEY.reactions, all);
    })
    .catch(() => {});
  if (reaction === null) recordDelete("reactions", id);
  else recordUpsert("reactions", id);
  emitStore("reactions", "local");
  return reactionChain;
}

/** Replicator-only: overwrite the reactions map from the cloud (no journaling). */
export function applyRemoteReactions(
  reactions: Record<string, Reaction>,
): Promise<void> {
  reactionChain = reactionChain
    .then(() => db().setItem(KEY.reactions, reactions))
    .then(() => {})
    .catch(() => {});
  const p = reactionChain;
  emitStore("reactions", "remote");
  return p;
}

// Per-title topic cache, so re-reacting to a page costs no extra API call.

export async function getCachedTopics(
  title: string,
): Promise<string[] | undefined> {
  const all =
    (await db().getItem<Record<string, string[]>>(KEY.topicsCache)) ?? {};
  return all[title];
}

let topicsCacheChain: Promise<void> = Promise.resolve();

export function cacheTopics(title: string, topics: string[]): Promise<void> {
  topicsCacheChain = topicsCacheChain
    .then(async () => {
      const all =
        (await db().getItem<Record<string, string[]>>(KEY.topicsCache)) ?? {};
      all[title] = topics;
      await db().setItem(KEY.topicsCache, all);
    })
    .catch(() => {});
  return topicsCacheChain;
}

// ----- Seen list (persistent, decaying) -----

export async function loadSeen(): Promise<string[]> {
  const list = (await db().getItem<string[]>(KEY.seen)) ?? [];
  // Normalize legacy bare-title entries to cardIds (Phase 5). Re-persisting via
  // persistSeen then lazily migrates the stored list.
  return list.map(normalizeSeenEntry);
}

// Serialize seen writes so rapid fire-and-forget calls (one per card) can't race
// on the read-modify-write.
let seenChain: Promise<void> = Promise.resolve();

/** Merge titles into the stored seen-list with FIFO decay, then persist. */
export function persistSeen(titles: string[]): Promise<void> {
  seenChain = seenChain
    .then(async () => {
      let list = await loadSeen();
      for (const t of titles) list = pushSeen(list, t);
      await db().setItem(KEY.seen, list);
    })
    .catch(() => {});
  recordBlobDirty("seen");
  emitStore("seen", "local");
  return seenChain;
}

/** Replicator-only: overwrite the seen-list from the cloud (no journaling). */
export function applyRemoteSeen(list: string[]): Promise<void> {
  seenChain = seenChain
    .then(() => db().setItem(KEY.seen, list))
    .then(() => {})
    .catch(() => {});
  const p = seenChain;
  emitStore("seen", "remote");
  return p;
}

// ----- Session stats -----

export async function listSessions(): Promise<SessionStats[]> {
  return (await db().getItem<SessionStats[]>(KEY.sessions)) ?? [];
}

let sessionChain: Promise<void> = Promise.resolve();

/** Upsert a session by id (so re-opening the end screen updates, not duplicates). */
export function recordSession(stats: SessionStats): Promise<void> {
  sessionChain = sessionChain
    .then(async () => {
      const all = await listSessions();
      const idx = all.findIndex((s) => s.id === stats.id);
      if (idx >= 0) all[idx] = stats;
      else all.push(stats);
      // Keep the tail — this is a personal hobby app, not analytics.
      await db().setItem(KEY.sessions, all.slice(-300));
    })
    .catch(() => {});
  recordBlobDirty("sessions");
  emitStore("sessions", "local");
  return sessionChain;
}

/** Replicator-only: overwrite the sessions list from the cloud (no journaling). */
export function applyRemoteSessions(list: SessionStats[]): Promise<void> {
  sessionChain = sessionChain
    .then(() => db().setItem(KEY.sessions, list.slice(-300)))
    .then(() => {})
    .catch(() => {});
  const p = sessionChain;
  emitStore("sessions", "remote");
  return p;
}
