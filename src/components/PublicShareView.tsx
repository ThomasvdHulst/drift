"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { CardView } from "@/components/CardView";
import { TrailMap } from "@/components/TrailMap";
import { LicenseLink } from "@/components/LicenseLink";
import { cardId } from "@/lib/card";
import { realmOfSource } from "@/lib/crossrealm";
import { selectDiverseThreads, selectFacetThreads } from "@/lib/diversity";
import { classifyThreads } from "@/lib/threads";
import { licenseFor, MODIFICATION_CARD, sourceName } from "@/lib/licenses";
import {
  TRIAL_CARD_LIMIT,
  TRIAL_KEY,
  shareTitleOf,
  type PublicShare,
} from "@/lib/publicshare/link";
import { getRealm, relatedUrl } from "@/lib/realms";
import type { RealmId } from "@/lib/realms/types";
import { sharePayloadToLocalTrail, type TrailSnapshot } from "@/lib/social/share";
import { saveTrail } from "@/lib/storage";
import { candidateToCard } from "@/lib/wiki";
import type { ArrivedVia, Card, Thread } from "@/lib/types";

// ---------------------------------------------------------------------------
// The interactive half of /s/<token>.
//
// The READ is unconditional: whatever was shared renders in full, for everyone,
// with no gate. Someone was sent a thing and they get the thing. What differs is
// only what comes AFTER it:
//
//   signed in  → save it, or drift onward from it
//   signed out → three cards to try, then an invitation
//
// WHY THREE, AND WHY SAID FIRST. The number is on screen before the first thread
// is pulled, never after. A limit you know about is a boundary; a limit that
// appears once you are invested is the pattern this whole app is a reaction to
// (CLAUDE.md §2). It is also not a security boundary and does not pretend to be:
// it lives in sessionStorage and anyone who wants to reset it can.
//
// ATTRIBUTION COMES FOR FREE, WHICH IS WHY CardView IS REUSED RATHER THAN
// REBUILT. Every card rendered here carries its per-image creator and licence,
// the fail-closed rule that hides an image we cannot credit, the source link and
// the modification indication. A lighter "public" card component would have been
// a second place for all of that to be forgotten, which is exactly what the
// compliance audit found in the friend inbox (Q-7).
// ---------------------------------------------------------------------------

export function PublicShareView({ share }: { share: PublicShare }) {
  const { user, loading } = useAuth();

  const isTrail = share.kind === "trail";
  const snapshot = isTrail ? (share.payload as TrailSnapshot) : null;
  const sharedCard = isTrail ? null : (share.payload as Card);

  // The card a trial drifts onward FROM: the last stop of a trail (where the
  // sender left off), or the shared card itself.
  const originCard =
    sharedCard ?? snapshot?.steps[snapshot.steps.length - 1]?.card ?? null;
  const realm: RealmId =
    snapshot?.realm ?? realmOfSource(originCard?.source) ?? "encyclopedia";

  return (
    <div data-realm={realm} className="mt-6">
      <h1 className="text-center font-serif text-3xl leading-tight text-ink sm:text-4xl">
        {shareTitleOf(share)}
      </h1>

      {isTrail && snapshot ? (
        <TrailReadView snapshot={snapshot} />
      ) : (
        sharedCard && <CardReadView card={sharedCard} realm={realm} />
      )}

      {/* `loading` is the session resolving. Rendering neither branch until it
          settles avoids showing a signed-in reader an invitation to sign up. */}
      {!loading &&
        (user ? (
          <SignedInActions share={share} realm={realm} originCard={originCard} />
        ) : (
          <Trial origin={originCard} realm={realm} />
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The read
// ---------------------------------------------------------------------------

function TrailReadView({ snapshot }: { snapshot: TrailSnapshot }) {
  const steps = snapshot.steps;
  return (
    <>
      <p className="mt-2 text-center text-sm text-ink-soft">
        {steps.length} {steps.length === 1 ? "stop" : "stops"}
      </p>
      {/* TrailMap already renders the licence notice beneath the map, because
          displaying a trail is itself a Share and the notice belongs wherever
          the extracts are seen. Nothing extra is needed here. */}
      <div className="mt-6 rounded-2xl bg-paper-raised p-4 shadow-sm ring-1 ring-line">
        <TrailMap steps={steps} />
      </div>

      <ol className="mt-6 space-y-3">
        {steps.map((step, i) => (
          <li
            key={`${cardId(step.card)}-${i}`}
            className="rounded-2xl border border-line bg-paper-raised p-4"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
              Stop {i + 1}
            </p>
            <h2 className="mt-1 font-serif text-xl leading-snug text-ink">
              {step.card.displayTitle}
            </h2>
            {step.card.description && (
              <p className="mt-0.5 text-sm text-ink-soft">
                {step.card.description}
              </p>
            )}
            {step.card.extract && (
              <p className="mt-2 text-sm leading-relaxed text-ink/75">
                {step.card.extract}
              </p>
            )}
            <SourceCredit card={step.card} />
          </li>
        ))}
      </ol>
    </>
  );
}

function CardReadView({ card, realm }: { card: Card; realm: RealmId }) {
  return (
    // CardView fills its parent, so it needs a parent with a real height. Tall
    // enough to read on a phone without becoming a full-screen takeover of a
    // page the reader arrived at from a chat message.
    <div className="mt-6 h-[70vh] min-h-[460px] w-full">
      <CardView
        card={card}
        realm={realm}
        arrivedVia={{ type: "seed", seedName: card.displayTitle }}
        threads={[]}
        threadsLoading={false}
        onThread={() => {}}
      />
    </div>
  );
}

/** The per-card credit on a trail's stop list. The map carries the licence for
 *  the trail as a whole; this carries the link that identifies each article's
 *  authors (their history page) and says the text was altered, which CC BY-SA
 *  4.0 §3(a)(1)(B) makes a separate requirement from naming the licence. */
function SourceCredit({ card }: { card: Card }) {
  const license = licenseFor(card.source);
  return (
    <p className="mt-2 text-xs text-ink-soft">
      <a
        href={card.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-ink/30 underline-offset-2 transition hover:text-accent-strong"
      >
        {sourceName(card.source)} ↗
      </a>
      {license && (
        <>
          {" · "}
          <LicenseLink license={license} />
          {" · "}
          {MODIFICATION_CARD}
        </>
      )}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Signed in
// ---------------------------------------------------------------------------

function SignedInActions({
  share,
  realm,
  originCard,
}: {
  share: PublicShare;
  realm: RealmId;
  originCard: Card | null;
}) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      if (share.kind === "trail") {
        // A COPY, with a new id: the reader owns their copy, and the sender's
        // trail is untouched by anything they do to it. Same helper the friend
        // inbox uses.
        await saveTrail(
          sharePayloadToLocalTrail(
            share.payload as TrailSnapshot,
            crypto.randomUUID(),
            Date.now(),
          ),
        );
      } else {
        const card = share.payload as Card;
        await saveTrail({
          id: crypto.randomUUID(),
          name: card.displayTitle,
          steps: [
            {
              card,
              arrivedVia: { type: "seed", seedName: card.displayTitle },
              timestamp: Date.now(),
              expanded: false,
            },
          ],
          createdAt: Date.now(),
          liked: false,
          realm,
        });
      }
      setSaved(true);
    } catch {
      /* storage failure: the read above is unaffected */
    }
    setBusy(false);
  }

  return (
    <section className="mt-8 rounded-2xl border border-line bg-paper-raised p-5">
      <h2 className="font-serif text-xl text-ink">It is yours to follow</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Save a copy to your own trails, or pick the thread up where it was left
        and see where you take it.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || saved}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong disabled:opacity-60 focus-ring"
        >
          {saved ? "Saved to your trails ✓" : busy ? "Saving…" : "Save a copy"}
        </button>
        {originCard && (
          <Link
            href={`/drift?realm=${realm}&seed=${encodeURIComponent(originCard.pageTitle)}`}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong focus-ring"
          >
            Drift on from here →
          </Link>
        )}
      </div>
      {saved && (
        <p className="mt-3 text-sm text-ink-soft">
          <Link
            href="/trails"
            className="text-accent-strong underline-offset-2 hover:underline"
          >
            Open it in My Trails
          </Link>
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Signed out: three cards
// ---------------------------------------------------------------------------

function Trial({ origin, realm }: { origin: Card | null; realm: RealmId }) {
  const [used, setUsed] = useState<number | null>(null); // null = not read yet
  // The card AND how it was reached. `arrivedVia` is not decoration: principle 1
  // is that a reader always sees why the next card appeared, and the card
  // renders that line from here. A trial card with no provenance would be the
  // one place in Drift where something arrived unexplained.
  const [step, setStep] = useState<{ card: Card; via: ArrivedVia } | null>(null);
  const card = step?.card ?? null;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [seen] = useState(() => new Set<string>());

  // Restore the count first, so a reader who already used their three does not
  // see "3 cards to try" and then have it snatched away on the first tap.
  useEffect(() => {
    let n = 0;
    try {
      n = Number(sessionStorage.getItem(TRIAL_KEY)) || 0;
    } catch {
      /* storage blocked: they get a fresh three, which is the kind direction */
    }
    queueMicrotask(() => setUsed(Math.min(n, TRIAL_CARD_LIMIT)));
  }, []);

  // Threads for whatever is currently on screen: the shared item at first, then
  // each trial card.
  //
  // The fetch is inline rather than in a useCallback so the AbortController can
  // own it: pulling a thread swaps the card, and a slow response for the
  // previous one must not land on the new one. Same shape the feed uses.
  //
  // Every setState is deferred out of the effect BODY (React 19 forbids a
  // synchronous one there), which is why the loading flag goes through
  // queueMicrotask rather than being set on the first line.
  useEffect(() => {
    const from = card ?? origin;
    if (!from || used === null || used >= TRIAL_CARD_LIMIT) return;

    const controller = new AbortController();
    let live = true;
    queueMicrotask(() => {
      if (live) setThreadsLoading(true);
    });

    (async () => {
      let chosen: Thread[] = [];
      try {
        const res = await fetch(relatedUrl(realm, from.pageTitle), {
          signal: controller.signal,
        });
        const cands = await res.json();
        if (Array.isArray(cands)) {
          const meta = getRealm(realm);
          chosen =
            meta.threadMode === "facet"
              ? selectFacetThreads(cands, { count: 3, seen })
              : classifyThreads(from, cands, { count: 3, seen });
          if (!chosen.length) {
            chosen = selectDiverseThreads(cands, { count: 3, seen });
          }
        }
      } catch {
        // The whole app's contract: a failed fetch costs you threads, never the
        // page you are on (CLAUDE.md §4).
      }
      if (!live) return;
      setThreads(chosen);
      setThreadsLoading(false);
    })();

    return () => {
      live = false;
      controller.abort();
    };
  }, [card, origin, used, realm, seen]);

  function pull(thread: Thread) {
    const from = card ?? origin;
    const next = candidateToCard(thread.candidate);
    seen.add(cardId(next));
    const n = Math.min((used ?? 0) + 1, TRIAL_CARD_LIMIT);
    setUsed(n);
    try {
      sessionStorage.setItem(TRIAL_KEY, String(n));
    } catch {
      /* not a security boundary; a courtesy counter */
    }
    setStep({
      card: next,
      via: {
        type: "thread",
        label: thread.label,
        fromTitle: from?.displayTitle ?? "",
        kind: thread.kind,
      },
    });
    setThreads([]);
  }

  if (used === null) return null;

  const left = TRIAL_CARD_LIMIT - used;
  const spent = left <= 0;

  return (
    <section className="mt-8">
      <div className="rounded-2xl border border-line bg-paper-raised p-5">
        <h2 className="font-serif text-xl text-ink">
          {spent ? "That is the taste of it" : "Want to keep going?"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          {spent ? (
            <>
              Drift is a feed you steer yourself. No algorithm decides what comes
              next, you do, by pulling a thread. It keeps the trail you make, so
              a session has an ending worth reaching. That part needs an account,
              which is free and takes a moment.
            </>
          ) : (
            <>
              Every card shows a few threads you can pull. You have{" "}
              <strong className="font-semibold text-ink">
                {left} {left === 1 ? "card" : "cards"}
              </strong>{" "}
              to try here, then Drift needs an account to keep the trail you are
              making. No ads, nothing to pay.
            </>
          )}
        </p>
        {spent && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong focus-ring"
              >
                Create an account
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong focus-ring"
              >
                How it works
              </Link>
            </div>
            {/* Phrased as what Drift can do, NOT as "open this link in the app".
                On iOS a home-screen web app cannot be handed a link at all, so
                an "open in Drift" button would be a button that does nothing for
                half the people who see it. */}
            <p className="mt-3 text-sm text-ink-soft">
              Drift also{" "}
              <Link
                href="/install"
                className="text-accent-strong underline-offset-2 hover:underline"
              >
                installs to your home screen
              </Link>{" "}
              and reads like an app.
            </p>
          </>
        )}
      </div>

      {/* The trial card, rendered by the SAME component the feed uses, so its
          credits and licence notices are the real ones. */}
      {step && (
        <div className="mt-6 h-[70vh] min-h-[460px] w-full">
          <CardView
            card={step.card}
            realm={realm}
            arrivedVia={step.via}
            threads={spent ? [] : threads}
            threadsLoading={spent ? false : threadsLoading}
            onThread={pull}
          />
        </div>
      )}

      {/* Before the first pull the threads hang off the shared item above, so
          they need their own row here rather than living inside a card. */}
      {!card && !spent && (
        <ThreadOffer
          threads={threads}
          loading={threadsLoading}
          onPull={pull}
        />
      )}
    </section>
  );
}

function ThreadOffer({
  threads,
  loading,
  onPull,
}: {
  threads: Thread[];
  loading: boolean;
  onPull: (t: Thread) => void;
}) {
  if (loading) {
    return (
      <p className="mt-4 text-center text-sm text-ink-soft">
        Finding some threads…
      </p>
    );
  }
  if (!threads.length) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-widest text-ink-soft">
        Pull a thread
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {threads.map((t) => (
          <button
            key={cardId(t.candidate)}
            type="button"
            onClick={() => onPull(t)}
            className="rounded-full border border-line-strong bg-paper px-4 py-2 text-sm text-ink transition hover:border-accent/60 hover:text-accent-strong focus-ring"
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
