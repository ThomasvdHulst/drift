"use client";

import { useEffect, useState } from "react";
import {
  createPublicShare,
  revokePublicShare,
} from "@/lib/publicshare/client";
import {
  shareMessage,
  shareTitleOf,
  shareUrl,
  type PublicShare,
  type PublicShareKind,
} from "@/lib/publicshare/link";

// ---------------------------------------------------------------------------
// "Share a link" (Phase 27): make a card or a trail readable by someone who
// does not have a Drift account, usually by sending it in a chat.
//
// WHAT THIS IS NOT. It is not a growth loop. There is no view count, no "3
// people opened your trail", no notification when the link is used, and no
// prompt anywhere asking the reader to share. Those are the mechanics Drift
// exists to be the opposite of (CLAUDE.md §2), and they are the easiest thing to
// drift into when a feature's stated purpose is "let people spread it". The
// reader shares because they want to show someone a thing, and then nothing
// happens to them for having done it.
//
// It also sits at the END of a session, on the trail map, which is where the
// reward already lives (principle 3). It is not on every card as a nag.
//
// HONESTY ABOUT WHAT THE LINK IS. Anyone holding it can read the thing, and can
// forward it. The panel says so in those words, before the link is made, and
// "Stop sharing" is offered in the same breath as the link itself rather than
// buried in a settings page.
// ---------------------------------------------------------------------------

const BTN =
  "rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong";

export function ShareLink({
  kind,
  payload,
  className,
}: {
  kind: PublicShareKind;
  /** The snapshot to publish: `trailToSharePayload(trail)` or the card itself. */
  payload: PublicShare["payload"];
  className?: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoked, setRevoked] = useState(false);
  // Whether the OS share sheet exists. Resolved in an effect rather than read
  // during render: this is a client component, so it still server-renders, and
  // branching on a browser-only API inline would make the server and client
  // trees disagree. `"share" in navigator` rather than `navigator.share`,
  // because the DOM types declare the method as always present and only the
  // runtime knows the truth.
  const [canShareSheet, setCanShareSheet] = useState(false);
  useEffect(() => {
    const has = typeof navigator !== "undefined" && "share" in navigator;
    // Deferred off the effect body (React 19 forbids a synchronous setState
    // there), the same pattern ConsentProvider uses.
    queueMicrotask(() => setCanShareSheet(has));
  }, []);

  const share: PublicShare = { kind, payload, createdAt: Date.now() };
  const url = token ? shareUrl(token) : "";

  async function handleCreate() {
    setBusy(true);
    setError(null);
    const res = await createPublicShare(kind, payload);
    setBusy(false);
    if (!res.token) {
      setError(res.error);
      return;
    }
    setToken(res.token);
    // Try the OS share sheet straight away, which is what someone pressing this
    // on a phone expects. It can legitimately fail: the browser may not have it,
    // or may have decided the awaited insert above cost us the transient
    // activation it requires. Either way the panel below is already showing the
    // link, so a failure is a fallback rather than an error.
    await offerShareSheet(shareUrl(res.token));
  }

  async function offerShareSheet(target: string) {
    if (typeof navigator === "undefined" || !("share" in navigator)) return;
    try {
      await navigator.share({
        title: shareTitleOf(share),
        text: shareMessage(share),
        url: target,
      });
    } catch {
      /* dismissed, unsupported, or activation lost: the panel still has the link */
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the link is on screen and selectable */
    }
  }

  async function handleRevoke() {
    if (!token) return;
    setBusy(true);
    const ok = await revokePublicShare(token);
    setBusy(false);
    if (ok) setRevoked(true);
    else setError("Could not stop the link. Try again.");
  }

  if (!token) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy}
          className={`${BTN} disabled:opacity-60`}
        >
          {busy ? "Making a link…" : "Share a link"}
        </button>
        {error && (
          <p role="status" className="mt-2 text-sm text-ink/75">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${className ?? ""} w-full rounded-2xl border border-line bg-paper-raised p-4`}
    >
      {revoked ? (
        <p className="text-sm leading-relaxed text-ink/75">
          That link no longer works. Anyone who opens it now sees nothing, the
          same as an address that was never real.
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-ink/75">
            Anyone with this link can read{" "}
            {kind === "trail" ? "this trail" : "this card"}, and can pass it on.
            It stays live until you stop it.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="share-link-url">
              Link to share
            </label>
            <input
              id="share-link-url"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus-ring"
            />
            <button type="button" onClick={handleCopy} className={BTN}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
            {canShareSheet && (
              <button
                type="button"
                onClick={() => offerShareSheet(url)}
                className={BTN}
              >
                Send
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={busy}
            className="mt-3 text-sm text-ink-soft underline-offset-2 transition hover:text-accent-strong hover:underline disabled:opacity-60"
          >
            Stop sharing
          </button>
        </>
      )}
      {error && (
        <p role="status" className="mt-2 text-sm text-ink/75">
          {error}
        </p>
      )}
    </div>
  );
}
