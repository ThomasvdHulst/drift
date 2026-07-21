"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { socialBadge } from "@/lib/social/client";

// A quiet account affordance (fixed bottom-right, left of the theme toggle).
// Deliberately understated — when signed in with something waiting it shows a
// single, small SAGE dot (gentle awareness, §4) — never a red badge, a number,
// or a notification lure (§2). Renders NOTHING when the backend isn't configured,
// so a backend-less clone looks byte-for-byte like the old local app. It's a
// doorway to /account (handle + sign-out); the sign-in gate itself is AuthGate.
export function AccountButton() {
  const { user, loading, cloudConfigured } = useAuth();
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // socialBadge() returns zero when signed out, so this also clears the dot on
    // sign-out. setState happens only after the await — never synchronously in
    // the effect body (React 19's set-state-in-effect rule).
    const check = async () => {
      const b = await socialBadge();
      if (!cancelled) setHasNew(b.unreadShares + b.incomingRequests > 0);
    };
    check();
    // Re-check when the tab regains focus (no polling — stays calm).
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [user]);

  if (!cloudConfigured || loading) return null;

  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <Link
      href="/account"
      aria-label={
        user
          ? hasNew
            ? "Your account, something new is waiting"
            : "Your account"
          : "Sign in"
      }
      title={user ? (user.email ?? "Your account") : "Sign in"}
      className="fixed bottom-safe right-16 z-30 flex h-9 items-center justify-center rounded-full border border-line bg-paper-raised/90 text-ink-soft shadow-sm backdrop-blur transition hover:text-accent-strong"
    >
      {user ? (
        <span className="relative flex h-9 w-9 items-center justify-center text-sm font-semibold">
          {initial}
          {hasNew && (
            <span
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent ring-2 ring-paper-raised"
              aria-hidden="true"
            />
          )}
        </span>
      ) : (
        <span className="px-4 text-sm font-medium">Sign in</span>
      )}
    </Link>
  );
}
