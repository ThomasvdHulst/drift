"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { OAuthButtons } from "@/components/OAuthButtons";
import { parseOAuthProviders } from "@/lib/auth";

// The shared auth form (Phase 9/13, extended for the auth overhaul). Used both by
// the AuthGate that fronts the app and the /account page. Handles email+password
// sign in / create account, Google/Apple OAuth (when enabled), a "forgot
// password" request, and a clear "check your email" state for confirmation +
// reset. Self-contained: it reads everything it needs from useAuth.

type Mode = "signin" | "signup" | "reset";
type Sent = { kind: "confirm" | "reset"; email: string };

export function AuthForm({ initialMode = "signin" }: { initialMode?: Mode } = {}) {
  const {
    signIn,
    signUp,
    requestPasswordReset,
    resendConfirmation,
    cloudConfigured,
  } = useAuth();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When set, we show a dedicated panel instead of the form: "confirm" after a
  // sign-up that needs verification, "reset" after a reset email is sent.
  const [sent, setSent] = useState<Sent | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const showOAuth =
    cloudConfigured &&
    parseOAuthProviders(process.env.NEXT_PUBLIC_OAUTH_PROVIDERS).length > 0;

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const addr = email.trim();

    if (mode === "reset") {
      const res = await requestPasswordReset(addr);
      setBusy(false);
      if (res.error) return setError(res.error);
      setSent({ kind: "reset", email: addr });
      return;
    }

    const res =
      mode === "signup" ? await signUp(addr, password) : await signIn(addr, password);
    setBusy(false);
    if (res.error) return setError(res.error);
    if (res.needsConfirm) {
      setSent({ kind: "confirm", email: addr });
      return;
    }
    setPassword("");
    // On a successful sign-in, auth state flips and the gate/route reveals the app.
  }

  async function resend() {
    if (!sent) return;
    setResendMsg(null);
    const res = await resendConfirmation(sent.email);
    setResendMsg(res.error ?? "Sent — check your inbox again.");
  }

  // ----- "check your email" panel (confirmation or reset) -----
  if (sent) {
    const isConfirm = sent.kind === "confirm";
    return (
      <div className="rounded-2xl border border-line bg-paper-raised p-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent-strong">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl text-ink">Check your email</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {isConfirm
            ? "We sent a confirmation link to "
            : "If an account exists, we sent a password-reset link to "}
          <span className="font-medium text-ink">{sent.email}</span>.{" "}
          {isConfirm
            ? "Click it to verify your address, then sign in."
            : "Click it to choose a new password."}
        </p>
        {isConfirm && (
          <button
            type="button"
            onClick={resend}
            className="mt-4 text-sm font-medium text-accent-strong underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
          >
            Resend the link
          </button>
        )}
        {resendMsg && (
          <p className="mt-2 text-sm text-ink-soft" role="status">
            {resendMsg}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setSent(null);
            switchMode("signin");
          }}
          className="mt-5 block w-full text-sm text-ink-soft transition hover:text-ink"
        >
          ← Back to sign in
        </button>
      </div>
    );
  }

  // ----- the form -----
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-line bg-paper-raised p-6"
    >
      {mode !== "reset" && (
        <div className="mb-5 flex gap-1 rounded-full border border-line p-1 text-sm">
          <ModeTab
            active={mode === "signin"}
            onClick={() => switchMode("signin")}
            label="Sign in"
          />
          <ModeTab
            active={mode === "signup"}
            onClick={() => switchMode("signup")}
            label="Create account"
          />
        </div>
      )}

      {mode !== "reset" && showOAuth && (
        <>
          <OAuthButtons />
          <Divider />
        </>
      )}

      {mode === "reset" && (
        <h2 className="mb-4 font-serif text-2xl text-ink">Reset your password</h2>
      )}

      <label className="block text-xs font-medium uppercase tracking-wide text-ink-soft">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
      </label>

      {mode !== "reset" && (
        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink-soft">
          Password
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
      )}

      {mode === "signin" && (
        <button
          type="button"
          onClick={() => switchMode("reset")}
          className="mt-2 text-xs text-ink-soft underline decoration-line underline-offset-4 transition hover:text-accent-strong"
        >
          Forgot your password?
        </button>
      )}

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
        {busy
          ? "One moment…"
          : mode === "signup"
            ? "Create account"
            : mode === "reset"
              ? "Send reset link"
              : "Sign in"}
      </button>

      {mode === "reset" && (
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className="mt-3 block w-full text-sm text-ink-soft transition hover:text-ink"
        >
          ← Back to sign in
        </button>
      )}
    </form>
  );
}

function Divider() {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs uppercase tracking-widest text-ink-soft">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-3 py-1.5 transition ${
        active ? "bg-accent text-paper-raised" : "text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
