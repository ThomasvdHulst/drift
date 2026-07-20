"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useTour } from "@/components/tour/TourProvider";
import { AuthForm } from "@/components/AuthForm";
import {
  getSyncStatus,
  onSyncStatus,
  type SyncStatus,
} from "@/lib/sync/replicator";
import { getMyProfile, upsertProfile } from "@/lib/social/client";
import { normalizeHandle, handleError } from "@/lib/social/handles";

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
          <ChangePassword />
          <ProfileSection />
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
  offline: { dot: "bg-ink-soft/50", text: "Offline: saved here, will sync later" },
  disabled: { dot: "bg-ink-soft/40", text: "Connecting…" },
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
            <div className="mt-1 flex items-center rounded-lg border border-line bg-paper px-3 focus-within:border-accent">
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
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
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
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
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
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-accent"
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
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-ink/40"
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
      <p className="mt-1 font-serif text-xl text-ink">{email}</p>
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
