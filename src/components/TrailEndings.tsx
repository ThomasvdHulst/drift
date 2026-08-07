"use client";

import type { TrailStep } from "@/lib/types";
import { leavesOf } from "@/lib/branch";
import { countWord, sentenceList } from "@/lib/text";

// ---------------------------------------------------------------------------
// "Where this trail ended" (Phase 30) — the leaves of the tree, said out loud.
//
// The map draws the shape; this names it. A branched trail does not have "an
// ending", it has several, and that is the one fact about a tree the drawing
// makes you count for yourself. Saying it is also the quietest possible way to
// teach the shape: a reader who forks once reads a sentence that only makes
// sense because they forked.
//
// It renders NOTHING on an unbranched trail, which is most of them. One ending
// is not an observation, and an app that announces the ordinary is an app you
// stop reading.
// ---------------------------------------------------------------------------

export function TrailEndings({ steps }: { steps: TrailStep[] }) {
  const leaves = leavesOf(steps);
  if (leaves.length < 2) return null;
  const titles = leaves.map((i) => steps[i].card.displayTitle);
  return (
    <p className="text-sm leading-relaxed text-ink/75">
      This trail ended in {countWord(leaves.length)} places:{" "}
      {sentenceList(titles)}.
    </p>
  );
}
