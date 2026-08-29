"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { PasswordField } from "@/components/PasswordField";
import { ALREADY_REGISTERED, passwordHint, passwordProblem } from "@/lib/auth";
import {
  MINIMUM_AGE,
  AGE_SETTING_KEY,
  mayCreateAccount,
  ageDeclarationError,
} from "@/lib/consent";
import { setSettings } from "@/lib/storage";
import { OAuthButtons } from "@/components/OAuthButtons";
import { parseOAuthProviders } from "@/lib/auth";

// The shared auth form (Phase 9/13, extended for the auth overhaul). Used both by
// the AuthGate that fronts the app and the /account page. Handles email+password
// sign in / create account, Google/Apple OAuth (when enabled), a "forgot
// password" request, and a clear "check your email" state for confirmation +
// reset. Self-contained: it reads everything it needs from useAuth.

export type AuthMode = "signin" | "signup" | "reset";
type Sent = { kind: "confirm" | "reset"; email: string };
/** A refusal, tagged with the mode it was produced in. */
type Notice = { mode: AuthMode; text: string; unconfirmed: boolean };

export function AuthForm({
  initialMode = "signin",
  mode: controlledMode,
  onModeChange,
}: {
  initialMode?: AuthMode;
  /**
   * Optional CONTROLLED mode. The landing page passes this so a "Sign in" link
   * elsewhere on the page (the sticky header, the hero) can open the form on the
   * right tab. Someone who clicked "Sign in", typed their credentials into a
   * form still sitting on "Create account" and got told the account already
   * exists had done nothing wrong; the form was.
   * Pass `onModeChange` alongside it, so the tabs here keep the parent in step.
   */
  mode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
} = {}) {
  const {
    signIn,
    signUp,
    requestPasswordReset,
    resendConfirmation,
    cloudConfigured,
  } = useAuth();

  const [internalMode, setInternalMode] = useState<AuthMode>(initialMode);
  const mode = controlledMode ?? internalMode;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Never pre-ticked: a pre-ticked box is a default, not a declaration.
  const [age16Plus, setAge16Plus] = useState(false);
  // A refusal is remembered WITH the mode that produced it, and only shown while
  // that mode is on screen. Deriving it that way (rather than clearing it in the
  // tab handler) also covers a mode change that comes from outside this form,
  // e.g. the landing page's "Sign in" link.
  const [notice, setNotice] = useState<Notice | null>(null);
  const error = notice?.mode === mode ? notice.text : null;
  // Sign-in was refused only for lack of verification (see AuthResult).
  const unconfirmed = !!error && !!notice?.unconfirmed;
  // When set, we show a dedicated panel instead of the form: "confirm" after a
  // sign-up that needs verification, "reset" after a reset email is sent.
  const [sent, setSent] = useState<Sent | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const emailId = useId();
  const errorId = useId();

  const showOAuth =
    cloudConfigured &&
    parseOAuthProviders(process.env.NEXT_PUBLIC_OAUTH_PROVIDERS).length > 0;

  function switchMode(m: AuthMode) {
    setInternalMode(m);
    onModeChange?.(m);
    setNotice(null);
    setResendMsg(null);
  }

  /** Record a refusal against the mode that is on screen right now. */
  function refuse(text: string, opts?: { unconfirmed?: boolean }) {
    setNotice({ mode, text, unconfirmed: !!opts?.unconfirmed });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setResendMsg(null);
    setBusy(true);
    const addr = email.trim();

    if (mode === "reset") {
      const res = await requestPasswordReset(addr);
      setBusy(false);
      if (res.error) return refuse(res.error);
      setSent({ kind: "reset", email: addr });
      return;
    }

    if (mode === "signup") {
      // The age declaration first: refusing on age should not depend on the
      // password being good, and someone under 16 should not be asked to fix a
      // password for an account they may not have (compliance audit M-8).
      if (!mayCreateAccount(age16Plus)) {
        setBusy(false);
        return refuse(ageDeclarationError());
      }
      const problem = passwordProblem(password);
      if (problem) {
        setBusy(false);
        return refuse(problem);
      }
    }

    const res =
      mode === "signup" ? await signUp(addr, password) : await signIn(addr, password);
    setBusy(false);
    if (res.error) return refuse(res.error, { unconfirmed: res.unconfirmed });
    // Record the declaration once the account exists. Best-effort: it syncs with
    // the rest of settings and appears in the data export, and a storage failure
    // must never turn a successful sign-up into an error the user cannot act on.
    if (mode === "signup") {
      void setSettings({ [AGE_SETTING_KEY]: true }).catch(() => {});
    }
    if (res.needsConfirm) {
      setSent({ kind: "confirm", email: addr });
      return;
    }
    setPassword("");
    // On a successful sign-in, auth state flips and the gate/route reveals the app.
  }

  // Resend from the sign-in error (as opposed to the "check your email" panel,
  // which has its own resend). Reports into the same little line it replaces.
  async function resendFromSignIn() {
    const addr = email.trim();
    if (!addr) return;
    setResendMsg("Sending…");
    const res = await resendConfirmation(addr);
    setResendMsg(res.error ?? "Sent. Check your inbox.");
  }

  async function resend() {
    if (!sent) return;
    setResendMsg(null);
    const res = await resendConfirmation(sent.email);
    setResendMsg(res.error ?? "Sent. Check your inbox again.");
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
            className="focus-ring mt-4 rounded text-sm font-medium text-accent-strong underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
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
          className="focus-ring mt-5 block w-full rounded text-sm text-ink-soft transition hover:text-ink"
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
        <div
          role="group"
          aria-label="Sign in or create an account"
          className="mb-5 flex gap-1 rounded-full border border-line p-1 text-sm"
        >
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

      <label
        htmlFor={emailId}
        className="block text-xs font-medium uppercase tracking-wide text-ink-soft"
      >
        Email
      </label>
      {/* `autocomplete="username"` (not "email") is what Apple Keychain, 1Password
          and Chrome's password manager look for as the account identifier next to
          a password field; "email" gets treated as a contact detail instead. The
          iOS trio (no autocapitalise/autocorrect/spellcheck) stops a phone
          keyboard from quietly editing an address as it is typed. */}
      <input
        id={emailId}
        name="email"
        type="email"
        required
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint={mode === "reset" ? "send" : "go"}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus-ring"
      />

      {mode !== "reset" && (
        <div className="mt-4">
          <PasswordField
            label="Password"
            name="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            // Only while CHOOSING one: repeating the rules at sign-in would
            // imply the existing password is wrong.
            hint={mode === "signup" ? passwordHint() : undefined}
            invalid={!!error}
            describedBy={error ? errorId : undefined}
          />
        </div>
      )}

      {mode === "signin" && (
        <button
          type="button"
          onClick={() => switchMode("reset")}
          className="focus-ring mt-2 rounded text-xs text-ink-soft underline decoration-line underline-offset-4 transition hover:text-accent-strong"
        >
          Forgot your password?
        </button>
      )}

      {error && (
        <div className="mt-4">
          {/* The id sits on the message itself, not the wrapper: the buttons
              below it are actions, not part of the field's description. */}
          <p id={errorId} className="text-sm text-ink" role="alert">
            {error}
          </p>
          {/* Sign-in refused purely because the address is unverified: the link
              is probably expired or lost, so offer a fresh one right here rather
              than leaving the reader to hunt for it. */}
          {unconfirmed && (
            <button
              type="button"
              onClick={resendFromSignIn}
              className="focus-ring mt-1.5 rounded text-xs font-medium text-accent-strong underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent"
            >
              {resendMsg ?? "Send me a new confirmation link"}
            </button>
          )}
          {/* "That address already has an account" is a dead end unless the way
              out is right here: switching keeps the email AND the password that
              were just typed, so the answer is one click and one button, not a
              retype. */}
          {error === ALREADY_REGISTERED && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="focus-ring mt-1.5 rounded text-xs font-medium text-accent-strong underline decoration-accent/40 underline-offset-4 transition hover:decoration-accent"
            >
              Sign in with this email instead
            </button>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="focus-ring mt-6 w-full rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong disabled:opacity-60"
      >
        {busy
          ? "One moment…"
          : mode === "signup"
            ? "Create account"
            : mode === "reset"
              ? "Send reset link"
              : "Sign in"}
      </button>

      {/* The age declaration (compliance audit M-8). The Dutch digital age of
          consent is 16: the Netherlands did not exercise the Article 8(1) option
          to lower it and Article 5 UAVG keeps it there. Separately, Article
          1:234 BW makes a contract concluded by a minor voidable, and the terms
          are a contract.

          Self-declaration, not verification, which is what regulators expect
          from a service that is not directed at children, and it is not
          pretending otherwise. NEVER pre-ticked: a pre-ticked box is not a
          declaration, it is a default nobody read.

          Only the boolean is asked for. A date of birth would be a new category
          of personal data to hold, protect, export and delete in exchange for an
          answer we do not need (Article 5(1)(c) data minimisation). */}
      {mode === "signup" && (
        <>
          <label className="mt-4 flex items-start gap-3 text-xs leading-relaxed text-ink-soft">
            <input
              type="checkbox"
              required
              checked={age16Plus}
              onChange={(e) => setAge16Plus(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)] focus-ring"
            />
            <span>I am {MINIMUM_AGE} or older.</span>
          </label>
          {/* The terms are what make the account relationship a CONTRACT, which
              is the Article 6(1)(b) GDPR basis /privacy relies on for nearly all
              of Drift's processing. A contract nobody was shown is a weak one,
              so the reference sits at the moment of signing up. */}
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            By creating an account you agree to{" "}
            <Link
              href="/terms"
              className="text-accent-strong underline-offset-2 hover:underline"
            >
              the terms
            </Link>
            . See{" "}
            <Link
              href="/privacy"
              className="text-accent-strong underline-offset-2 hover:underline"
            >
              what Drift stores
            </Link>
            .
          </p>
        </>
      )}

      {mode === "reset" && (
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className="focus-ring mt-3 block w-full rounded text-sm text-ink-soft transition hover:text-ink"
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
      // Two buttons that look different but sound identical to a screen reader:
      // pressed state is what tells you which one you are on.
      aria-pressed={active}
      className={`focus-ring flex-1 rounded-full px-3 py-1.5 transition ${
        active ? "bg-accent text-paper-raised" : "text-ink-soft hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
