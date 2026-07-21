"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Monogram } from "@/components/BrandLogo";
import { Landing } from "@/components/landing/Landing";

// Public, content-only routes that render even when signed out (e.g. so someone
// can read what Drift stores before creating an account). These expose no user
// data, so letting them through the gate is safe.
// `/contact` is here deliberately: someone who cannot sign in is exactly the
// person who most needs to reach us, so it must not sit behind the gate.
const PUBLIC_ROUTES = ["/privacy", "/install", "/contact"];

// Phase 13: when the cloud IS configured (i.e. the hosted app), Drift requires an
// account — a logged-out visitor sees a calm sign-in / create-account screen
// instead of drifting anonymously, and each account only ever sees its own
// trails. When the cloud is NOT configured (a fresh local clone / CI), there is
// no gate at all and the app is byte-for-byte the old fully-local app — the
// graceful-degradation contract (CLAUDE.md §4) is preserved.
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, cloudConfigured } = useAuth();
  const pathname = usePathname();

  // No backend ⇒ never gate. Local-only Drift, unchanged.
  if (!cloudConfigured) return <>{children}</>;

  // Public informational routes render regardless of auth state.
  if (pathname && PUBLIC_ROUTES.includes(pathname)) return <>{children}</>;

  // Resolving the session — a quiet placeholder, no flash of the gate or the app.
  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-paper">
        <Monogram className="h-14 animate-pulse" alt="Loading Drift" />
      </main>
    );
  }

  // Signed in ⇒ the app.
  if (user) return <>{children}</>;

  // Configured but signed out ⇒ the landing page (which embeds the sign-in /
  // create-account form in its "join" section). The app itself never renders
  // until `user` is set, so it stays fully login-gated.
  return <Landing />;
}
