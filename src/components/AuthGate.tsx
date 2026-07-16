"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { AuthForm } from "@/components/AuthForm";

// Phase 13: when the cloud IS configured (i.e. the hosted app), Drift requires an
// account — a logged-out visitor sees a calm sign-in / create-account screen
// instead of drifting anonymously, and each account only ever sees its own
// trails. When the cloud is NOT configured (a fresh local clone / CI), there is
// no gate at all and the app is byte-for-byte the old fully-local app — the
// graceful-degradation contract (CLAUDE.md §4) is preserved.
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, cloudConfigured } = useAuth();

  // No backend ⇒ never gate. Local-only Drift, unchanged.
  if (!cloudConfigured) return <>{children}</>;

  // Resolving the session — a quiet placeholder, no flash of the gate or the app.
  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper">
        <p className="animate-pulse font-serif text-2xl text-ink-soft">Drift</p>
      </main>
    );
  }

  // Signed in ⇒ the app.
  if (user) return <>{children}</>;

  // Configured but signed out ⇒ the welcome gate.
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="font-serif text-6xl text-ink">Drift</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Pull a thread. See where it goes.
        </p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/75">
          Sign in to start drifting. Your trails, interests, and reactions stay
          private to your account and follow you across devices.
        </p>
      </header>
      <AuthForm />
    </main>
  );
}
