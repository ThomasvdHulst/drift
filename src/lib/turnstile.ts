// Server-only Cloudflare Turnstile verification (Phase 22).
//
// Turnstile is the invisible anti-spam layer on the contact form. It is OPTIONAL,
// following the same contract as Supabase and Ollama (CLAUDE.md §4): with no keys
// set it is simply not part of the pipeline, and the form still has the honeypot,
// the fill-time check, and the per-IP throttle. With keys set it is enforced, and
// it FAILS CLOSED: a missing, forged, replayed, or unverifiable token is refused.
// A captcha that lets requests through when it errors is not a captcha.

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** True when both halves of the key pair are present. The site key is public (it
 *  ships in the browser bundle); the secret must never get a NEXT_PUBLIC_ prefix. */
export function turnstileConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY,
  );
}

export interface TurnstileResult {
  /** Whether the request may proceed. */
  ok: boolean;
  /** Why not, for server logs only. Never shown to the client: telling a bot
   *  which check it failed just helps it iterate. */
  reason?: string;
}

/**
 * Interpret a siteverify response body. Split out from the fetch so the decision
 * logic is pure and unit-testable without a network.
 */
export function readSiteverify(body: unknown): TurnstileResult {
  const data = body as { success?: unknown; "error-codes"?: unknown } | null;
  if (!data || typeof data !== "object") return { ok: false, reason: "malformed" };
  if (data.success === true) return { ok: true };
  const codes = Array.isArray(data["error-codes"])
    ? (data["error-codes"] as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  return { ok: false, reason: codes.join(",") || "rejected" };
}

/**
 * Verify a Turnstile token against Cloudflare.
 *
 * Returns ok:true unchanged when Turnstile isn't configured, so the caller can
 * treat "not set up" and "passed" the same way. Every other path is fail-closed.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<TurnstileResult> {
  if (!turnstileConfigured()) return { ok: true, reason: "not configured" };

  const secret = process.env.TURNSTILE_SECRET_KEY!;
  // Cloudflare caps tokens at 2048 chars; anything longer is junk we shouldn't
  // bother sending upstream.
  if (!token || token.length > 2048) return { ok: false, reason: "missing token" };

  try {
    // siteverify takes form-encoded input, not JSON.
    const form = new URLSearchParams({ secret, response: token });
    if (remoteIp) form.set("remoteip", remoteIp);

    const res = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: `siteverify ${res.status}` };
    return readSiteverify(await res.json());
  } catch (err) {
    console.error("[turnstile] verification error", err);
    // Fail closed: if we cannot prove the caller is human, we don't send mail.
    return { ok: false, reason: "verification unavailable" };
  }
}
