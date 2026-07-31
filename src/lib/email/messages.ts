// The copy for Drift's transactional emails, built on the shared renderer.
// Two are sent by Supabase (confirm / reset) and use its {{ .TokenHash }}
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

// The link Supabase fills in at send time. Kept verbatim (the renderer does not
// escape URLs), so the `&` is written as `&amp;` here for valid HTML.
//
// WHY NOT `{{ .ConfirmationURL }}` (what these used to use): that variable sends
// the reader through Supabase's /verify endpoint, which bounces back to the app
// with a PKCE `?code=`. Exchanging that code needs a `code_verifier` stored in
// the localStorage of the browser that STARTED the sign-up, so the link only
// worked in that one browser profile: opening it on a phone after signing up on
// a laptop, or in a private tab, or in a mail app's in-app browser, landed the
// reader on the homepage silently signed out.
//
// `{{ .TokenHash }}` carries a token our /auth/confirm page redeems with
// `verifyOtp`, which needs nothing from local storage and therefore works in
// whatever browser actually opened the email.
function confirmUrl(type: "signup" | "recovery"): string {
  return `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}`;
}

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
      cta: { label: "Confirm email", url: confirmUrl("signup") },
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
      cta: { label: "Reset password", url: confirmUrl("recovery") },
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
  /** Empty for an anonymous Article 16 notice. */
  email: string;
  topicLabel: string;
  message: string;
  /** Article 16(2)(b), report mode only: where the content is. */
  location?: string;
  /** True when this is a DSA Article 16 notice rather than an ordinary message. */
  isReport?: boolean;
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

// ---------------------------------------------------------------------------
// DSA Article 16 notice-and-action (compliance audit M-5). Two emails, and both
// are obligations rather than courtesies:
//
//   Article 16(4) — confirm receipt of the notice "without undue delay", where
//                   the notifier gave contact details. Hence `noticeReceiptEmail`.
//   Article 16(5) — notify the notifier of the decision, "including information
//                   on the possibilities for redress". That one is a human reply
//                   later; the receipt below promises it, so the promise is on
//                   the record from the start.
//
// A notice may be anonymous, in which case neither email has anywhere to go and
// the route sends only the work item to the inbox.
// ---------------------------------------------------------------------------

/** Article 16(4): the automatic confirmation that a report arrived. */
export function noticeReceiptEmail(c: ContactDetails): EmailMessage {
  return {
    subject: "We received your report",
    html: renderEmail({
      preheader: "Your report about illegal content on Drift has been received.",
      heading: "Your report has been received",
      body: [
        c.name ? `Hello ${c.name},` : "Hello,",
        "This confirms that your report reached Drift. A person will read it and decide what to do, and nothing about that decision is automated.",
        "When it is decided you will get a message saying what was done and why, and what you can do if you disagree. That includes going to a court, or raising the matter with the Autoriteit Consument en Markt, which supervises the Digital Services Act in the Netherlands.",
      ],
      quote: {
        label: "What you reported",
        text: [c.location ? `Where: ${c.location}` : "", c.message]
          .filter(Boolean)
          .join("\n\n"),
      },
      note: "If you did not send this report, you can safely ignore this email.",
    }),
    text: [
      "This confirms that your report reached Drift. A person will read it and decide what to do, and nothing about that decision is automated.",
      "",
      "When it is decided you will get a message saying what was done and why, and what you can do if you disagree.",
      "",
      c.location ? `Where: ${c.location}` : "",
      "",
      c.message,
    ]
      .filter((l) => l !== undefined)
      .join("\n"),
  };
}

/** The work item for the Drift inbox. Louder than an ordinary notification
 *  because a notice starts a clock that a piece of feedback does not, and it
 *  spells out what still has to happen so the obligation is not left in a spec. */
export function noticeNotificationEmail(c: ContactDetails): EmailMessage {
  const who = c.email ? (c.name ? `${c.name} <${c.email}>` : c.email) : "Anonymous";
  const todo = c.email
    ? "To do: confirm receipt (sent automatically), then decide and tell the notifier the outcome and their redress options (Article 16(5)). If anything is restricted, send the person responsible a statement of reasons (Article 17)."
    : "To do: this notice is anonymous, so there is nobody to notify of the outcome. Decide it anyway, and if anything is restricted, send the person responsible a statement of reasons (Article 17).";
  return {
    subject: notificationSubject({ ...c, isReport: true }),
    html: renderEmail({
      preheader: `Illegal content report from ${who}`,
      heading: "Illegal content report",
      body: [
        `From: ${who}`,
        `Where: ${c.location ?? "not given"}`,
        "The notifier confirmed that the information and allegations are accurate and complete to the best of their knowledge.",
      ],
      quote: { label: "Why they believe it is illegal", text: c.message },
      note: todo,
    }),
    text: [
      `From: ${who}`,
      `Where: ${c.location ?? "not given"}`,
      "Good faith statement: confirmed.",
      "",
      c.message,
      "",
      todo,
    ].join("\n"),
  };
}
