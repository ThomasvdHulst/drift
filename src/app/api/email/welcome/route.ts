import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { welcomeEmail } from "@/lib/email/messages";
import { sendViaResend } from "@/lib/email/send";

export const dynamic = "force-dynamic";

// POST /api/email/welcome — send the one-time welcome email after a user confirms
// their address. The client fires this on a confirmed sign-in; this route is the
// source of truth for "send exactly once":
//   1. It verifies the caller's OWN JWT (service-role getUser), so it only ever
//      welcomes the authenticated caller.
//   2. It only sends if the email is actually confirmed AND the user hasn't been
//      welcomed yet (tracked in app_metadata.welcomed, which only the service role
//      can set, so it can't be spoofed and survives across devices/sessions).
//   3. After a successful send it stamps app_metadata.welcomed so it never repeats.
//
// Fully graceful (CLAUDE.md §4): unconfigured backend / missing token / send
// failure all resolve without throwing, and never block the app.
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    return NextResponse.json({ ok: false, unconfigured: true });
  }

  const authz = request.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  try {
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.auth.getUser(token);
    const user = data?.user;
    if (error || !user) {
      return NextResponse.json({ ok: false, error: "invalid session" }, { status: 401 });
    }

    // Only welcome a confirmed, not-yet-welcomed user. Both checks make this a safe
    // no-op to call on every sign-in.
    const confirmed = Boolean(user.email_confirmed_at ?? user.confirmed_at);
    const alreadyWelcomed = Boolean(
      (user.app_metadata as Record<string, unknown> | undefined)?.welcomed,
    );
    if (!confirmed || alreadyWelcomed || !user.email) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const msg = welcomeEmail();
    const result = await sendViaResend({
      to: user.email,
      subject: msg.subject,
      html: msg.html,
    });
    if (!result.sent) {
      // Don't stamp welcomed, so a transient failure can retry next sign-in.
      return NextResponse.json({ ok: false, error: "send failed" }, { status: 502 });
    }

    // Stamp so it never sends again (merge to preserve any existing metadata).
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(user.app_metadata as Record<string, unknown>),
        welcomed: true,
      },
    });

    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    console.error("[api/email/welcome]", err);
    return NextResponse.json({ ok: false, error: "welcome failed" }, { status: 500 });
  }
}
