import { NextResponse } from "next/server";
import { validateContact, type ContactInput } from "@/lib/contact";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  contactReceiptEmail,
  contactNotificationEmail,
} from "@/lib/email/messages";
import { sendViaResend } from "@/lib/email/send";
import { NO_STORE } from "@/lib/cache-headers";

export const dynamic = "force-dynamic";

// POST /api/contact — the one write path for the contact form.
//
// Two emails go out, both from noreply@usedrift.org via Resend:
//   1. a receipt to the sender, echoing their message back;
//   2. a notification to CONTACT_INBOX (the Drift mailbox), with reply_to set to
//      the SENDER, so replying from the forwarded copy answers the person.
// The notification is the one that matters, so it is sent first and its failure
// is the only one that fails the request. A receipt that doesn't send is a
// nuisance; a notification that doesn't send loses the message entirely.
//
// Anti-spam is layered, and every layer is invisible to a real person:
//   • honeypot + fill-time  (in validateContact; free, no configuration)
//   • per-IP throttle       (below; best effort on serverless)
//   • Cloudflare Turnstile  (optional, fail-closed once keys are set)
// A submission caught by a bot trap gets the SAME success response a human gets,
// so a script learns nothing about which check it tripped.

/** Where the notification goes. Defaults to the noreply mailbox, which Cloudflare
 *  Email Routing forwards to the owner's real inbox. */
function contactInbox(): string {
  return process.env.CONTACT_INBOX || "noreply@usedrift.org";
}

// Best-effort per-IP throttle. Module scope means one bucket per warm serverless
// instance, not a global one, so this is a speed bump for a burst rather than a
// guarantee. Turnstile is the real defence; this just keeps a single loud client
// from burning the Resend quota before Turnstile is switched on.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function throttled(ip: string): boolean {
  if (!ip) return false;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  // Bound the map so a long-lived instance can't grow it without limit.
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
      if (hits.size <= 500) break;
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] ?? "").trim() || "";
}

// One shape for every non-error outcome. Bot rejections and real sends are
// indistinguishable from the outside.
const accepted = () => NextResponse.json({ ok: true }, { headers: NO_STORE });

export async function POST(request: Request) {
  let body: ContactInput & { turnstileToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 400, headers: NO_STORE },
    );
  }

  const ip = clientIp(request);

  // Honeypot + fill-time + field validation, all re-run server side.
  const result = validateContact(body);
  if (!result.ok) {
    if (result.bot) return accepted(); // silent drop
    return NextResponse.json(
      { ok: false, error: result.error, field: result.field },
      { status: 400, headers: NO_STORE },
    );
  }

  if (throttled(ip)) {
    return NextResponse.json(
      {
        ok: false,
        error: "That is a few messages in a short while. Please try again a bit later.",
        field: null,
      },
      { status: 429, headers: NO_STORE },
    );
  }

  // Fail-closed once configured; a no-op when it isn't.
  const turnstile = await verifyTurnstile(body.turnstileToken, ip);
  if (!turnstile.ok) {
    console.warn("[api/contact] turnstile rejected:", turnstile.reason);
    return NextResponse.json(
      {
        ok: false,
        error:
          "We couldn't verify that submission. Please reload the page and try once more.",
        field: null,
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const details = result.value;

  try {
    const notification = contactNotificationEmail(details);
    const sent = await sendViaResend({
      to: contactInbox(),
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
      // The whole point: Reply in the forwarded copy goes to the person who wrote.
      replyTo: details.email,
    });

    if (!sent.sent) {
      console.error("[api/contact] notification failed:", sent.error);
      return NextResponse.json(
        {
          ok: false,
          error:
            "We couldn't send that just now. Please try again in a little while, or email us directly.",
          field: null,
        },
        { status: 502, headers: NO_STORE },
      );
    }

    // Best effort. The message is already safely delivered to the inbox, so a
    // failed receipt must not tell the sender their message was lost.
    const receipt = contactReceiptEmail(details);
    const receiptResult = await sendViaResend({
      to: details.email,
      subject: receipt.subject,
      html: receipt.html,
    });
    if (!receiptResult.sent) {
      console.warn("[api/contact] receipt failed:", receiptResult.error);
    }

    return accepted();
  } catch (err) {
    console.error("[api/contact]", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Something went wrong on our end. Please try again in a little while.",
        field: null,
      },
      { status: 500, headers: NO_STORE },
    );
  }
}
