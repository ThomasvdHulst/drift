"use client";

import { useId, useState } from "react";
import { PASSWORD_RULES } from "@/lib/auth";

// A password input with a show/hide eye, used by every place that asks for one
// (sign in, sign up, and choosing a new password after a reset) so they cannot
// drift apart. Typing a password blind on a phone keyboard is where most
// "wrong password" attempts actually come from.
//
// The eye is a button inside the field, `tabIndex={-1}` so it never sits between
// the field and the submit button for keyboard users, and it announces its state
// rather than just changing shape.
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  /** Shown under the field, e.g. the rules while choosing a new password. */
  hint?: string;
  required?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const hintId = useId();

  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-ink-soft">
      {label}
      <span className="relative mt-1 block">
        <input
          type={shown ? "text" : "password"}
          required={required}
          // The server is the authority on the rule; this only stops the most
          // obvious near-miss before a round trip.
          minLength={PASSWORD_RULES.minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? hintId : undefined}
          className="w-full rounded-lg border border-line bg-paper py-2 pl-3 pr-11 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          tabIndex={-1}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          title={shown ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-ink-soft transition hover:text-accent-strong"
        >
          {shown ? (
            // Open eye: the password is visible.
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
              <circle cx="12" cy="12" r="2.8" />
            </svg>
          ) : (
            // Struck-through eye: the password is hidden.
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
              <circle cx="12" cy="12" r="2.8" />
              <path d="M3.5 3.5 20.5 20.5" />
            </svg>
          )}
        </button>
      </span>
      {hint && (
        <span
          id={hintId}
          className="mt-1.5 block text-[11px] font-normal normal-case tracking-normal text-ink/55"
        >
          {hint}
        </span>
      )}
    </label>
  );
}
