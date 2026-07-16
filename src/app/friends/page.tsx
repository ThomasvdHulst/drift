"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  getMyProfile,
  listFriendData,
  searchByHandle,
  sendFriendRequest,
  respondToRequest,
  removeFriendship,
  type Profile,
  type FriendData,
} from "@/lib/social/client";
import {
  partition,
  deriveRelationship,
  otherPartyId,
} from "@/lib/social/friends";

// The friend graph (Phase 10). Search by handle → request → accept. Calm and
// bounded: no follower counts, no discovery feed, just people you choose to add.

export default function FriendsPage() {
  const { user, loading, cloudConfigured } = useAuth();

  const [hasHandle, setHasHandle] = useState<boolean | null>(null);
  const [data, setData] = useState<FriendData | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[] | null>(null);
  const [searching, setSearching] = useState(false);

  const refresh = useCallback(async () => {
    setData(await listFriendData());
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // Async IIFE: state is set only after awaits (never synchronously in the
    // effect body — React 19's set-state-in-effect rule).
    (async () => {
      const p = await getMyProfile();
      if (!cancelled) setHasHandle(Boolean(p?.handle));
      const d = await listFriendData();
      if (!cancelled) setData(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    setResults(await searchByHandle(q));
    setSearching(false);
  }

  async function act(fn: () => Promise<boolean>) {
    await fn();
    await refresh();
    if (results) setResults(await searchByHandle(query.trim()));
  }

  // --- gates ---
  if (loading) {
    return <Shell><p className="text-sm text-ink-soft">One moment…</p></Shell>;
  }
  if (!cloudConfigured || !user) {
    return (
      <Shell>
        <div className="rounded-2xl border border-line bg-paper-raised p-6">
          <p className="text-sm leading-relaxed text-ink">
            Friends need an account. Drift works fully on its own — but to add
            friends and share trails,{" "}
            <Link href="/account" className="text-accent-strong hover:underline">
              sign in
            </Link>
            .
          </p>
        </div>
      </Shell>
    );
  }
  if (hasHandle === false) {
    return (
      <Shell>
        <div className="rounded-2xl border border-line bg-paper-raised p-6">
          <p className="text-sm leading-relaxed text-ink">
            Pick a handle first so friends can find you —{" "}
            <Link href="/account" className="text-accent-strong hover:underline">
              set your handle
            </Link>
            .
          </p>
        </div>
      </Shell>
    );
  }

  const meId = data?.meId ?? null;
  const requests = data?.requests ?? [];
  const profiles = data?.profiles ?? {};
  const { friends, incoming, outgoing } = partition(requests, meId ?? "");

  const nameFor = (id: string) => {
    const p = profiles[id];
    return p ? { handle: p.handle, name: p.display_name } : null;
  };

  return (
    <Shell>
      {/* Search */}
      <section className="rounded-2xl border border-line bg-paper-raised p-5">
        <h2 className="text-xs font-medium uppercase tracking-widest text-ink-soft">
          Add a friend
        </h2>
        <div className="mt-3 flex gap-2">
          <div className="flex flex-1 items-center rounded-full border border-line bg-paper px-3 focus-within:border-accent">
            <span className="text-ink-soft">@</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="their handle"
              autoComplete="off"
              className="w-full bg-transparent px-1 py-2 text-sm text-ink outline-none"
            />
          </div>
          <button
            type="button"
            onClick={runSearch}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
          >
            Search
          </button>
        </div>
        {searching && <p className="mt-3 text-sm text-ink-soft">Searching…</p>}
        {results && !searching && results.length === 0 && (
          <p className="mt-3 text-sm text-ink-soft">No one with that handle.</p>
        )}
        {results && results.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {results.map((p) => {
              const rel = meId ? deriveRelationship(requests, meId, p.id) : "none";
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <PersonLabel handle={p.handle} name={p.display_name} />
                  {rel === "friends" ? (
                    <span className="text-sm text-accent-strong">Friends ✓</span>
                  ) : rel === "outgoing" ? (
                    <span className="text-sm text-ink-soft">Requested</span>
                  ) : rel === "incoming" ? (
                    <button
                      type="button"
                      onClick={() => {
                        const r = incoming.find((x) => otherPartyId(x, meId!) === p.id);
                        if (r) act(() => respondToRequest(r.id, true));
                      }}
                      className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-paper-raised transition hover:bg-accent-strong"
                    >
                      Accept
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => act(() => sendFriendRequest(p.id))}
                      className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong"
                    >
                      Add
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <Group title="Requests to you">
          {incoming.map((r) => {
            const who = nameFor(otherPartyId(r, meId!));
            return (
              <Row key={r.id}>
                <PersonLabel handle={who?.handle ?? "someone"} name={who?.name ?? null} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(() => respondToRequest(r.id, true))}
                    className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-paper-raised transition hover:bg-accent-strong"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => act(() => respondToRequest(r.id, false))}
                    className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition hover:text-ink"
                  >
                    Decline
                  </button>
                </div>
              </Row>
            );
          })}
        </Group>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <Group title="Sent">
          {outgoing.map((r) => {
            const who = nameFor(otherPartyId(r, meId!));
            return (
              <Row key={r.id}>
                <PersonLabel handle={who?.handle ?? "someone"} name={who?.name ?? null} />
                <button
                  type="button"
                  onClick={() => act(() => removeFriendship(r.id))}
                  className="text-sm text-ink-soft transition hover:text-ink"
                >
                  Cancel
                </button>
              </Row>
            );
          })}
        </Group>
      )}

      {/* Friends */}
      <Group title={friends.length ? "Your friends" : "Your friends"}>
        {friends.length === 0 ? (
          <p className="py-2 text-sm text-ink-soft">
            No friends yet. Search a handle above to add someone.
          </p>
        ) : (
          friends.map((r) => {
            const who = nameFor(otherPartyId(r, meId!));
            return (
              <Row key={r.id}>
                <PersonLabel handle={who?.handle ?? "friend"} name={who?.name ?? null} />
                <button
                  type="button"
                  onClick={() => act(() => removeFriendship(r.id))}
                  className="text-sm text-ink-soft transition hover:text-ink"
                >
                  Remove
                </button>
              </Row>
            );
          })
        )}
      </Group>
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
        <h1 className="mt-3 font-serif text-4xl text-ink">Friends</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Add people by their handle, then share trails you loved.{" "}
          <Link href="/inbox" className="text-accent-strong hover:underline">
            Inbox →
          </Link>
        </p>
      </header>
      <div className="space-y-5">{children}</div>
    </main>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5">
      <h2 className="mb-1 text-xs font-medium uppercase tracking-widest text-ink-soft">
        {title}
      </h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-2.5">{children}</div>;
}

function PersonLabel({ handle, name }: { handle: string; name: string | null }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-ink">@{handle}</p>
      {name && <p className="truncate text-sm text-ink-soft">{name}</p>}
    </div>
  );
}
