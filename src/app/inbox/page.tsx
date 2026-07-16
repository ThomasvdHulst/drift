"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  listInbox,
  markShareRead,
  deleteShare,
  type InboxShare,
} from "@/lib/social/client";
import {
  sharePayloadToLocalTrail,
  type TrailSnapshot,
} from "@/lib/social/share";
import { saveTrail } from "@/lib/storage";
import { getRealm } from "@/lib/realms";
import { TrailSparkline } from "@/components/TrailSparkline";
import type { Card, Trail, TrailStep } from "@/lib/types";

// The inbox (Phase 10). A finite, newest-first list of what friends sent you —
// deliberately NOT a feed (that's Phase 11). Continue a trail, add it, or open a
// card. Quiet: no counts-as-targets, no infinite scroll.

// Module scope: the impure id/timestamp for a recipient-owned copy. Kept out of
// the component body so React's render-purity lint doesn't flag it (it only runs
// from event handlers).
function importSnapshot(snap: TrailSnapshot): Trail {
  return sharePayloadToLocalTrail(snap, crypto.randomUUID(), Date.now());
}

export default function InboxPage() {
  const router = useRouter();
  const { user, loading, cloudConfigured } = useAuth();
  const [shares, setShares] = useState<InboxShare[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const list = await listInbox();
      if (cancelled) return;
      setShares(list);
      // Opening the inbox = reading it: clear the quiet unread indicator.
      for (const s of list) if (!s.read) markShareRead(s.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <Shell><p className="text-sm text-ink-soft">One moment…</p></Shell>;
  if (!cloudConfigured || !user) {
    return (
      <Shell>
        <div className="rounded-2xl border border-line bg-paper-raised p-6">
          <p className="text-sm leading-relaxed text-ink">
            Your inbox needs an account —{" "}
            <Link href="/account" className="text-accent-strong hover:underline">
              sign in
            </Link>{" "}
            to receive trails from friends.
          </p>
        </div>
      </Shell>
    );
  }

  async function continueTrail(share: InboxShare) {
    const local = importSnapshot(share.payload as TrailSnapshot);
    await saveTrail(local);
    router.push(`/drift?continue=${local.id}`);
  }

  async function addTrail(share: InboxShare, done: () => void) {
    const local = importSnapshot(share.payload as TrailSnapshot);
    await saveTrail(local);
    done();
  }

  async function remove(id: string) {
    await deleteShare(id);
    setShares((s) => (s ? s.filter((x) => x.id !== id) : s));
  }

  return (
    <Shell>
      {shares === null ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : shares.length === 0 ? (
        <div className="rounded-2xl border border-line bg-paper-raised p-6">
          <p className="text-sm leading-relaxed text-ink-soft">
            Nothing here yet. When a friend sends you a trail or a card, it lands
            here.{" "}
            <Link href="/friends" className="text-accent-strong hover:underline">
              Find friends →
            </Link>
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {shares.map((s) =>
            s.kind === "trail" ? (
              <TrailShareCard
                key={s.id}
                share={s}
                onContinue={() => continueTrail(s)}
                onAdd={(done) => addTrail(s, done)}
                onDelete={() => remove(s.id)}
              />
            ) : (
              <CardShareCard key={s.id} share={s} onDelete={() => remove(s.id)} />
            ),
          )}
        </ul>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-10">
      <header className="mb-6">
        <Link href="/" className="text-sm text-ink-soft transition hover:text-accent-strong">
          ← Home
        </Link>
        <h1 className="mt-3 font-serif text-4xl text-ink">Inbox</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Trails and cards friends sent your way.{" "}
          <Link href="/friends" className="text-accent-strong hover:underline">
            Friends →
          </Link>
        </p>
      </header>
      <div>{children}</div>
    </main>
  );
}

function From({ share }: { share: InboxShare }) {
  const who = share.sender?.handle ?? "a friend";
  return (
    <div className="flex items-center gap-2">
      {!share.read && (
        <span className="inline-block h-2 w-2 rounded-full bg-accent" aria-label="new" />
      )}
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        From @{who}
      </p>
    </div>
  );
}

function TrailShareCard({
  share,
  onContinue,
  onAdd,
  onDelete,
}: {
  share: InboxShare;
  onContinue: () => void;
  onAdd: (done: () => void) => void;
  onDelete: () => void;
}) {
  const snap = share.payload as TrailSnapshot;
  const steps = (snap.steps ?? []) as TrailStep[];
  const realm = getRealm(snap.realm);
  const [added, setAdded] = useState(false);

  return (
    <li
      data-realm={realm.id}
      className="rounded-2xl border border-line bg-paper-raised p-5"
    >
      <From share={share} />
      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-serif text-xl leading-tight text-ink">
            {snap.name || "Shared trail"}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {steps.length} {steps.length === 1 ? "stop" : "stops"} · {realm.label}
          </p>
        </div>
      </div>
      {steps.length > 0 && (
        <div className="mt-3">
          <TrailSparkline steps={steps} className="h-11 w-full" />
        </div>
      )}
      {share.note && (
        <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm italic text-ink">
          “{share.note}”
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
        >
          Continue this trail →
        </button>
        <button
          type="button"
          disabled={added}
          onClick={() => onAdd(() => setAdded(true))}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50 disabled:opacity-60"
        >
          {added ? "Added ✓" : "Add to my trails"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto text-sm text-ink-soft transition hover:text-ink"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function CardShareCard({
  share,
  onDelete,
}: {
  share: InboxShare;
  onDelete: () => void;
}) {
  const card = share.payload as Card;
  const realm = getRealm(card.source === "artic" ? "gallery" : "encyclopedia");
  return (
    <li
      data-realm={realm.id}
      className="rounded-2xl border border-line bg-paper-raised p-5"
    >
      <From share={share} />
      <div className="mt-2 flex gap-4">
        {card.imageUrl && (
          <img
            src={card.imageUrl}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="font-serif text-lg leading-tight text-ink">
            {card.displayTitle}
          </p>
          {card.description && (
            <p className="mt-0.5 text-xs uppercase tracking-wide text-ink-soft">
              {card.description}
            </p>
          )}
          {card.extract && (
            <p className="mt-1 line-clamp-3 text-sm text-ink/80">{card.extract}</p>
          )}
        </div>
      </div>
      {share.note && (
        <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm italic text-ink">
          “{share.note}”
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {card.source !== "artic" && (
          <Link
            href={`/drift?realm=encyclopedia&title=${encodeURIComponent(card.pageTitle)}`}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
          >
            Drift from here →
          </Link>
        )}
        {card.sourceUrl && (
          <a
            href={card.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-accent-strong hover:underline"
          >
            View source ↗
          </a>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto text-sm text-ink-soft transition hover:text-ink"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
