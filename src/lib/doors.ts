import type { Door, Thread, TrailStep } from "./types";
import { realmOfSource } from "./crossrealm";

export type { Door };

// ---------------------------------------------------------------------------
// "The doors you left open" (Phase 28) — the threads a stop offered you and you
// did not take.
//
// Every other feed treats the road not taken as nothing: it is regenerated,
// reshuffled and gone. But a trail is a sequence of CHOICES, and a choice is
// only legible next to what it was chosen over. Keeping them makes the exit
// screen say something no other product can say ("you stood here and did not
// go there"), and it gives the one honest reason to come back that Drift can
// offer: a door you left open is a bookmark, not a notification (§2.4).
//
// Two rules keep it from becoming noise:
//   • Only stops you ENGAGED with leave doors. A card you scrolled straight past
//     did not offer you a choice you declined, it offered you nothing — and
//     recording all three chips of all twenty stops would bury the handful that
//     mean something under fifty-five that do not.
//   • A door you walked through later is not a door you left. The trail decides
//     that, not the moment.
// ---------------------------------------------------------------------------

/** At most this many per stop: the point is the one that got away, not an audit
 *  log of every chip ever rendered. */
const PER_STOP = 2;

/** The doors a stop leaves behind: the threads it offered, minus the one taken. */
export function doorsFrom(
  threads: Thread[],
  takenTitle?: string,
  max: number = PER_STOP,
): Door[] {
  const out: Door[] = [];
  for (const t of threads) {
    const title = t.candidate?.pageTitle;
    if (!title || title === takenTitle) continue;
    out.push({
      pageTitle: title,
      displayTitle: t.candidate.displayTitle || title,
      ...(t.kind ? { kind: t.kind } : {}),
      ...(t.candidate.source && t.candidate.source !== "wikipedia"
        ? { source: t.candidate.source }
        : {}),
      ...(t.bridge ? { bridge: t.bridge.sentence } : {}),
    });
    if (out.length >= max) break;
  }
  return out;
}

export interface OpenDoor {
  door: Door;
  /** The stop it was offered at, so the list can say where you were standing. */
  from: string;
}

/**
 * Every door still open on a trail: most recent first (the freshest curiosity),
 * deduplicated, and never one you ended up visiting anyway.
 */
export function doorsOf(
  steps: TrailStep[],
  opts: { max?: number } = {},
): OpenDoor[] {
  const max = opts.max ?? 5;
  const visited = new Set(steps.map((s) => s.card.pageTitle));
  const seen = new Set<string>();
  const out: OpenDoor[] = [];
  for (let i = steps.length - 1; i >= 0 && out.length < max; i--) {
    const step = steps[i];
    for (const door of step.doorsLeft ?? []) {
      if (visited.has(door.pageTitle) || seen.has(door.pageTitle)) continue;
      seen.add(door.pageTitle);
      out.push({ door, from: step.card.displayTitle });
      if (out.length >= max) break;
    }
  }
  return out;
}

/** How long a stop has to hold you before its untaken threads count as doors
 *  you declined rather than chips you never read. */
export const DOOR_DWELL_MS = 15_000;

/** Did this stop earn the right to leave doors? Reading it (opening the fuller
 *  article), reacting to it, or simply staying a while all count; scrolling past
 *  does not. */
export function engagedWith(opts: {
  expanded?: boolean;
  reacted?: boolean;
  dwellMs?: number;
}): boolean {
  return (
    !!opts.expanded || !!opts.reacted || (opts.dwellMs ?? 0) >= DOOR_DWELL_MS
  );
}

/** Where a door reopens. The seed path is realm-generic, so a Gallery doorway
 *  left unopened reopens as a Gallery drift rather than being lost. */
export function doorHref(door: Door): string {
  const realm = realmOfSource(door.source);
  const params = new URLSearchParams({
    realm,
    title: door.pageTitle,
    seed: door.displayTitle,
  });
  return `/drift?${params.toString()}`;
}
