"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTour } from "@/components/tour/TourProvider";
import { AuthForm } from "@/components/AuthForm";
import {
  getSyncStatus,
  onSyncStatus,
  type SyncStatus,
} from "@/lib/sync/replicator";
import { getMyProfile, upsertProfile, exportSocialData } from "@/lib/social/client";
import { listMyPublicShares } from "@/lib/publicshare/client";
import { normalizeHandle, handleError } from "@/lib/social/handles";
import { socialEnabled } from "@/lib/social/enabled";
import {
  listTrails,
  getReactions,
  getInterest,
  getSettings,
  loadSeen,
  listSessions,
} from "@/lib/storage";
import { buildDataExport, dataExportFilename } from "@/lib/export-data";
import { SupporterBuy } from "@/components/SupporterBuy";
import { refreshStatus, subscribeMeter } from "@/lib/billing/meter";
import { dailyLimit, type MeterState } from "@/lib/limits";
import { fetchMyEntitlement, requestWithdrawal } from "@/lib/billing/client";
import { assessWithdrawal, type EntitlementRow, type Withdrawability } from "@/lib/billing/withdrawal";
import { formatEur } from "@/lib/billing/price";

// The account screen (Phase 9, extended Phase 13). Calm, on-brand handle setup +
// sign-out when signed in, and the shared email+password AuthForm when signed
// out. When the cloud IS configured the app requires an account (see AuthGate),
// so this signed-out branch is mainly reached via a fresh session; when it isn't
// configured Drift runs fully local and this page says so gently.

export default function AccountPage() {
  const { user, loading, cloudConfigured, signOut } = useAuth();
  const { start: startTour } = useTour();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-6 py-12 sm:py-16">
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm text-ink-soft transition hover:text-accent-strong"
        >
          ← Home
        </Link>
        <h1 className="mt-4 font-serif text-4xl text-ink">Your account</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Sign in to use Drift and keep your trails, interests, and reactions
          private to your account, synced across devices. (With no cloud
          configured, Drift runs fully locally on this device instead.)
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-ink-soft">Checking your session…</p>
      ) : !cloudConfigured ? (
        <div className="rounded-2xl border border-line bg-paper-raised p-6">
          <p className="text-sm leading-relaxed text-ink">
            Cloud sync isn&apos;t set up on this device, so Drift is running
            fully locally. That&apos;s a perfectly good way to use it. Nothing
            is missing from the drifting itself.
          </p>
        </div>
      ) : user ? (
        <div className="space-y-4">
          <SignedIn email={user.email ?? "your account"} onSignOut={signOut} />
          <Suspense fallback={null}>
            <SupporterSection />
          </Suspense>
          <ChangePassword />
          {socialEnabled() && <ProfileSection />}
          <DownloadData user={user} />
          <DeleteAccount />
        </div>
      ) : (
        <AuthForm />
      )}

      <p className="mt-8 flex flex-wrap items-center justify-center gap-3 text-center text-xs text-ink-soft">
        <button
          type="button"
          onClick={startTour}
          className="transition hover:text-accent-strong"
        >
          Take the tour
        </button>
        <span aria-hidden="true">·</span>
        <Link href="/install" className="transition hover:text-accent-strong">
          Install on your phone
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/contact" className="transition hover:text-accent-strong">
          Contact us
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="transition hover:text-accent-strong">
          What Drift stores
        </Link>
      </p>
    </main>
  );
}

const SYNC_COPY: Record<SyncStatus, { dot: string; text: string }> = {
  idle: { dot: "bg-accent", text: "Synced" },
  syncing: { dot: "bg-accent/60", text: "Syncing…" },
  offline: {
    dot: "bg-ink-soft/50",
    text: "Offline. Saved here, and it will sync when you are back.",
  },
  disabled: { dot: "bg-ink-soft/40", text: "Not syncing yet." },
};

function SyncStatusLine() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => onSyncStatus(setStatus), []);
  const s = SYNC_COPY[status];
  return (
    <p className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
      <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.text}
    </p>
  );
}

// Handle + display name — how friends find you (Phase 10). A handle is required
// to be findable; setting one is what makes the social features usable.
function ProfileSection() {
  const [loaded, setLoaded] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [hasHandle, setHasHandle] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMyProfile().then((p) => {
      if (p) {
        setHandle(p.handle);
        setDisplayName(p.display_name ?? "");
        setHasHandle(true);
      }
      setLoaded(true);
    });
  }, []);

  async function save() {
    setError(null);
    const h = normalizeHandle(handle);
    const err = handleError(h);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    const res = await upsertProfile(h, displayName);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setHandle(h);
    setHasHandle(true);
    setEditing(false);
    setSaved(true);
  }

  if (!loaded) return null;

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        Your handle
      </p>
      {hasHandle && !editing ? (
        <div className="mt-1 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-serif text-xl text-ink">@{handle}</p>
            {displayName && (
              <p className="text-sm text-ink-soft">{displayName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setEditing(true); setSaved(false); }}
            className="shrink-0 rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Edit
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="mb-3 text-sm leading-relaxed text-ink-soft">
            Pick a handle so friends can find you. Lowercase letters, numbers, and
            underscores, 3 to 30 characters.
          </p>
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Handle
            <div className="mt-1 flex items-center rounded-lg border border-line-strong bg-paper px-3 focus-ring-within">
              <span className="text-ink-soft">@</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="your_handle"
                autoComplete="off"
                className="w-full bg-transparent px-1 py-2 text-sm text-ink outline-none"
              />
            </div>
          </label>
          <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Display name (optional)
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How your name shows up"
              maxLength={50}
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>
          {error && (
            <p className="mt-3 text-sm text-ink" role="alert">{error}</p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save handle"}
          </button>
        </div>
      )}
      {saved && !editing && (
        <p className="mt-3 text-sm text-accent-strong" role="status">Saved.</p>
      )}
      <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">
        <Link href="/friends" className="text-accent-strong hover:underline">
          Find &amp; add friends →
        </Link>
      </p>
    </div>
  );
}

// Set / change the account password (works for password accounts and adds one
// to an OAuth-only account). No current-password prompt — enable Supabase's
// "Secure password change" (reauth) later if you want that extra step.
function ChangePassword() {
  const { updatePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setError(null);
    if (password.length < 6) return setError("Use at least 6 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) return setError(res.error);
    setPassword("");
    setConfirm("");
    setOpen(false);
    setSaved(true);
  }

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
          Password
        </p>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setSaved(false);
            }}
            className="shrink-0 rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-accent/50 hover:text-accent-strong"
          >
            Change password
          </button>
        )}
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-soft">
            New password
            <input
              type="password"
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Confirm new password
            <input
              type="password"
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>
          {error && (
            <p className="text-sm text-ink" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong disabled:opacity-60"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-ink transition hover:border-accent/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {saved && !open && (
        <p className="mt-3 text-sm text-accent-strong" role="status">
          Password updated.
        </p>
      )}
    </div>
  );
}

/**
 * "Download your data" (compliance audit Mi-3).
 *
 * GDPR Article 20 does not require a button, it requires requests to be
 * fulfilled within a month. The button is the cheaper end of that: it removes
 * the month, it removes a standing manual task, and it answers Article 15 access
 * requests at the same time. It sits ABOVE the delete flow on purpose, because
 * taking a copy is the thing you want to do first if you are about to delete.
 *
 * Local data is read from IndexedDB, which is the source of truth for a session
 * and a mirror of the cloud. The social rows are the exception: profiles,
 * friends and shares never sync locally, so `exportSocialData` fetches them.
 * Both halves degrade the same way the rest of the app does, so a backend that
 * is down produces an export missing a section rather than an error.
 */
function DownloadData({ user }: { user: { id: string; email?: string; created_at?: string } }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const [trails, reactions, interests, settings, seen, sessions, social, shareLinks] =
        await Promise.all([
          listTrails(),
          getReactions(),
          getInterest(),
          getSettings(),
          loadSeen(),
          listSessions(),
          socialEnabled() ? exportSocialData() : Promise.resolve(null),
          // NOT behind socialEnabled(): share links are not the friend layer and
          // are available whether or not that flag is set.
          listMyPublicShares(),
        ]);

      const file = buildDataExport({
        account: {
          id: user.id,
          ...(user.email ? { email: user.email } : {}),
          ...(user.created_at ? { createdAt: user.created_at } : {}),
        },
        trails,
        reactions,
        interests,
        settings,
        seen,
        sessions,
        ...(social
          ? {
              profile: social.profile,
              friends: social.friendRequests,
              shares: social.shares,
            }
          : {}),
        // Absent rather than empty when the backend is unreachable, so a reader
        // can tell "you made none" from "we could not look".
        ...(shareLinks.length ? { shareLinks } : {}),
      });

      // A Blob rather than a data: URL. A long trail list can run to megabytes,
      // and a data: URL that size is refused by some browsers.
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = dataExportFilename();
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError("Couldn't build the file just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        Your data
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Take a copy of everything Drift holds about you: your account, trails,
        reactions, interests, settings, and your handle, friends and shares if
        you have them. One file, in a format any program can read.
      </p>
      {error && (
        <p className="mt-3 text-sm text-ink" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="mt-4 rounded-full border border-line px-5 py-2.5 text-sm text-ink transition hover:border-accent/50 hover:text-accent-strong disabled:opacity-60"
      >
        {busy ? "Gathering…" : "Download your data"}
      </button>
      {done && !busy && (
        <p className="mt-3 text-sm text-accent-strong" role="status">
          Downloaded.
        </p>
      )}
    </div>
  );
}

// Danger zone: permanently delete the account + all its data. Calm, deliberate,
// and clear rather than alarming (§2): the seriousness comes from the copy and a
// type-to-confirm step, not red-alert styling. Backed by /api/account/delete.
function DeleteAccount() {
  const { deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const armed = confirmText.trim().toLowerCase() === "delete";

  async function run() {
    if (!armed) return;
    setError(null);
    setBusy(true);
    const res = await deleteAccount();
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    // Account + local world are gone. Full reload to the landing for a clean slate.
    window.location.href = "/";
  }

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        Delete account
      </p>
      {!open ? (
        <div className="mt-2">
          <p className="text-sm leading-relaxed text-ink-soft">
            Permanently remove your account and everything in it: your trails,
            reactions, interests, handle, and friends. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setError(null);
            }}
            className="mt-4 rounded-full border border-line px-5 py-2.5 text-sm text-ink-soft transition hover:border-ink/40 hover:text-ink"
          >
            Delete account
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-ink">
            This permanently deletes your account and every trail you have saved.
            There is no undo, and no way to recover it afterwards.
          </p>
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-soft">
            Type <span className="font-semibold text-ink">delete</span> to confirm
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>
          {error && (
            <p className="text-sm text-ink" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={!armed || busy}
              onClick={run}
              className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-ink/85 disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Delete forever"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-ink transition hover:border-accent/50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SignedIn({
  email,
  onSignOut,
}: {
  email: string;
  onSignOut: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        Signed in as
      </p>
      <p className="mt-1 break-all font-serif text-xl text-ink">{email}</p>
      <SyncStatusLine />
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Your trails sync quietly in the background. Signing out clears this
        device. Your world stays safe in the cloud and returns when you sign
        back in.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onSignOut();
          setBusy(false);
        }}
        className="mt-6 rounded-full border border-line px-6 py-2.5 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong disabled:opacity-60"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The supporter unlock, on the account page (Phase 32).
//
// Three jobs, and the third is a legal one:
//   1. say plainly whether this account holds the unlock;
//   2. offer it, once, without nagging (there is no dismissable banner, no
//      badge, and it never appears in the feed);
//   3. carry the WITHDRAWAL route. Since 19 June 2026 a consumer must be able to
//      withdraw from a distance contract through a function that is available
//      continuously during the period, not by hunting for an address. Drift does
//      not exclude the 14 day right, so this has to be here and has to work.
//
// `?supported=1` is where Stripe returns a buyer. It is deliberately calm: no
// confetti, no "welcome to the club". The purchase is a quiet thing.
// ---------------------------------------------------------------------------
function SupporterSection() {
  const [meter, setMeter] = useState<MeterState | null>(null);
  const limit = dailyLimit();
  // Derived during render rather than pushed into state from an effect: the
  // query string is already React state as far as the router is concerned, and
  // copying it into a second source of truth is what causes cascading renders.
  const justPaid = useSearchParams().get("supported") === "1";

  const [entitlement, setEntitlement] = useState<EntitlementRow | null>(null);
  // ⚠️ The refund confirmation lives HERE, not inside <Withdraw>. Refunding
  // flips this section to its non-supporter branch, which unmounts <Withdraw>
  // and would take any message it was holding with it: the confirmation would
  // flash and vanish, leaving a reader who had just been given money back with
  // no acknowledgement at all on screen.
  const [refunded, setRefunded] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeMeter(setMeter);
    void refreshStatus();
    void fetchMyEntitlement().then(setEntitlement);
    return unsubscribe;
  }, []);

  // Stripe redirects here the instant the payment is taken, but the webhook that
  // actually grants the unlock is a separate request from Stripe's servers and
  // can land a moment later. So look again shortly, rather than showing a fresh
  // supporter a page that says they are not one.
  useEffect(() => {
    if (!justPaid) return;
    const t = window.setTimeout(() => void refreshStatus(), 2500);
    return () => window.clearTimeout(t);
  }, [justPaid]);

  const supporter = meter?.supporter === true;

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        Supporting Drift
      </p>

      {refunded !== null && (
        <>
          <p className="mt-1 font-serif text-xl text-ink">
            Your refund is on its way
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {formatEur(refunded)} is going back to the way you paid, which banks
            usually take five to ten days to show. The unlock has been removed
            and a confirmation is in your inbox. Thank you for trying it.
          </p>
        </>
      )}

      {refunded === null && justPaid && !supporter && (
        <p className="mt-3 text-sm leading-relaxed text-ink/75">
          Thank you. Stripe has your payment and the unlock lands within a few
          seconds. If this still says otherwise in a minute, reload the page.
        </p>
      )}

      {refunded !== null ? null : supporter ? (
        <>
          <p className="mt-1 font-serif text-xl text-ink">
            You hold the supporter unlock
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Thank you. No daily reading limit applies to your account, and
            anything added to the unlock later is included at no extra cost.
          </p>
          <Withdraw
            verdict={assessWithdrawal(entitlement)}
            onRefunded={(cents) => {
              setRefunded(cents);
              setEntitlement(null);
              void refreshStatus();
            }}
          />
        </>
      ) : (
        <>
          <p className="mt-1 font-serif text-xl text-ink">
            {limit === null
              ? "Drift has no advertising and no tracking"
              : `Free reading is capped at ${limit} stops a day`}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            One payment, no subscription. It lifts the daily reading limit and
            keeps a small project running.{" "}
            <Link
              href="/supporter"
              className="focus-ring rounded underline decoration-line underline-offset-2 transition hover:text-accent-strong"
            >
              What you would be buying
            </Link>
            .
          </p>
          <div className="mt-4">
            <SupporterBuy compact />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Changing your mind (Phase 32).
//
// This is the withdrawal function the law has wanted since 19 June 2026, and the
// design rule it is built to is: PRESSING IT DOES THE THING. It used to be a
// link to the contact form, which meant a reader's money waited on the owner
// reading an inbox and going to press Refund in a dashboard. That satisfies the
// letter and misses the point.
//
// Two presses, not one, because a refund cannot be taken back and the reader
// loses the unlock with it. That is the same shape as deleting an account, one
// section below, and for the same reason.
//
// A "no" always says WHICH no it is. Four are possible and they are not
// interchangeable: a grandfathered unlock cost nothing to give back, a refund
// may already have happened, the fourteen days may be up, or the payment may not
// be traceable. Only the last two point at a human, because only those two are
// things a human can still fix.
// ---------------------------------------------------------------------------
function Withdraw({
  verdict,
  onRefunded,
}: {
  verdict: Withdrawability;
  /** Hands the outcome UP: this component is about to be unmounted by it. */
  onRefunded: (amountCents: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nothing was ever paid for, so there is nothing to give back. Said plainly
  // rather than by hiding the section, because a grandfathered reader looking
  // for the refund control should find out why there is not one.
  if (verdict.kind === "not-purchased") {
    return (
      <p className="mt-4 text-xs leading-relaxed text-ink-soft">
        Your unlock was a gift rather than a purchase, so there is nothing to
        refund. It does not expire.
      </p>
    );
  }

  if (verdict.kind === "already-revoked" || verdict.kind === "none") return null;

  if (verdict.kind === "expired" || verdict.kind === "unrefundable") {
    return (
      <p className="mt-4 text-xs leading-relaxed text-ink-soft">
        {verdict.kind === "expired"
          ? "The fourteen day withdrawal period has passed, so a refund is no longer automatic. You can still ask, and it will be looked at."
          : "This purchase cannot be refunded automatically. Write to us and it will be sorted out by hand."}{" "}
        <Link
          href="/contact?topic=withdrawal"
          className="focus-ring rounded underline decoration-line underline-offset-2 transition hover:text-accent-strong"
        >
          Get in touch
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-xs leading-relaxed text-ink-soft">
        Changed your mind? You have{" "}
        <span className="font-medium text-ink">
          {verdict.daysLeft} {verdict.daysLeft === 1 ? "day" : "days"}
        </span>{" "}
        left to withdraw and get the full amount back, for any reason or none.
        You do not have to tell us why.
      </p>

      {confirming ? (
        <div className="mt-3 rounded-xl border border-line bg-paper p-4">
          <p className="text-sm leading-relaxed text-ink">
            Refund your purchase and remove the unlock? The daily reading
            allowance will apply to your account again. Everything you have read
            and saved stays exactly as it is.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const res = await requestWithdrawal();
                setBusy(false);
                if (res.ok) {
                  onRefunded(res.amountCents);
                  return;
                }
                setError(
                  res.error ??
                    "That did not go through. Please try again, or write to us.",
                );
              }}
              className="focus-ring rounded-full bg-accent px-4 py-2 text-sm font-semibold text-paper-raised transition hover:bg-accent-strong disabled:opacity-60"
            >
              {busy ? "Refunding…" : "Yes, refund it"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="focus-ring rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50 hover:text-accent-strong disabled:opacity-60"
            >
              Keep it
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-ink">
              {error}
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="focus-ring mt-2 rounded text-xs font-medium text-ink underline decoration-line underline-offset-2 transition hover:text-accent-strong"
        >
          Get a refund
        </button>
      )}
    </div>
  );
}
