// The one switch for Phase 10's friends + sharing layer.
//
// Turned OFF (2026-07-27) by owner decision: the social surface was pulling
// attention away from the core loop, and the priority is to perfect the reading
// experience first. NOTHING IS DELETED — the pages, the `src/lib/social/*`
// modules, the DB tables and their RLS all stay exactly as they were, so
// flipping this back on restores the feature whole.
//
// Off means: no Friends or Inbox links, no "send to a friend" on a card or a
// trail, no handle picker on the account screen, and /friends and /inbox send
// you home rather than sitting there as orphan URLs.
//
// NOTE: Next.js only inlines `process.env.NEXT_PUBLIC_*` for the browser when it
// is a STATIC member access, so `socialEnabled()` reads the var literally and
// hands the value to the pure parser (which tests can call with anything).
// Mirrors `adsConfig()` in lib/ads.ts.

/** Opt-IN: only the exact string "1" enables it. Anything else (unset, "0",
 *  "true", junk) leaves the social layer hidden, so a missing env var can never
 *  switch it on by accident. */
export function parseSocialFlag(raw?: string | null): boolean {
  return raw?.trim() === "1";
}

/** Whether the friends + sharing UI should be shown at all. */
export function socialEnabled(): boolean {
  return parseSocialFlag(process.env.NEXT_PUBLIC_SOCIAL);
}
