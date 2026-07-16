"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listFriendData,
  sendShare,
  type Profile,
  type ShareKind,
} from "@/lib/social/client";
import { partition, otherPartyId } from "@/lib/social/friends";

// A quiet modal to send a trail or card to a friend (Phase 10). Deliberate:
// pick a friend, add an optional note, send — no one-tap virality (§2).

interface Friend {
  requestId: string;
  profile: Profile;
}

export function ShareToFriend({
  kind,
  payload,
  label,
  onClose,
}: {
  kind: ShareKind;
  payload: unknown;
  label: string;
  onClose: () => void;
}) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await listFriendData();
      if (cancelled) return;
      const { friends: fr } = partition(data.requests, data.meId ?? "");
      const list = fr
        .map((r) => {
          const id = otherPartyId(r, data.meId ?? "");
          const profile = data.profiles[id];
          return profile ? { requestId: r.id, profile } : null;
        })
        .filter((f): f is Friend => f !== null);
      setFriends(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function send() {
    if (!pickedId) return;
    setError(null);
    setBusy(true);
    const res = await sendShare(pickedId, kind, payload, note);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const who = friends?.find((f) => f.profile.id === pickedId)?.profile.handle;
    setSentTo(who ?? "your friend");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-paper-raised p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sentTo ? (
          <div className="text-center">
            <p className="font-serif text-2xl text-ink">Sent to @{sentTo}</p>
            <p className="mt-2 text-sm text-ink-soft">
              It&apos;s waiting in their inbox.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-serif text-xl text-ink">Send to a friend</h2>
                <p className="mt-0.5 truncate text-sm text-ink-soft">{label}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 text-ink-soft transition hover:text-ink"
              >
                ✕
              </button>
            </div>

            {friends === null ? (
              <p className="mt-5 text-sm text-ink-soft">Loading friends…</p>
            ) : friends.length === 0 ? (
              <p className="mt-5 text-sm leading-relaxed text-ink">
                You have no friends to send to yet.{" "}
                <Link
                  href="/friends"
                  className="text-accent-strong hover:underline"
                >
                  Add a friend →
                </Link>
              </p>
            ) : (
              <>
                <p className="mt-5 text-xs font-medium uppercase tracking-wide text-ink-soft">
                  To
                </p>
                <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                  {friends.map((f) => (
                    <li key={f.profile.id}>
                      <button
                        type="button"
                        onClick={() => setPickedId(f.profile.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          pickedId === f.profile.id
                            ? "border-accent bg-accent/10 text-ink"
                            : "border-line text-ink hover:border-accent/40"
                        }`}
                      >
                        <span className="truncate">
                          @{f.profile.handle}
                          {f.profile.display_name && (
                            <span className="text-ink-soft">
                              {" "}
                              · {f.profile.display_name}
                            </span>
                          )}
                        </span>
                        {pickedId === f.profile.id && (
                          <span className="text-accent-strong">✓</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>

                <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink-soft">
                  Note (optional)
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={280}
                    placeholder="Say why you thought of them…"
                    className="mt-1 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </label>

                {error && (
                  <p className="mt-3 text-sm text-ink" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!pickedId || busy}
                  onClick={send}
                  className="mt-4 w-full rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
