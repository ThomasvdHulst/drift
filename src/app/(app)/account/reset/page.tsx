"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";

// Password-recovery landing (the reset link's redirectTo). When the link is
// clicked, detectSessionInUrl (client.ts) establishes a short-lived recovery
// session and AuthProvider sets `user`; we then let them set a new password via
// updatePassword. Sits under the AuthGate, so the gate handles the loading /
// signed-out cases when the cloud is configured; this page covers the rest.

export default function ResetPasswordPage() {
  const { user, loading, cloudConfigured, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Use at least 6 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) return setError(res.error);
    setDone(true);
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-6 py-12 sm:py-16">
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm text-ink-soft transition hover:text-accent-strong"
        >
          ← Home
        </Link>
        <h1 className="mt-4 font-serif text-4xl text-ink">
          Choose a new password
        </h1>
      </header>

      {!cloudConfigured ? (
        <Panel>
          <p className="text-sm leading-relaxed text-ink">
            Cloud sync isn&apos;t set up on this device, so there&apos;s no
            account to reset. Drift is running fully locally.
          </p>
        </Panel>
      ) : loading ? (
        <p className="text-sm text-ink-soft">Checking your reset link…</p>
      ) : done ? (
        <Panel>
          <p className="text-sm leading-relaxed text-ink">
            Your password has been updated. You&apos;re signed in.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
          >
            Start drifting →
          </Link>
        </Panel>
      ) : !user ? (
        <Panel>
          <p className="text-sm leading-relaxed text-ink">
            This reset link is invalid or has expired.
          </p>
          <Link
            href="/account"
            className="mt-3 inline-block text-sm font-medium text-accent-strong underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
          >
            Request a new link
          </Link>
        </Panel>
      ) : (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-line bg-paper-raised p-6"
        >
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-soft">
            New password
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Confirm new password
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </label>
          {error && (
            <p className="mt-4 text-sm text-ink" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong disabled:opacity-60"
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </main>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      {children}
    </div>
  );
}
