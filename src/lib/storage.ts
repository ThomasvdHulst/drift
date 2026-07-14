import localforage from "localforage";
import type { Trail, SessionStats } from "./types";
import type { Interest, Reaction } from "./interest";
import { pushSeen } from "./seen";

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
} as const;

let _store: ReturnType<typeof localforage.createInstance> | null = null;
function db() {
  if (!_store) {
    _store = localforage.createInstance({ name: "drift", storeName: "drift" });
  }
  return _store;
}

// ----- Trails -----

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
  const all = (await db().getItem<Trail[]>(KEY.trails)) ?? [];
  const idx = all.findIndex((t) => t.id === trail.id);
  if (idx >= 0) all[idx] = trail;
  else all.push(trail);
  await db().setItem(KEY.trails, all);
}

async function patchTrail(
  id: string,
  patch: Partial<Trail>,
): Promise<Trail | null> {
  const all = (await db().getItem<Trail[]>(KEY.trails)) ?? [];
  const idx = all.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  await db().setItem(KEY.trails, all);
  return all[idx];
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
  const all = (await db().getItem<Trail[]>(KEY.trails)) ?? [];
  await db().setItem(
    KEY.trails,
    all.filter((t) => t.id !== id),
  );
}

// ----- Settings -----

export interface Settings {
  theme?: "light" | "dark" | "system";
  // Whether drift is personalized by the interest model (M9). Undefined = on;
  // the user can switch it off from the /interests page.
  personalize?: boolean;
}

export async function getSettings(): Promise<Settings> {
  return (await db().getItem<Settings>(KEY.settings)) ?? {};
}

export async function setSettings(patch: Settings): Promise<void> {
  const current = await getSettings();
  await db().setItem(KEY.settings, { ...current, ...patch });
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
  return interestChain;
}

export async function getReactions(): Promise<Record<string, Reaction>> {
  return (await db().getItem<Record<string, Reaction>>(KEY.reactions)) ?? {};
}

let reactionChain: Promise<void> = Promise.resolve();

/** Set (or clear, with null) a page's ♥/✕ reaction. Serialized to avoid races. */
export function setReaction(
  title: string,
  reaction: Reaction | null,
): Promise<void> {
  reactionChain = reactionChain
    .then(async () => {
      const all = await getReactions();
      if (reaction === null) delete all[title];
      else all[title] = reaction;
      await db().setItem(KEY.reactions, all);
    })
    .catch(() => {});
  return reactionChain;
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
  return (await db().getItem<string[]>(KEY.seen)) ?? [];
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
  return seenChain;
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
  return sessionChain;
}
