import type { ArrivedVia, Card, Door, Thread, TrailStep } from "./types";
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
  /** WHERE it was offered — the step a branch through this door forks from
   *  (Phase 29), and half of the reference a saved trail's link carries. */
  stepIndex: number;
  /** Which of that stop's doors this is: the other half of the reference, so a
   *  link can name the door without re-encoding it into a URL. */
  doorIndex: number;
}

/**
 * Every door still open on a trail: most recent first (the freshest curiosity),
 * deduplicated, and never one you ended up visiting anyway.
 *
 * "Visiting" covers a branch: walking a door (Phase 29) puts its page in the
 * trail, so the same filter that hid a door you happened to reach by drifting
 * now also retires one you deliberately came back for. Nothing extra to keep in
 * sync.
 */
export function doorsOf(
  steps: TrailStep[],
  opts: { max?: number } = {},
): OpenDoor[] {
  const max = opts.max ?? 5;
  const out: OpenDoor[] = [];
  for (const od of openDoors(steps)) {
    out.push(od);
    if (out.length >= max) break;
  }
  return out;
}

/** How many still-open doors each stop has, indexed like `steps` — what the map
 *  draws its spurs from, using the same filter as the list beneath it so the two
 *  can never disagree. */
export function openDoorCounts(steps: TrailStep[]): number[] {
  const counts = steps.map(() => 0);
  for (const od of openDoors(steps)) counts[od.stepIndex] += 1;
  return counts;
}

/** The one traversal both of the above share: newest stop first, a door dropped
 *  once the trail visits its page, and a door offered at two stops credited to
 *  the later one. */
function* openDoors(steps: TrailStep[]): Generator<OpenDoor> {
  const visited = new Set(steps.map((s) => s.card.pageTitle));
  const seen = new Set<string>();
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    const doors = step.doorsLeft ?? [];
    for (let j = 0; j < doors.length; j++) {
      const door = doors[j];
      if (visited.has(door.pageTitle) || seen.has(door.pageTitle)) continue;
      seen.add(door.pageTitle);
      yield {
        door,
        from: step.card.displayTitle,
        stepIndex: i,
        doorIndex: j,
      };
    }
  }
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

/** Where a door reopens as a FRESH drift. The seed path is realm-generic, so a
 *  Gallery doorway left unopened reopens as a Gallery drift rather than being
 *  lost. Used only where there is no trail to rejoin (a shared trail someone
 *  else walked); in your own trail a door branches instead — see below. */
export function doorHref(door: Door): string {
  const realm = realmOfSource(door.source);
  const params = new URLSearchParams({
    realm,
    title: door.pageTitle,
    seed: door.displayTitle,
  });
  return `/drift?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Walking a door (Phase 29) — it continues the trail rather than replacing it.
//
// A door used to reopen as a brand new session, which threw away the trail it
// came from: the connection between the stop that offered the door and where
// the door led existed nowhere afterwards. It now forks from that stop, and the
// two places that can start such a fork (the exit screen, in session; a saved
// trail, via the URL) build the same step through the same two functions.
//
// Phase 30 generalises the URL half. A door names a stop AND a destination; a
// saved trail can now also be reopened at a stop with the destination left open,
// and the threads fetched live. Both live here so that all of the saved-trail
// re-entry vocabulary is in one file and cannot diverge.
// ---------------------------------------------------------------------------

/** Reopen a SAVED trail on a branch through one of its doors. Carries a
 *  reference (which stop, which door) rather than the door itself, so the trail
 *  in storage stays the only description of it. */
export function doorBranchHref(trailId: string, od: OpenDoor): string {
  const params = new URLSearchParams({
    continue: trailId,
    door: `${od.stepIndex}.${od.doorIndex}`,
  });
  return `/drift?${params.toString()}`;
}

/**
 * Reopen a SAVED trail STANDING ON one of its stops (Phase 30).
 *
 * A door is the special case of this: it names a destination as well as a stop.
 * The general case names only the stop, and the threads are fetched live, which
 * is what lets an old trail grow a line it never recorded a door for. Same
 * reference-not-payload rule as `doorBranchHref`: the trail in storage stays the
 * only description of itself.
 */
export function stopBranchHref(trailId: string, stepIndex: number): string {
  const params = new URLSearchParams({
    continue: trailId,
    from: String(stepIndex),
  });
  return `/drift?${params.toString()}`;
}

/** Read `?from=<stop>` back, or null if it is missing or junk. Same posture as
 *  `parseDoorParam` below: a URL is untrusted input, and a bad one must resume
 *  the trail at its tip rather than fail to open it. */
export function parseStopParam(value: string | null): number | null {
  const m = /^(\d{1,6})$/.exec((value ?? "").trim());
  return m ? Number(m[1]) : null;
}

/** Read `?door=<stop>.<door>` back, or null if it is missing or junk (it is a
 *  URL, so it is untrusted; a bad one must simply resume the trail). */
export function parseDoorParam(
  value: string | null,
): { stepIndex: number; doorIndex: number } | null {
  const m = /^(\d{1,6})\.(\d{1,3})$/.exec((value ?? "").trim());
  if (!m) return null;
  return { stepIndex: Number(m[1]), doorIndex: Number(m[2]) };
}

/** How a walked door arrives: a thread you pulled, just later. `viaDoor` is the
 *  only thing that distinguishes it, and it exists so the map and the story can
 *  say you came back for this rather than implying you took it at the time. */
export function doorArrival(
  door: Door,
  from: Pick<Card, "pageTitle" | "source">,
): Extract<ArrivedVia, { type: "thread" }> {
  const fromRealm = realmOfSource(from.source);
  const toRealm = realmOfSource(door.source);
  return {
    type: "thread",
    label: door.displayTitle,
    fromTitle: from.pageTitle,
    viaDoor: true,
    ...(door.kind ? { kind: door.kind } : {}),
    ...(door.bridge ? { bridge: door.bridge } : {}),
    ...(toRealm !== fromRealm ? { crossedFrom: fromRealm } : {}),
  };
}
