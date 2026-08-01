import { createClient } from "@supabase/supabase-js";
import { isValidToken, parsePublicShare, type PublicShare } from "./link";

// ---------------------------------------------------------------------------
// Reading a public share on the SERVER (Phase 27).
//
// WHY THIS EXISTS SEPARATELY FROM lib/supabase/client.ts. That client returns
// null during SSR on purpose: it persists an auth session, which needs the
// browser. This one is the opposite kind of client. It is anonymous, holds no
// session, and exists to answer one question before any JavaScript runs:
// "what is at this token?"
//
// It has to be the server, for two independent reasons.
//
//   1. WhatsApp's link-preview crawler does not run JavaScript. The og: tags
//      have to be in the HTML the server sends, so `generateMetadata` needs the
//      share, so the fetch cannot live in a client effect.
//   2. The reader may have no account. Server-rendering the shared content
//      means they see it immediately rather than watching a spinner resolve
//      into a thing they were promised in a chat message.
//
// SECURITY. This uses the PUBLISHABLE key, the same one the browser already
// ships, and calls `get_public_share()`, a security-definer function that takes
// the token as an exact-match argument. The table itself has no anonymous select
// policy, so there is no listing and no enumeration: the token is the
// capability. See supabase/migrations/0004_public_shares.sql, which explains why
// an RLS policy would have been the wrong shape here.
//
// GRACEFUL. Unconfigured, unreachable, malformed, revoked and unknown all
// produce the same `null`, which the page renders as one calm "this link is not
// available" state. A reader who was sent a dead link does not need to know
// which kind of dead it was, and neither does anyone probing for tokens.
// ---------------------------------------------------------------------------

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function fetchPublicShare(
  token: string,
): Promise<PublicShare | null> {
  // Checked before it becomes a query, so a hand-typed or hostile path never
  // reaches the database. The same pattern the artwork proxy uses on its id.
  if (!isValidToken(token)) return null;
  if (!URL || !PUBLISHABLE_KEY) return null;

  try {
    const sb = createClient(URL, PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .rpc("get_public_share", { p_token: token })
      .maybeSingle();
    if (error) return null;
    return parsePublicShare(data);
  } catch {
    return null;
  }
}
