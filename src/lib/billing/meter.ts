// ---------------------------------------------------------------------------
// The daily meter, client side (Phase 32).
//
// The pure arithmetic lives in lib/limits.ts. This file is the I/O half: it asks
// the database where the reader stands, records each stop, and keeps a small
// mirror in localStorage so a network blip does not lose the day.
//
// THE ONE RULE: IT FAILS OPEN. An unreachable backend must never stop somebody
// reading (CLAUDE.md §4). Every failure path here ends in "carry on", never in
// "you are done for today". `meterState()` returning null means "we could not
// look", and the feed treats that exactly like an unmetered reader.
//
// WHY THERE IS A MIRROR AT ALL. Without one, a dropped request at the wrong
// moment would revert a reader to "unknown" and hand them an unlimited evening;
// with one, the count we already knew about today survives, and the optimistic
// increments survive with it. The mirror is scoped to BOTH the user id and the
// Amsterdam day, so a shared device cannot carry one account's count into
// another's, and yesterday's count cannot leak into today.
//
// Writes go through record_stop(), which adds exactly one and takes no
// arguments. See supabase/migrations/0005_phase32_supporter.sql for why the
// tables have no write policy at all.
// ---------------------------------------------------------------------------

import { getSupabase } from "../supabase/client";
import { amsterdamDay, dailyLimit, type MeterState } from "../limits";

const MIRROR_KEY = "drift-meter";

interface Mirror extends MeterState {
  /** Whose count this is. A different signed-in user invalidates it. */
  uid: string;
  /** The Amsterdam day it belongs to. A different day invalidates it. */
  day: string;
}

let current: Mirror | null = null;

// Same shape as storage.ts's store events: a Set of listeners, subscribe returns
// its own unsubscribe. The feed re-renders its remaining-stops line from this.
const listeners = new Set<(s: MeterState | null) => void>();

/** Subscribe to meter changes. Returns the unsubscribe. */
export function subscribeMeter(fn: (s: MeterState | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(): void {
  const s = meterState();
  for (const fn of listeners) {
    try {
      fn(s);
    } catch {
      /* a listener throwing must never break the meter */
    }
  }
}

/** What we currently believe, or null for "we could not look". */
export function meterState(): MeterState | null {
  if (!current) return null;
  if (current.day !== amsterdamDay()) return null; // a session that crossed midnight
  return { stops: current.stops, supporter: current.supporter };
}

function readMirror(): Mirror | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as Partial<Mirror>;
    if (
      typeof m?.uid !== "string" ||
      typeof m?.day !== "string" ||
      typeof m?.stops !== "number" ||
      typeof m?.supporter !== "boolean"
    ) {
      return null;
    }
    return m as Mirror;
  } catch {
    return null;
  }
}

function writeMirror(m: Mirror | null): void {
  if (typeof window === "undefined") return;
  try {
    if (m) window.localStorage.setItem(MIRROR_KEY, JSON.stringify(m));
    else window.localStorage.removeItem(MIRROR_KEY);
  } catch {
    /* private mode / quota — the meter still works in memory for this session */
  }
}

/** Whose session this is, or null when signed out or unconfigured. */
async function currentUid(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Adopt this device's mirror for `uid`, synchronously, without touching the
 * network. Returns what it found, or null.
 *
 * WHY THIS HAS TO BE SYNCHRONOUS. The feed decides whether to fetch a seed card
 * the moment it mounts. If that decision waited for `refreshStatus`, a reader
 * whose day is already spent would be handed one more card before the closing
 * screen appeared — and since it happens on every fresh session, restarting
 * would farm a card at a time. Reading the mirror costs nothing and closes that,
 * and `refreshStatus` corrects it a moment later either way.
 *
 * Safe to call on the drift page specifically because AuthGate does not render
 * it until the session has resolved, so `user.id` is known on first render.
 */
export function primeMeter(uid: string): MeterState | null {
  const cached = readMirror();
  if (!cached || cached.uid !== uid || cached.day !== amsterdamDay()) return null;
  current = cached;
  emit();
  return meterState();
}

/**
 * Ask the database where this reader stands today. Call once when the feed
 * mounts.
 *
 * On any failure it falls back to the mirror if the mirror is still about today
 * and this user, and to null otherwise. Null is the fail-open state.
 */
export async function refreshStatus(): Promise<MeterState | null> {
  const sb = getSupabase();
  const uid = await currentUid();
  const today = amsterdamDay();

  // Signed out or no backend: there is no account to meter. Local-only Drift is
  // the app it always was.
  if (!sb || !uid) {
    current = null;
    writeMirror(null);
    emit();
    return null;
  }

  const cached = readMirror();
  if (cached && cached.uid === uid && cached.day === today) current = cached;

  try {
    const { data, error } = await sb.rpc("supporter_status");
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw error ?? new Error("no status row");
    current = {
      uid,
      day: typeof row.day === "string" ? row.day : today,
      stops: Number(row.stops) || 0,
      supporter: Boolean(row.supporter),
    };
    writeMirror(current);
  } catch {
    // Keep whatever the mirror gave us; if it gave us nothing, stay unknown.
    if (!current || current.uid !== uid || current.day !== today) current = null;
  }
  emit();
  return meterState();
}

/**
 * Record one stop. Fire and forget: the caller is `pushStep`, in the middle of a
 * card transition, and must never wait on the network to show a card.
 *
 * Optimistic first (so the remaining-stops line is immediate), then reconciled
 * with the server's own count, which is authoritative — it is the one that saw
 * every device.
 *
 * DELIBERATELY NOT RECORDED: a supporter's stops once a limit is actually
 * configured. At that point the number serves no purpose, and a per-day record of
 * how much somebody read is behavioural data we should not be collecting for
 * nothing (GDPR Article 5(1)(c)). During the measure-first period, when no limit
 * is set, everyone is counted — that is the entire point of the exercise.
 */
export function recordStop(): void {
  const sb = getSupabase();
  if (!sb) return;
  if (current?.supporter && dailyLimit() !== null) return;

  const today = amsterdamDay();
  if (current && current.day === today) {
    current = { ...current, stops: current.stops + 1 };
    writeMirror(current);
    emit();
  }

  void (async () => {
    try {
      const { data, error } = await sb.rpc("record_stop");
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) return; // fail open: the optimistic count stands
      // ⚠️ Nothing is invented when the state is unknown. record_stop returns a
      // COUNT but not an entitlement, so building a state here would have to
      // guess `supporter`, and guessing false is the one guess that can lock a
      // paying reader out of their own feed: status fetch failed at mount, this
      // write succeeded, count already past the limit, day closed. Rare, and the
      // worst thing the meter could do. So ask properly instead.
      if (!current) {
        void refreshStatus();
        return;
      }
      current = {
        uid: current.uid,
        day: typeof row.day === "string" ? row.day : today,
        stops: Number(row.stops) || 0,
        supporter: current.supporter,
      };
      writeMirror(current);
      emit();
    } catch {
      /* fail open */
    }
  })();
}

/** Forget everything. Called on sign-out so the next account starts clean. */
export function resetMeter(): void {
  current = null;
  writeMirror(null);
  emit();
}
