// Server-only helper to send a transactional email through the Resend HTTP API.
//
// We send our custom emails (welcome / goodbye) via Resend's REST API rather than
// SMTP: it's one env var (RESEND_API_KEY), no SMTP handshake to babysit in a
// serverless function, and it's the same account whose SMTP powers Supabase's
// auth emails. Fully graceful (CLAUDE.md §4): if the key is missing or the send
// fails, it logs and returns { sent: false } and NEVER throws, so a failed email
// can never break sign-up or account deletion.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** From address, e.g. `Drift <noreply@usedrift.org>`. Overridable via EMAIL_FROM. */
function fromAddress(): string {
  return process.env.EMAIL_FROM || "Drift <noreply@usedrift.org>";
}

export interface SendResult {
  sent: boolean;
  error?: string;
}

export async function sendViaResend(msg: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set; skipping send to", msg.to);
    return { sent: false, error: "not configured" };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[email] Resend send failed", res.status, detail);
      return { sent: false, error: `resend ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Resend send error", err);
    return { sent: false, error: "send error" };
  }
}
