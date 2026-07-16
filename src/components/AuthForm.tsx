"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";

// The shared email + password sign in / create account form (Phase 9/13). Used
// both on the /account page (signed-out branch) and by the AuthGate that fronts
// the whole app when the cloud is configured. Self-contained: it reads signIn /
// signUp from useAuth and manages its own state, so callers just drop it in.

type Mode = "signin" | "signup";

export function AuthForm() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const fn = mode === "signup" ? signUp : signIn;
    const res = await fn(email.trim(), password);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.needsConfirm) {
      setNotice(
        "Almost there — check your email for a confirmation link, then sign in.",
      );
      setMode("signin");
      return;
    }
    setPassword("");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-line bg-paper-raised p-6"
    >
      <div className="mb-5 flex gap-1 rounded-full border border-line p-1 text-sm">
        <ModeTab
          active={mode === "signin"}
          onClick={() => setMode("signin")}
          label="Sign in"
        />
        <ModeTab
          active={mode === "signup"}
          onClick={() => setMode("signup")}
          label="Create account"
        />
      </div>

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

      {error && (
        <p className="mt-4 text-sm text-ink" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-4 text-sm text-accent-strong" role="status">
          {notice}
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
            : "Sign in"}
      </button>
    </form>
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
