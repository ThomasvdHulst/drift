"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import type { TrailStep } from "@/lib/types";
import type { RealmId } from "@/lib/realms/types";
import type { OpenDoor } from "@/lib/doors";
import { hasBranches } from "@/lib/branch";
import { cardId } from "@/lib/card";
import { autoTrailName } from "@/lib/naming";
import { computeTrailStats, formatDuration } from "@/lib/stats";
import { trailToText } from "@/lib/export";
import { exportTrailPng } from "@/lib/export-image";
import { saveTrail, persistSeen, renameTrail, setTrailLiked } from "@/lib/storage";
import { TrailMap } from "@/components/TrailMap";
import { TrailStory, hasStory } from "@/components/TrailStory";
import { TrailEndings } from "@/components/TrailEndings";
import { DoorsLeft } from "@/components/DoorsLeft";
import { UnopenedPage } from "@/components/UnopenedPage";
import { useTour } from "@/components/tour/TourProvider";
import type { SessionTrail } from "./useDriftSession";

// "End & view trail" → the trail map. The reward for stopping (§2.3): your journey
// drawn as a meandering spine, with an editable name, stats, save / like, PNG
// export and copy-as-text.
export function EndOverlay({
  history,
  realm,
  existing,
  onSaved,
  onOpenDoor,
  onClose,
  reason = "user",
}: {
  history: TrailStep[];
  realm: RealmId;
  existing: SessionTrail | null;
  onSaved: (t: SessionTrail) => void;
  /** Walk one of the doors this trail left open: the session carries on, on a
   *  branch off the stop that offered it (Phase 29). */
  onOpenDoor: (door: OpenDoor) => void;
  onClose: () => void;
  /** Why the session ended. "limit" is the day's allowance running out, which
   *  changes the wording and takes the doors away — a door would carry on
   *  reading, and there is no more reading today. */
  reason?: "user" | "limit";
}) {
  const { signal: tourSignal } = useTour();
  const stats = computeTrailStats(history);
  const statLine = [
    `${stats.stops} ${stats.stops === 1 ? "stop" : "stops"}`,
    formatDuration(stats.durationMs),
    `${stats.threadsPulled} ${stats.threadsPulled === 1 ? "thread" : "threads"} pulled`,
  ].join(" · ");

  const [name, setName] = useState(existing?.name ?? autoTrailName(history));
  const [liked, setLiked] = useState(existing?.liked ?? false);
  // The persisted trail once saved — kept in sync so post-save rename/like edits
  // can't be clobbered by a later re-save in the same session.
  const [saved, setSaved] = useState<SessionTrail | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  async function handleExport() {
    if (!mapRef.current) return;
    const fname = (name.trim() || "drift-trail").slice(0, 48);
    try {
      await exportTrailPng(mapRef.current, `${fname}.png`);
    } catch {
      /* export failed — non-fatal, never crashes the app */
    }
  }

  async function handleCopy() {
    const text = trailToText({
      id: saved?.id ?? "trail",
      name: name.trim() || autoTrailName(history),
      steps: history,
      createdAt: existing?.createdAt ?? saved?.createdAt ?? 0,
      liked,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — non-fatal */
    }
  }

  async function handleSave() {
    setBusy(true);
    const t: SessionTrail = {
      id: saved?.id ?? existing?.id ?? crypto.randomUUID(),
      name: name.trim() || autoTrailName(history),
      liked,
      // Preserve the original creation date when updating an existing trail.
      createdAt: existing?.createdAt ?? saved?.createdAt ?? Date.now(),
    };
    try {
      await saveTrail({ ...t, steps: history, realm });
      persistSeen(history.map((s) => cardId(s.card)));
      setName(t.name);
      setSaved(t);
      onSaved(t);
      tourSignal("saved"); // the tour's forced "Save" step advances on this
    } finally {
      setBusy(false);
    }
  }

  function commitRename() {
    const finalName = name.trim() || autoTrailName(history);
    setName(finalName);
    if (saved) {
      const t = { ...saved, name: finalName };
      setSaved(t);
      onSaved(t);
      renameTrail(t.id, finalName);
    }
  }

  function toggleLike() {
    const next = !liked;
    setLiked(next);
    if (saved) {
      const t = { ...saved, liked: next };
      setSaved(t);
      onSaved(t);
      setTrailLiked(t.id, next);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        // A trail that forked needs a second lane's worth of canvas, and the
        // exit screen is where the fork was just made: hiding it behind a
        // sideways scroll would put the one new thing off the edge of the
        // reward. Narrow screens still scroll — two lanes and their titles do
        // not fit on a phone at any spacing — but they no longer have to.
        className={`flex max-h-[88vh] w-full flex-col rounded-2xl bg-paper-raised shadow-xl ring-1 ring-line ${
          hasBranches(history) ? "max-w-4xl" : "max-w-xl"
        }`}
      >
        <div className="shrink-0 border-b border-line px-6 pb-4 pt-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
            {reason === "limit" ? "That is a day\u2019s wandering" : "Your trail"}
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            aria-label="Trail name"
            maxLength={80}
            className="mt-1 w-full rounded-lg bg-transparent text-center font-serif text-2xl leading-tight text-ink transition focus:bg-paper focus-ring sm:text-3xl"
          />
          <p className="mt-1.5 text-sm text-ink-soft">{statLine}</p>
          {reason === "limit" && (
            <>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink/75">
                Today&rsquo;s reading is done. Here is where it went. The feed
                opens again tomorrow.
              </p>
              {/* Same wording rule as components/DayDone.tsx: the reason to pay
                  is that the project costs money, and the lifted limit is named
                  second as a consequence. Never "pay to keep reading". */}
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-ink-soft">
                Drift carries no advertising.{" "}
                <Link
                  href="/supporter"
                  className="focus-ring rounded underline decoration-line underline-offset-2 transition hover:text-accent-strong"
                >
                  Supporting it
                </Link>{" "}
                keeps it running, and lifts this daily limit.
              </p>
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <TrailMap steps={history} mapRef={mapRef} />
          {/* What the map draws, said out loud: a branched trail did not end
              once. Renders nothing at all on a straight trail. */}
          <div className="mt-4 empty:mt-0">
            <TrailEndings steps={history} />
          </div>
          {hasStory(history) && (
            <div className="mt-6 border-t border-line pt-5">
              <TrailStory steps={history} />
            </div>
          )}
          <div className="mt-6 space-y-6 border-t border-line pt-5 empty:mt-0 empty:border-0 empty:pt-0">
            {reason !== "limit" && (
              <DoorsLeft steps={history} onOpen={onOpenDoor} />
            )}
            <UnopenedPage steps={history} />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-5 border-t border-line px-6 py-2.5 text-sm">
          <button
            type="button"
            onClick={handleExport}
            className="text-ink-soft transition hover:text-accent-strong"
          >
            Export image
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="text-ink-soft transition hover:text-accent-strong"
          >
            {copied ? "Copied ✓" : "Copy as text"}
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line bg-paper-raised px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            {/* "Keep drifting" would be a lie once the day is spent: the button
                still works (you can page back over what you read) but it cannot
                do what it says. A control that promises something the feed is
                not going to do is a bug here, not a wording quibble (§2). */}
            {reason === "limit" ? "Look back over today" : "Keep drifting"}
          </button>

          {saved ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleLike}
                aria-label={liked ? "Unlike trail" : "Like trail"}
                aria-pressed={liked}
                className="flex h-9 w-9 items-center justify-center rounded-full focus-ring border border-line-strong text-accent-strong transition hover:border-accent/50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
                </svg>
              </button>
              <Link
                href={`/trails/${saved.id}`}
                data-tour="view-trail"
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
              >
                View in My Trails →
              </Link>
            </div>
          ) : (
            <button
              type="button"
              data-tour="save-trail"
              onClick={handleSave}
              disabled={busy || history.length === 0}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save trail"}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
