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
// rather than just changing shape. It sits in a <div> beside the <label>, NOT
// inside it: a <label> may not contain a second labelable element, and a button
// nested in one is exactly the malformed shape that makes a password manager
// mis-read which control the label belongs to.
export function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  hint,
  required = true,
  invalid,
  describedBy,
}: {
  label: string;
  /** Form-control name. Password managers read it as a hint about the field. */
  name?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  /** Shown under the field, e.g. the rules while choosing a new password. */
  hint?: string;
  required?: boolean;
  /** The submitted value was refused (marks the control for assistive tech). */
  invalid?: boolean;
  /** Id of an error message this field should be described by. */
  describedBy?: string;
}) {
  const [shown, setShown] = useState(false);
  const fieldId = useId();
  const hintId = useId();

  const describe = [describedBy, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className="block">
      <label
        htmlFor={fieldId}
        className="block text-xs font-medium uppercase tracking-wide text-ink-soft"
      >
        {label}
      </label>
      <span className="relative mt-1 block">
        <input
          id={fieldId}
          name={name}
          type={shown ? "text" : "password"}
          required={required}
          // The server is the authority on the rule; this only stops the most
          // obvious near-miss before a round trip. ONLY while choosing a new
          // password: an account made when the app still said six characters has
          // a six-character password, and a minLength on the sign-in field made
          // the browser refuse to submit it at all — locked out by a hint.
          minLength={
            autoComplete === "new-password" ? PASSWORD_RULES.minLength : undefined
          }
          autoComplete={autoComplete}
          // "Show password" flips this to type="text", and a phone keyboard will
          // happily capitalise and autocorrect a visible password.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describe || undefined}
          className="w-full rounded-lg border border-line-strong bg-paper py-2 pl-3 pr-11 text-sm text-ink focus-ring"
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
          className="mt-1.5 block text-[11px] font-normal normal-case tracking-normal text-ink/75"
        >
          {hint}
        </span>
      )}
    </div>
  );
}

/**
 * The account's email, present in the DOM purely so a password manager can tell
 * WHICH saved login a new password belongs to.
 *
 * Apple Keychain, 1Password and Chrome all key a credential on a username. A
 * change-password form that offers only `new-password` fields gives them nothing
 * to match on, so they either save a second, orphaned entry or say nothing at
 * all and the reader is left with a password their manager does not know. The
 * documented fix is to include the username field even when there is nothing to
 * type into it.
 *
 * Visually hidden with `sr-only` (which clips, so the field is still laid out
 * and readable to a manager) rather than `hidden`/`display:none`, which some
 * managers skip. `aria-hidden` + `tabIndex={-1}` keep it out of the reading
 * order and the tab order: it is not a control anyone is meant to use, and the
 * page says the address in plain prose beside it.
 */
export function AccountUsernameField({ email }: { email: string }) {
  // An OAuth-only account can in principle have no address on it; an empty
  // username field would be worse than none.
  if (!email) return null;
  return (
    <input
      type="text"
      name="username"
      autoComplete="username"
      value={email}
      readOnly
      tabIndex={-1}
      aria-hidden="true"
      className="sr-only"
    />
  );
}
