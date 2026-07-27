"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Monogram } from "@/components/BrandLogo";
import { parseAuthLink, destinationFor, type AuthLink } from "@/lib/auth";

// Where every email link lands: sign-up confirmations and password resets.
//
// WHY THIS PAGE EXISTS. Links used to point at the bare origin and rely on
// supabase-js exchanging a PKCE `?code=` on arrival. That exchange needs a
// `code_verifier` held in the localStorage of the browser that STARTED the
// sign-up, so the link only worked in that exact browser profile: opening it on
// a phone after signing up on a laptop, in a private tab, or in a mail app's
// in-app browser dropped you on the homepage silently signed out. This page
// redeems a `token_hash` with `verifyOtp` instead, which carries no client-side
// state and therefore works anywhere. See lib/auth.ts `parseAuthLink`.
//
// It still understands the older shapes, so links already sitting in inboxes
// keep working where they can and explain themselves where they cannot.

// How long to wait for supabase-js to finish an automatic exchange (the `?code=`
// and `#access_token=` shapes) before calling it a failure. Generous: it is one
// network round trip, and a false "this failed" is worse than a beat of waiting.
const AUTO_EXCHANGE_TIMEOUT_MS = 8000;

type Status =
  | { state: "working" }
  | { state: "ok"; to: string }
  | { state: "failed"; message: string; canRetryInBrowser: boolean };

export default function ConfirmPage() {
  const router = useRouter();
  const { user, loading, cloudConfigured, verifyEmailToken } = useAuth();

  // The URL is read in an effect, not during render: reading `window` while
  // rendering makes the server and client disagree and React throws the whole
  // tree away and rebuilds it (which also resets the refs below). `null` means
  // "not looked yet", so the first paint is the same on both sides.
  //
  // Reading it in an effect is still early enough to beat supabase-js, which
  // strips the code out of the address bar once it has handled it: the client is
  // constructed inside AuthProvider's effect, and React runs child effects
  // before parent ones, so this page always looks first.
  const [link, setLink] = useState<AuthLink | null>(null);
  const [status, setStatus] = useState<Status>({ state: "working" });
  const startedRef = useRef(false);

  useEffect(() => {
    if (link) return;
    const parsed = parseAuthLink({
      search: window.location.search,
      hash: window.location.hash,
    });
    queueMicrotask(() => {
      setLink(parsed);
      if (parsed.kind === "error") {
        setStatus({
          state: "failed",
          message: parsed.message,
          canRetryInBrowser: false,
        });
      }
    });
  }, [link]);

  // 1) A token_hash is ours to redeem, and it works in any browser.
  useEffect(() => {
    if (!link || !cloudConfigured || link.kind !== "token_hash") return;
    if (startedRef.current) return;
    startedRef.current = true;
    let alive = true;
    void (async () => {
      const res = await verifyEmailToken(link.tokenHash, link.type);
      if (!alive) return;
      if (res.error) {
        setStatus({
          state: "failed",
          message: res.error,
          canRetryInBrowser: false,
        });
        return;
      }
      setStatus({ state: "ok", to: destinationFor(link.type) });
    })();
    return () => {
      alive = false;
    };
  }, [cloudConfigured, link, verifyEmailToken]);

  // 2) The older shapes (`?code=` PKCE, `#access_token=` implicit) are handled
  //    for us by supabase-js on load; all we do is watch for the session and
  //    give up honestly if it never arrives.
  useEffect(() => {
    if (!link || !cloudConfigured) return;
    if (link.kind !== "code" && link.kind !== "tokens") return;
    if (user) return; // resolved by the effect below
    const t = window.setTimeout(() => {
      setStatus({
        state: "failed",
        message:
          link.kind === "code"
            ? "This link was opened in a different browser from the one you signed up in, so it could not sign you in automatically. Your email is confirmed though, so you can sign in with your password."
            : "We couldn't complete the sign-in from this link. Please try signing in with your password.",
        canRetryInBrowser: true,
      });
    }, AUTO_EXCHANGE_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [cloudConfigured, link, user]);

  // 3) A session arriving by any route means we are done. Deferred, per the
  //    React 19 rule the codebase follows everywhere (queueMicrotask).
  useEffect(() => {
    if (!user || !link) return;
    const type =
      link.kind === "token_hash" || link.kind === "tokens" ? link.type : undefined;
    queueMicrotask(() => setStatus({ state: "ok", to: destinationFor(type) }));
  }, [user, link]);

  // 4) Nothing usable in the URL at all, and no session to fall back on.
  useEffect(() => {
    if (!link || link.kind !== "none" || loading || user) return;
    queueMicrotask(() =>
      setStatus({
        state: "failed",
        message:
          "This page is where email links land, and this one carried nothing to confirm. If you came from an email, try opening the link again.",
        canRetryInBrowser: true,
      }),
    );
  }, [link, loading, user]);

  // Forward once we're done. `replace` so the spent link never sits in history.
  useEffect(() => {
    if (status.state !== "ok") return;
    const t = window.setTimeout(() => router.replace(status.to), 450);
    return () => window.clearTimeout(t);
  }, [status, router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      {status.state === "working" && (
        <>
          <Monogram className="h-14 animate-pulse" alt="Confirming" />
          <p className="mt-6 text-sm text-ink-soft">Confirming your link…</p>
        </>
      )}

      {status.state === "ok" && (
        <>
          <Monogram className="h-14" alt="Confirmed" />
          <h1 className="mt-6 font-serif text-3xl text-ink">You&apos;re all set</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {status.to === "/account/reset"
              ? "Taking you to choose a new password…"
              : "Taking you into Drift…"}
          </p>
        </>
      )}

      {status.state === "failed" && (
        <>
          <h1 className="font-serif text-3xl leading-tight text-ink">
            That link didn&apos;t work
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink/80">
            {status.message}
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong"
          >
            {status.canRetryInBrowser ? "Go to sign in" : "Back to Drift"}
            <span aria-hidden="true">→</span>
          </Link>
          <p className="mt-4 text-xs leading-relaxed text-ink-soft">
            Still stuck?{" "}
            <Link href="/contact" className="underline underline-offset-2 hover:text-accent-strong">
              Get in touch
            </Link>{" "}
            and we&apos;ll sort it out.
          </p>
        </>
      )}
    </main>
  );
}
