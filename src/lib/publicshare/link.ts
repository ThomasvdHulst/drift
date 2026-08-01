// ---------------------------------------------------------------------------
// Public share links (Phase 27): the pure half.
//
// A public share is a card or a trail, snapshotted, reachable by anyone holding
// an unguessable token. It exists so a reader can send something to a person who
// does not have a Drift account, which the friend-to-friend layer (Phase 10)
// cannot do by construction.
//
// THE TOKEN IS THE ONLY SECRET. There is no other access control: the database
// function that serves a share takes the token as an exact-match argument and
// the table is unreadable to anonymous callers (see
// supabase/migrations/0004_public_shares.sql for why that shape rather than an
// RLS policy). So the token has to be long enough that guessing is hopeless and
// short enough to sit in a WhatsApp message: 16 random bytes, base64url, 22
// characters, 128 bits.
//
// No I/O here. The Supabase calls live in ./client.ts, the same split
// lib/social/share.ts and lib/social/client.ts use.
// ---------------------------------------------------------------------------

// Relative, not "@/..." — vitest.config.ts sets no path alias, so a `@/` VALUE
// import makes a module untestable. The rest of src/lib does the same.
import { siteUrl } from "../site";
import type { Card } from "../types";
import type { TrailSnapshot } from "../social/share";

export type PublicShareKind = "trail" | "card";

/** A share as the public page receives it. Deliberately does NOT carry the
 *  owner's user id: a reader has no business learning who sent it beyond what
 *  the payload itself says. */
export interface PublicShare {
  kind: PublicShareKind;
  payload: TrailSnapshot | Card;
  createdAt: number;
}

/** 128 bits. Enough that enumeration is not a threat model, short enough to read
 *  aloud badly and paste well. */
export const TOKEN_BYTES = 16;

/**
 * How many cards a reader WITHOUT an account may drift before being asked to
 * make one.
 *
 * Three, and the number is said out loud before the first one rather than
 * sprung after the third. A limit a reader knows about is an honest boundary; a
 * limit that appears once they are invested is the pattern this app exists to
 * be the opposite of (CLAUDE.md §2).
 *
 * It is not a security boundary and is not pretending to be one: it lives in
 * sessionStorage and anyone who wants to reset it can. It bounds the ordinary
 * case, which is all it needs to do. There is a second, duller reason for a cap
 * at all: anonymous trial drifts draw on the same shared Wikimedia rate budget
 * as everyone else (docs/beta-readiness.md Q3), and an uncapped public feed is
 * the one shape that could exhaust it.
 */
export const TRIAL_CARD_LIMIT = 3;

/** Where the trial's progress lives. Session-scoped on purpose: closing the tab
 *  is not meant to be punished, and this is a courtesy counter, not a lock. */
export const TRIAL_KEY = "drift.trial.cards";

/** The shape the database enforces (`token_format` in the migration). Checked
 *  here too so a malformed URL never becomes a query. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function isValidToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

/** base64url with no padding: URL-safe, no percent-encoding, no `=` tail that
 *  chat clients like to leave outside the hyperlink. */
function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A fresh token. `random` is injected so tests are deterministic; the default is
 * the platform CSPRNG, which is the only acceptable source here. `Math.random`
 * would be a real vulnerability rather than a style question: it is seeded
 * predictably enough that tokens become guessable.
 */
export function newShareToken(
  random: (n: number) => Uint8Array = cryptoRandom,
): string {
  return base64url(random(TOKEN_BYTES));
}

function cryptoRandom(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** The absolute URL to hand to someone. Absolute because it is going into a
 *  chat message, where a relative path means nothing. */
export function shareUrl(token: string, origin: string = siteUrl()): string {
  return `${origin}/s/${token}`;
}

/** The human title of whatever is being shared, for the page, the preview card
 *  and the share sheet. Falls back rather than throwing: a share with a broken
 *  payload should still render something calm. */
export function shareTitleOf(share: PublicShare): string {
  if (share.kind === "trail") {
    const t = share.payload as Partial<TrailSnapshot>;
    return t.name?.trim() || "A trail on Drift";
  }
  const c = share.payload as Partial<Card>;
  return c.displayTitle?.trim() || "A card on Drift";
}

/**
 * The sentence under the title, on the page and in the link preview.
 *
 * For a trail it names the shape of the thing (how many stops, where it
 * started), because that is what makes someone curious enough to open it. For a
 * card it uses the card's own description, which is the source's words.
 */
export function shareDescriptionOf(share: PublicShare): string {
  if (share.kind === "trail") {
    const t = share.payload as Partial<TrailSnapshot>;
    const steps = Array.isArray(t.steps) ? t.steps : [];
    const first = steps[0]?.card?.displayTitle?.trim();
    const last = steps[steps.length - 1]?.card?.displayTitle?.trim();
    if (steps.length >= 2 && first && last) {
      return `${steps.length} stops, from ${first} to ${last}.`;
    }
    if (first) return `A trail that started at ${first}.`;
    return "A trail on Drift.";
  }
  const c = share.payload as Partial<Card>;
  return c.description?.trim() || c.extract?.trim()?.slice(0, 160) || "A card on Drift.";
}

/**
 * The text that rides along in the share sheet, next to the URL.
 *
 * Kept short and free of exclamation: WhatsApp shows it above the link preview,
 * and the preview already carries the title. Anything more reads as marketing
 * copy written by the sender, which they did not write.
 */
export function shareMessage(share: PublicShare): string {
  return share.kind === "trail"
    ? `A trail I followed on Drift: ${shareTitleOf(share)}`
    : `Something I read on Drift: ${shareTitleOf(share)}`;
}

/**
 * Validate what the database function returned before anything renders it.
 *
 * The row is JSON from a `jsonb` column, so it is whatever was put in there,
 * possibly by an older version of this app. Everything downstream treats a null
 * as "no such share", which is also what a revoked or unknown token produces, so
 * a malformed row degrades to the same calm "this link is not available" rather
 * than an error page.
 */
export function parsePublicShare(row: unknown): PublicShare | null {
  if (!row || typeof row !== "object") return null;
  const r = row as { kind?: unknown; payload?: unknown; created_at?: unknown };
  if (r.kind !== "trail" && r.kind !== "card") return null;
  if (!r.payload || typeof r.payload !== "object") return null;

  // A trail must have steps and a card must have a title, or there is nothing to
  // render and "not available" is the honest answer.
  if (r.kind === "trail") {
    const steps = (r.payload as Partial<TrailSnapshot>).steps;
    if (!Array.isArray(steps) || steps.length === 0) return null;
  } else if (!(r.payload as Partial<Card>).displayTitle) {
    return null;
  }

  const at = typeof r.created_at === "string" ? Date.parse(r.created_at) : NaN;
  return {
    kind: r.kind,
    payload: r.payload as TrailSnapshot | Card,
    createdAt: Number.isFinite(at) ? at : 0,
  };
}
