"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isCloudConfigured } from "@/lib/supabase/client";
import { setSyncRecording, clearAllLocalData } from "@/lib/storage";
import { startSync, stopSync, flushSync } from "@/lib/sync/replicator";

// ---------------------------------------------------------------------------
// Auth context (Phase 9, extended Phase 13). Exposes the current user/session
// plus email+password sign up / in / out. When Supabase ISN'T configured this
// provider still renders its children with user=null and no-op methods, so a
// backend-less clone is byte-for-byte the old fully-local app (CLAUDE.md §4).
// When it IS configured the app is gated behind an account (see AuthGate), and
// sign-out wipes this device's local data so nothing bleeds between accounts.
// ---------------------------------------------------------------------------

export type AuthResult = { error: string | null; needsConfirm?: boolean };

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  cloudConfigured: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const NOT_CONFIGURED: AuthResult = {
  error: "Cloud sync isn't set up on this device — Drift is running locally.",
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cloudConfigured = isCloudConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // If there's no backend we're never "loading" — resolve immediately to null.
  const [loading, setLoading] = useState<boolean>(cloudConfigured);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      // Unconfigured ⇒ `loading` already initialized to false. This branch only
      // runs when configured-but-client-construction-failed (rare); clear off
      // the synchronous effect path (React 19 forbids sync setState in effects).
      if (cloudConfigured) queueMicrotask(() => setLoading(false));
      return;
    }
    let active = true;
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // cloudConfigured is derived from module-level env — constant across the
    // app's life, so this effect still runs exactly once.
  }, [cloudConfigured]);

  // Journal local changes only when a backend exists (so an unconfigured app
  // writes nothing extra and stays byte-for-byte the old local-only app). The
  // journal accumulates while signed out and drains on the next sign-in.
  useEffect(() => {
    setSyncRecording(cloudConfigured);
  }, [cloudConfigured]);

  // Start/stop the background replicator with the session. Sign-out keeps all
  // local data (and the journal), so the app carries on locally.
  useEffect(() => {
    if (!cloudConfigured) return;
    if (user) void startSync(user.id);
    else stopSync();
  }, [user, cloudConfigured]);

  const value = useMemo<AuthContextValue>(() => {
    async function signUp(email: string, password: string): Promise<AuthResult> {
      const sb = getSupabase();
      if (!sb) return NOT_CONFIGURED;
      try {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) return { error: error.message };
        // With "Confirm email" enabled, no session comes back until the link is
        // clicked. We ask the user to disable it for personal use; surface a
        // clear hint otherwise.
        if (!data.session) return { error: null, needsConfirm: true };
        return { error: null };
      } catch {
        return { error: "Couldn't reach the cloud. You're still drifting locally." };
      }
    }

    async function signIn(email: string, password: string): Promise<AuthResult> {
      const sb = getSupabase();
      if (!sb) return NOT_CONFIGURED;
      try {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        return { error: null };
      } catch {
        return { error: "Couldn't reach the cloud. You're still drifting locally." };
      }
    }

    async function signOut(): Promise<void> {
      const sb = getSupabase();
      if (!sb) return;
      // Best-effort flush of pending local changes first, so an un-synced trail
      // isn't lost by the wipe below (flushSync is fully guarded).
      await flushSync();
      try {
        await sb.auth.signOut();
      } catch {
        // Ignore — local session state is cleared by onAuthStateChange anyway.
      }
      // Stop the replicator and WIPE local data so no account's world lingers
      // for the next person on this device (Phase 13). The [user] effect also
      // calls stopSync() on user→null; calling it here too is idempotent.
      stopSync();
      await clearAllLocalData();
    }

    return {
      user,
      session,
      loading,
      cloudConfigured,
      signUp,
      signIn,
      signOut,
    };
  }, [user, session, loading, cloudConfigured]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access auth state + actions. Safe everywhere the provider wraps the tree. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Defensive default so a stray call outside the provider can't crash the app.
    return {
      user: null,
      session: null,
      loading: false,
      cloudConfigured: false,
      signUp: async () => NOT_CONFIGURED,
      signIn: async () => NOT_CONFIGURED,
      signOut: async () => {},
    };
  }
  return ctx;
}
