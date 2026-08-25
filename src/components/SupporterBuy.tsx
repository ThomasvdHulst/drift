"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { formatEur, PRICE_CENTS } from "@/lib/billing/price";
import { refreshStatus, subscribeMeter } from "@/lib/billing/meter";
import type { MeterState } from "@/lib/limits";

// ---------------------------------------------------------------------------
// The one control that takes money (Phase 32).
//
// Everything about the transaction happens on Stripe's own pages: this button
// asks our server for a Checkout URL and follows it. No card field ever exists
// in Drift, which is the single biggest reason the payment surface here is
// small enough to reason about.
//
// The states it has to tell the truth about, because a button that lies is the
// thing §2 actually forbids:
//   • signed out      → say so and offer the way in, do not pretend to sell
//   • already holding → say thank you, do not offer to sell it twice
//   • unconfigured    → say buying is not available, do not throw
//   • in flight       → say so, and stay disabled so a double click cannot
//                       create two sessions
// ---------------------------------------------------------------------------

export function SupporterBuy({ compact = false }: { compact?: boolean }) {
  const { user, cloudConfigured } = useAuth();
  const [meter, setMeter] = useState<MeterState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeMeter(setMeter);
    if (user) void refreshStatus();
    return unsubscribe;
  }, [user]);

  async function buy() {
    setError(null);
    setBusy(true);
    try {
      const sb = getSupabase();
      const { data } = (await sb?.auth.getSession()) ?? { data: null };
      const token = data?.session?.access_token;
      if (!token) {
        setError("You are not signed in.");
        return;
      }
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
        unconfigured?: boolean;
        already?: boolean;
      };
      if (body.unconfigured) {
        setError("Buying is not set up on this deployment yet.");
        return;
      }
      if (body.already) {
        // Someone else's tab, or a purchase that landed while this page sat
        // open. Not an error worth alarming anyone about: just catch up.
        await refreshStatus();
        return;
      }
      if (!body.ok || !body.url) {
        setError(body.error ?? "Could not start checkout. Please try again.");
        return;
      }
      // Stripe's hosted page. A full navigation, not a popup: popups are
      // blocked often enough that it would fail silently for some readers.
      window.location.assign(body.url);
    } catch {
      setError("Could not reach the checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!cloudConfigured) {
    return (
      <p className="text-sm text-ink-soft">
        This copy of Drift runs without an account system, so there is nothing to
        buy and no limit to lift.
      </p>
    );
  }

  if (!user) {
    return (
      <div>
        <Link
          href="/"
          className="focus-ring inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
        >
          Sign in to support Drift
        </Link>
        <p className="mt-3 text-sm text-ink-soft">
          The unlock attaches to your account, so it follows you to every device
          you read on.
        </p>
      </div>
    );
  }

  if (meter?.supporter) {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
        <p className="text-sm font-medium text-accent-strong">
          You already hold the supporter unlock.
        </p>
        <p className="mt-1 text-sm text-ink/75">
          Thank you. There is no daily limit on your account, and anything added
          to the unlock later is included.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={buy}
        disabled={busy}
        className="focus-ring inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong disabled:opacity-60"
      >
        {/* The label states the obligation and the amount, which is what art.
            6:230v BW asks of the button that concludes the contract. "Continue"
            would not do. */}
        {busy ? "Taking you to Stripe…" : `Support Drift · ${formatEur(PRICE_CENTS)}`}
      </button>
      {!compact && (
        <p className="mt-3 text-sm text-ink-soft">
          One payment, including 21% BTW. You pay on Stripe; Drift never sees
          your card details.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-ink">
          {error}
        </p>
      )}
    </div>
  );
}
