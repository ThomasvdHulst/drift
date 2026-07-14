import type { TrailStep } from "./types";

// ---------------------------------------------------------------------------
// Trail statistics for the trail-map header + (later) the personal stats view.
// Derived purely from the recorded steps. `durationMs` prefers the sum of
// per-step dwell times; if dwell wasn't recorded it falls back to the span
// between the first and last arrival so it's always a sane number. Unit-tested.
// ---------------------------------------------------------------------------

export interface TrailStats {
  stops: number;
  threadsPulled: number;
  drifts: number;
  readMores: number;
  durationMs: number;
}

export function computeTrailStats(steps: TrailStep[]): TrailStats {
  let threadsPulled = 0;
  let drifts = 0;
  let readMores = 0;
  let dwellSum = 0;
  let anyDwell = false;

  for (const s of steps) {
    if (s.arrivedVia.type === "thread") threadsPulled++;
    else if (s.arrivedVia.type === "drift") drifts++;
    if (s.expanded) readMores++;
    if (typeof s.dwellMs === "number") {
      dwellSum += s.dwellMs;
      anyDwell = true;
    }
  }

  let durationMs = dwellSum;
  if (!anyDwell && steps.length > 1) {
    durationMs = Math.max(
      0,
      steps[steps.length - 1].timestamp - steps[0].timestamp,
    );
  }

  return {
    stops: steps.length,
    threadsPulled,
    drifts,
    readMores,
    durationMs,
  };
}

/** Human-friendly duration: "45 sec" / "21 min" / "1 hr 3 min". */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec} sec`;
  const totalMin = Math.round(totalSec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return min === 0 ? `${hr} hr` : `${hr} hr ${min} min`;
}
