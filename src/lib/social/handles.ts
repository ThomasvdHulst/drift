// Pure handle helpers (Phase 10). A handle is how a friend finds you: lowercase
// letters/digits/underscore, 3–30 chars. Matches the DB check constraint in
// supabase/migrations/0002_phase10_social.sql. No React/DOM here — unit-tested.

export const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

/** Normalize user input to a candidate handle: trim, drop leading @, lowercase. */
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

/** Whether a NORMALIZED handle is valid (call normalizeHandle first). */
export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle);
}

/** A friendly validation message for a normalized handle, or null if valid. */
export function handleError(handle: string): string | null {
  if (handle.length < 3) return "Handles are at least 3 characters.";
  if (handle.length > 30) return "Handles are at most 30 characters.";
  if (!/^[a-z0-9_]+$/.test(handle))
    return "Use only lowercase letters, numbers, and underscores.";
  return null;
}
