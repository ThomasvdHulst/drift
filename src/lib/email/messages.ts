// The copy for Drift's four transactional emails, built on the shared renderer.
// Two are sent by Supabase (confirm / reset) and use its {{ .ConfirmationURL }}
// placeholder; two are sent by us at runtime (welcome / goodbye). All share one
// calm voice, no em/en dashes.

import { renderEmail, EMAIL_SITE_URL } from "./render";

export interface EmailMessage {
  subject: string;
  html: string;
}

// Supabase substitutes this at send time. Kept verbatim (not URL-escaped) in the
// generated template files.
const CONFIRMATION_URL = "{{ .ConfirmationURL }}";

/** Confirm-signup template for Supabase (Auth → Email Templates → Confirm signup). */
export function confirmSignupTemplate(): EmailMessage {
  return {
    subject: "Confirm your email for Drift",
    html: renderEmail({
      preheader: "One click to confirm your email and start wandering.",
      heading: "Confirm your email",
      body: [
        "Welcome to Drift. You are one step away from wandering.",
        "Confirm your email address to finish setting up your account.",
      ],
      cta: { label: "Confirm email", url: CONFIRMATION_URL },
      note: "If you did not create a Drift account, you can safely ignore this email.",
    }),
  };
}

/** Reset-password template for Supabase (Auth → Email Templates → Reset password). */
export function resetPasswordTemplate(): EmailMessage {
  return {
    subject: "Reset your Drift password",
    html: renderEmail({
      preheader: "A link to choose a new password for your Drift account.",
      heading: "Reset your password",
      body: [
        "We received a request to reset the password for your Drift account.",
        "Choose a new password with the button below. For your safety, the link expires after a little while.",
      ],
      cta: { label: "Reset password", url: CONFIRMATION_URL },
      note: "If you did not request this, you can ignore this email and your password stays the same.",
    }),
  };
}

/** Welcome email, sent by us once a new account's email is confirmed. */
export function welcomeEmail(): EmailMessage {
  return {
    subject: "Welcome to Drift",
    html: renderEmail({
      preheader: "Your account is ready. Here is how Drift works.",
      heading: "You are the algorithm",
      body: [
        "Your email is confirmed and your account is ready.",
        "Drift is a calm feed of knowledge cards where you steer. Pull a thread to follow a direction that interests you, drift onward to wander somewhere new, and end a session to see the trail map of where your curiosity went.",
        "There is no feed deciding for you here. Take your time.",
      ],
      cta: { label: "Start drifting", url: `${EMAIL_SITE_URL}/drift` },
    }),
  };
}

/** Goodbye email, sent by us just before an account is permanently deleted. */
export function goodbyeEmail(): EmailMessage {
  return {
    subject: "Sorry to see you go",
    html: renderEmail({
      preheader: "Your Drift account and all its data have been deleted.",
      heading: "Sorry to see you go",
      body: [
        "Your Drift account and everything in it have been permanently deleted, just as you asked. No trails, reactions, interests, or personal data remain.",
        "Thank you for spending some of your curiosity with us. If you ever feel like wandering again, the door is always open.",
      ],
      note: "You are receiving this one last email to confirm the deletion is complete.",
    }),
  };
}
