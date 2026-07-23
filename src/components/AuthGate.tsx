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
// person who most needs to reach us, so it must not sit behind the gate. `/about`
// is here for the same reason: who Drift is and why it exists should be readable
// without an account.
const PUBLIC_ROUTES = ["/about", "/privacy", "/install", "/contact"];

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

  // Resolving the session. On `/` this renders the LANDING PAGE rather than a
  // placeholder, because that is what a signed-out visitor is about to get
  // anyway — and `/` is the one route search engines index. Rendering a spinner
  // here meant the server HTML for the homepage was an empty shell, so Googlebot
  // had to wait for its render queue to see any content, and a first-time
  // visitor watched a spinner before the pitch.
  //
  // Someone who is already signed in would glimpse the landing on every cold
  // start, so `sessionScript` in app/layout.tsx flags a stored session before
  // first paint and globals.css shows the placeholder instead. That has to be
  // CSS: the server cannot know (the session lives in localStorage), and React
  // must hydrate the same tree it server-rendered, so a branch here would flash
  // regardless. Everyone still receives identical HTML.
  //
  // Every other route keeps the plain placeholder: they are all `Disallow`ed in
  // robots.txt, so there is no indexing to gain, and this way their payload and
  // behaviour are untouched.
  if (loading) {
    if (pathname === "/") {
      return (
        <>
          <div data-landing-preview>
            <Landing />
          </div>
          {/* Hidden unless the pre-paint script found a stored session. */}
          <Waiting hidden />
        </>
      );
    }
    return <Waiting />;
  }

  // Signed in ⇒ the app.
  if (user) return <>{children}</>;

  // Configured but signed out ⇒ the landing page (which embeds the sign-in /
  // create-account form in its "join" section). The app itself never renders
  // until `user` is set, so it stays fully login-gated.
  return <Landing />;
}

// The quiet "resolving your session" placeholder. `hidden` marks the variant that
// sits behind the server-rendered landing on `/`: globals.css keeps it out of the
// layout unless <html data-session="1"> says this visitor has a stored session.
function Waiting({ hidden = false }: { hidden?: boolean }) {
  return (
    <main
      {...(hidden ? { "data-auth-pending": "" } : {})}
      className={`${hidden ? "" : "flex "}min-h-dvh items-center justify-center bg-paper`}
    >
      <Monogram className="h-14 animate-pulse" alt="Loading Drift" />
    </main>
  );
}
