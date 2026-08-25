// The copy for Drift's transactional emails, built on the shared renderer.
// Two are sent by Supabase (confirm / reset) and use its {{ .TokenHash }}
// placeholder; the rest are sent by us at runtime (welcome / goodbye, and the
// contact receipt + owner notification). All share one calm voice, no em/en
// dashes.

import { renderEmail, EMAIL_SITE_URL } from "./render";
import { notificationSubject } from "../contact";
import { imprint } from "../imprint";
import { describeVat, formatEur } from "../billing/price";

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

// ---------------------------------------------------------------------------
// The supporter receipt (Phase 32).
//
// This is the one email in the app with legal weight. A distance contract with a
// consumer has to be confirmed on a "durable medium" within a reasonable time,
// and that confirmation has to carry the trader's identity, the total price with
// the tax inside it named, and the right of withdrawal with how to use it
// (art. 6:230v BW, implementing the Consumer Rights Directive).
//
// Drift does NOT exclude the 14 day withdrawal right, which most sellers of
// digital goods do. Excluding it needs an express consent plus a separate
// acknowledgement that the right is being given up, gathered as two deliberate
// acts, and getting that subtly wrong leaves the reader with a 12 month
// withdrawal period instead of 14 days. Honouring it costs an occasional €7 and
// deletes the entire mechanism, so the copy below simply tells people they can
// change their mind.
// ---------------------------------------------------------------------------

export interface SupporterReceipt {
  /** Total paid, in cents. */
  grossCents: number;
  vatCents: number;
  netCents: number;
  ratePct: number;
  /** When it was paid. */
  paidAt: Date;
  /** Stripe's session id, so a question about this payment can be traced. */
  reference: string;
  /** The billing country Stripe collected, when it did. Decides whether a zero
   *  BTW line may claim "supplied outside the EU" or must stay silent. */
  country?: string;
}

export function supporterReceiptEmail(r: SupporterReceipt): EmailMessage {
  const who = imprint();
  const when = r.paidAt.toISOString().slice(0, 10);
  const lines = [
    `Drift supporter unlock (one time)`,
    `Paid on ${when}`,
    ``,
    `Total          ${formatEur(r.grossCents)}`,
    describeVat(r.vatCents, r.ratePct, r.country).line,
    `Excluding BTW  ${formatEur(r.netCents)}`,
    ``,
    `Reference      ${r.reference}`,
    ``,
    `${who.legalName}, trading as ${who.tradeName}`,
    who.address.join(", "),
    `KVK ${who.kvk}${who.vat ? ` · BTW-id ${who.vat}` : ""}`,
    who.email,
  ].join("\n");

  return {
    subject: "Your Drift supporter unlock",
    html: renderEmail({
      preheader: "Thank you. Your daily reading limit is lifted.",
      heading: "Thank you for supporting Drift",
      body: [
        "Your supporter unlock is active. The daily reading limit no longer applies to your account, and everything added to the unlock later is included at no extra cost.",
        "Drift is one person's project. It has no advertising, no tracking and nothing in the feed but cards, and what you paid is what keeps it that way.",
      ],
      quote: { label: "Receipt", text: lines },
      cta: { label: "Go and wander", url: `${EMAIL_SITE_URL}/drift` },
      note: "You can change your mind within 14 days and get your money back, for any reason or none. Just reply to this email or use the withdrawal form on your account page. Keep this email as your receipt.",
    }),
    text: `Thank you for supporting Drift.\n\n${lines}\n\nYou can change your mind within 14 days and get your money back, for any reason or none.`,
  };
}

/**
 * The withdrawal acknowledgement (Phase 32).
 *
 * Art. 6:230s(1) BW: when a consumer withdraws electronically, the trader must
 * acknowledge receipt on a durable medium without delay. Since Drift refunds on
 * the spot rather than queueing a request, this acknowledges the withdrawal and
 * confirms the refund in one message, which is what the reader actually wants to
 * know: the money is on its way and here is how long banks take.
 */
export function withdrawalConfirmedEmail(r: {
  amountCents: number;
  /** Stripe's reference for the original payment. */
  reference: string;
}): EmailMessage {
  const who = imprint();
  const amount = formatEur(r.amountCents);
  return {
    subject: "Your Drift refund is on its way",
    html: renderEmail({
      preheader: `${amount} is being returned to the way you paid.`,
      heading: "Your refund is on its way",
      body: [
        `You have withdrawn from your purchase of the Drift supporter unlock, and ${amount} is being returned to the card or account you paid with. Banks usually take five to ten days to show it, which is out of our hands.`,
        "The unlock has been removed from your account, so the daily reading allowance applies again. Everything you have read and saved is untouched, and you are welcome to keep reading Drift for free every day.",
        "You do not need to tell us why, and we have not asked.",
      ],
      quote: {
        label: "Refunded",
        text: [
          `Drift supporter unlock`,
          `Amount        ${amount}`,
          `Reference     ${r.reference}`,
          ``,
          `${who.legalName}, trading as ${who.tradeName}`,
          `KVK ${who.kvk}${who.vat ? ` · BTW-id ${who.vat}` : ""}`,
          who.email,
        ].join("\n"),
      },
      note: "If the money has not appeared after ten days, reply to this email and we will look into it.",
    }),
    text: `Your refund is on its way.\n\nDrift supporter unlock\nAmount ${amount}\nReference ${r.reference}\n\nThe unlock has been removed from your account. Banks usually take five to ten days to show a refund.`,
  };
}
