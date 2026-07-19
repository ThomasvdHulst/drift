import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { goodbyeEmail } from "@/lib/email/messages";
import { sendViaResend } from "@/lib/email/send";

export const dynamic = "force-dynamic";

// POST /api/account/delete — permanently delete the signed-in user's account.
//
// This is the ONE place Drift uses the service-role secret key (it bypasses
// Row-Level Security), so it is careful about three things:
//   1. Server-only. The key comes from SUPABASE_SECRET_KEY (never NEXT_PUBLIC_),
//      so it is never shipped to the browser.
//   2. It verifies the CALLER'S OWN JWT before touching anything, so a user can
//      only ever delete themselves (never another account).
//   3. Deleting the auth.users row CASCADES to every app table — trails,
//      reactions, user_kv, profiles, friend_requests, shares are all declared
//      `on delete cascade` in supabase/migrations/* — so the person and all of
//      their data are removed together, atomically, at the database level.
//
// Graceful (CLAUDE.md §4): if the backend isn't configured, respond
// { ok: false, unconfigured: true } (200) so the client falls back to a local
// wipe and the flow never hard-errors.
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    return NextResponse.json({ ok: false, unconfigured: true }, { status: 200 });
  }

  const authz = request.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "not signed in" },
      { status: 401 },
    );
  }

  try {
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Validate the JWT against Supabase and resolve whose account this is. A
    // forged / expired token yields no user, so nothing is deleted.
    const { data, error } = await admin.auth.getUser(token);
    const uid = data?.user?.id;
    const email = data?.user?.email;
    if (error || !uid) {
      return NextResponse.json(
        { ok: false, error: "invalid session" },
        { status: 401 },
      );
    }

    // Send the "sorry to see you go" email BEFORE deletion (their address is gone
    // after). Best-effort: a failed send must never block the deletion the user
    // asked for, so it's fully caught inside sendViaResend and ignored here.
    if (email) {
      const bye = goodbyeEmail();
      await sendViaResend({ to: email, subject: bye.subject, html: bye.html });
    }

    // Hard-delete the auth user; the FK cascades clean up every app row.
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) {
      console.error("[api/account/delete]", delErr);
      return NextResponse.json(
        { ok: false, error: "delete failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[api/account/delete]", err);
    return NextResponse.json(
      { ok: false, error: "delete failed" },
      { status: 500 },
    );
  }
}
