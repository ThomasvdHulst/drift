"use client";

import { useState } from "react";
import { ShareLink } from "@/components/ShareLink";
import { ShareToFriend } from "@/components/ShareToFriend";
import { socialEnabled } from "@/lib/social/enabled";
import type { PublicShare, PublicShareKind } from "@/lib/publicshare/link";

// ---------------------------------------------------------------------------
// One sheet for "share this", used by the card in the feed and by the trail map.
//
// WHY IT EXISTS. There used to be two unrelated affordances. A card had a
// paper-plane button labelled "Send to a friend", gated behind
// NEXT_PUBLIC_SOCIAL, which is OFF, so in practice a reader could not share a
// card AT ALL. A trail had a "Share a link" panel under its map and a separate
// "Send to a friend" button in its toolbar. The result was that the same verb
// meant two different things in two places and was missing from a third
// (reported: "I cannot see a button to share a post mid-drift").
//
// Now both surfaces open this, and it offers the same two things in the same
// order everywhere:
//
//   1. A public link. Always available, because it is what a reader actually
//      wants: it reaches someone who does not have Drift.
//   2. Sending it to a friend inside Drift. Only when NEXT_PUBLIC_SOCIAL is on,
//      because that is the friend graph the owner deliberately hid.
//
// A dialog rather than an inline panel: on a phone the feed card fills the
// screen, so there is nowhere to put a panel without pushing the card around.
// ---------------------------------------------------------------------------

export function ShareSheet({
  kind,
  payload,
  label,
  onClose,
}: {
  kind: PublicShareKind;
  /** The snapshot to publish: `trailToSharePayload(trail)` or the card itself. */
  payload: PublicShare["payload"];
  /** What is being shared, named, so the sheet can say so. */
  label: string;
  onClose: () => void;
}) {
  const [toFriend, setToFriend] = useState(false);

  // The friend flow is its own full modal, so hand straight over to it rather
  // than nesting two dialogs.
  if (toFriend) {
    return (
      <ShareToFriend
        kind={kind}
        payload={payload}
        label={label}
        onClose={onClose}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${label}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-paper-raised p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-serif text-xl leading-tight text-ink">
              Share {kind === "trail" ? "this trail" : "this card"}
            </h2>
            <p className="mt-0.5 truncate text-sm text-ink-soft">{label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full border border-line-strong px-2.5 py-1 text-sm text-ink-soft transition hover:text-accent-strong focus-ring"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <ShareLink kind={kind} payload={payload} />
        </div>

        {socialEnabled() && (
          <button
            type="button"
            onClick={() => setToFriend(true)}
            className="mt-4 text-sm text-ink-soft underline-offset-2 transition hover:text-accent-strong hover:underline"
          >
            Or send it to a friend on Drift
          </button>
        )}
      </div>
    </div>
  );
}
