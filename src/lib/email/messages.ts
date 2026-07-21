// The copy for Drift's transactional emails, built on the shared renderer.
// Two are sent by Supabase (confirm / reset) and use its {{ .ConfirmationURL }}
// placeholder; the rest are sent by us at runtime (welcome / goodbye, and the
// contact receipt + owner notification). All share one calm voice, no em/en
// dashes.

import { renderEmail, EMAIL_SITE_URL } from "./render";
import { notificationSubject } from "../contact";

export interface EmailMessage {
  subject: string;
  html: string;
  /** Plain-text alternative, set where the mail carries someone's own words. */
  text?: string;
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

export interface ContactDetails {
  name: string;
  email: string;
  topicLabel: string;
  message: string;
}

/** The receipt sent to the person who filled in the contact form. Echoes their
 *  own message back so they have a record of what they sent, and sets a plain,
 *  honest expectation about a reply. */
export function contactReceiptEmail(c: ContactDetails): EmailMessage {
  return {
    subject: "Thanks for writing to Drift",
    html: renderEmail({
      preheader: "We got your message. Here is a copy of what you sent.",
      heading: "Thanks for writing",
      body: [
        c.name ? `Hello ${c.name},` : "Hello,",
        "Your message reached us, and a real person will read it. We usually reply within a few days. If you need to add anything, just reply to this email.",
      ],
      quote: { label: `Your message: ${c.topicLabel}`, text: c.message },
      note: "If you did not write to Drift, you can safely ignore this email.",
    }),
  };
}

/** The notification sent to the Drift inbox. Deliberately plainer than the
 *  user-facing mail: it is a work item, so the message body and the reply address
 *  matter more than the styling. The route sets reply_to to the sender, so
 *  replying from the forwarded copy answers the person directly. */
export function contactNotificationEmail(c: ContactDetails): EmailMessage {
  const who = c.name ? `${c.name} <${c.email}>` : c.email;
  return {
    subject: notificationSubject(c),
    html: renderEmail({
      preheader: `${c.topicLabel} from ${who}`,
      heading: "New message via Drift",
      body: [`From: ${who}`, `Topic: ${c.topicLabel}`],
      quote: { text: c.message },
      // Below the message, so the reading order is who wrote, what they said,
      // then what to do about it.
      note: "Reply to this email to answer them directly.",
    }),
    text: [
      `From: ${who}`,
      `Topic: ${c.topicLabel}`,
      "",
      c.message,
      "",
      "Reply to this email to answer them directly.",
    ].join("\n"),
  };
}
