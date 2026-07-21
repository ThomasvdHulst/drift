import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

// The 404 page. Without this, a mistyped or stale URL on the live site falls back
// to Next's unstyled default, which is the one screen in Drift that wouldn't look
// like Drift. Same calm voice as the error boundary in app/error.tsx: name what
// happened plainly, take no blame, and offer the way back. Signed out with the
// cloud configured, AuthGate shows the landing page instead, which is also fine.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-paper px-6 text-center">
      <div className="max-w-sm space-y-3">
        <h1 className="font-serif text-3xl text-ink">
          This thread leads nowhere
        </h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          There is no page at this address. It may have moved, or the link may
          have been mistyped. Your saved trails are untouched.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/drift"
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-paper-raised shadow-sm transition hover:bg-accent-strong"
        >
          Start drifting
        </Link>
        <Link
          href="/"
          className="rounded-full border border-line px-5 py-2.5 text-sm text-ink transition hover:border-accent/50 hover:text-accent-strong"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
