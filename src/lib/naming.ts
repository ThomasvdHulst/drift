import type { TrailStep } from "./types";

// ---------------------------------------------------------------------------
// Auto-naming a trail (spec §7): "First → Last". A one-stop trail is just that
// card's title; an empty trail gets a gentle placeholder. Pure + unit-tested.
// ---------------------------------------------------------------------------

export function autoTrailName(steps: TrailStep[]): string {
  if (steps.length === 0) return "An empty trail";
  const first = steps[0].card.displayTitle;
  if (steps.length === 1) return first;
  const last = steps[steps.length - 1].card.displayTitle;
  return `${first} → ${last}`;
}
