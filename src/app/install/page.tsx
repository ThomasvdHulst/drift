import Link from "next/link";
import { Monogram } from "@/components/BrandLogo";
import { StandaloneNote, PlatformHint } from "@/components/InstallGuide";

export const metadata = {
  title: "Install Drift on your phone",
  description: "Add Drift to your home screen for a full-screen, app-like reading room.",
};

// A calm guide to installing Drift as a home-screen web app (PWA). Reachable
// signed-out too (allowlisted in AuthGate) so the link works from anywhere. Both
// platforms get a short text walkthrough. Nothing pushy: this is a page you
// choose to visit (§2).
export default function InstallPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 py-12 sm:py-16">
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm text-ink-soft transition hover:text-accent-strong"
        >
          ← Home
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <Monogram className="h-8" />
          <h1 className="font-serif text-4xl text-ink">Install Drift</h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Drift feels best as an app: full screen, no browser bar, its own icon on
          your home screen. It is the same Drift, so sign in once and your trails
          come with you. Here is how, in a few taps.
        </p>
      </header>

      <div className="space-y-10">
        <StandaloneNote />
        <PlatformHint />

        {/* iOS */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <AppleGlyph />
            <h2 className="font-serif text-2xl text-ink">iPhone or iPad (Safari)</h2>
          </div>
          <ol className="space-y-2 text-sm leading-relaxed text-ink">
            <Step n={1}>
              Open <span className="font-medium">usedrift.org</span> in{" "}
              <span className="font-medium">Safari</span> (this only works in
              Safari, not Chrome or in-app browsers).
            </Step>
            <Step n={2}>
              Tap the <span className="font-medium">Share</span> button (the square
              with an arrow pointing up) in the toolbar.
            </Step>
            <Step n={3}>
              Scroll down and tap{" "}
              <span className="font-medium">Add to Home Screen</span>.
            </Step>
            <Step n={4}>
              Tap <span className="font-medium">Add</span> in the top right. Drift
              appears on your home screen with its own icon.
            </Step>
          </ol>
        </section>

        {/* Android */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <AndroidGlyph />
            <h2 className="font-serif text-2xl text-ink">Android (Chrome)</h2>
          </div>
          <ol className="space-y-2 text-sm leading-relaxed text-ink">
            <Step n={1}>
              Open <span className="font-medium">usedrift.org</span> in{" "}
              <span className="font-medium">Chrome</span>. You may see an
              &ldquo;Install app&rdquo; prompt appear on its own. If so, tap it and
              you are done.
            </Step>
            <Step n={2}>
              Otherwise, tap the <span className="font-medium">⋮</span> menu in the
              top right.
            </Step>
            <Step n={3}>
              Tap <span className="font-medium">Add to Home screen</span> (or{" "}
              <span className="font-medium">Install app</span>).
            </Step>
            <Step n={4}>
              Confirm with <span className="font-medium">Add</span> /{" "}
              <span className="font-medium">Install</span>. Drift lands on your home
              screen with its own icon.
            </Step>
          </ol>
        </section>

        <p className="border-t border-line pt-6 text-sm leading-relaxed text-ink-soft">
          Open Drift from its new icon and sign in once. It launches full screen,
          like any other app, and your account keeps everything in sync across your
          phone and computer.
        </p>
      </div>
    </main>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent-strong"
        aria-hidden="true"
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function AppleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-ink-soft" aria-hidden="true">
      <path d="M16.365 12.9c.02 2.24 1.964 2.985 1.986 2.995-.017.054-.31 1.063-1.023 2.104-.616.9-1.256 1.797-2.264 1.816-.99.018-1.309-.587-2.441-.587-1.132 0-1.485.568-2.422.605-.973.037-1.714-.973-2.336-1.87-1.271-1.84-2.243-5.199-.938-7.467.648-1.126 1.807-1.84 3.065-1.859.955-.018 1.856.643 2.44.643.583 0 1.68-.795 2.832-.678.482.02 1.835.195 2.704 1.467-.07.043-1.614.943-1.596 2.815M14.79 6.9c.516-.625.864-1.494.769-2.359-.743.03-1.642.495-2.176 1.119-.478.552-.897 1.436-.784 2.283.828.064 1.674-.42 2.19-1.043" />
    </svg>
  );
}

function AndroidGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-ink-soft" aria-hidden="true">
      <path d="M17.6 9.48l1.84-3.18a.4.4 0 0 0-.7-.4l-1.86 3.23a11.5 11.5 0 0 0-9.76 0L5.26 5.9a.4.4 0 1 0-.7.4L6.4 9.48A11.3 11.3 0 0 0 .5 18.5h23a11.3 11.3 0 0 0-5.9-9.02M7 15.25a1.13 1.13 0 1 1 0-2.25 1.13 1.13 0 0 1 0 2.25m10 0a1.13 1.13 0 1 1 0-2.25 1.13 1.13 0 0 1 0 2.25" />
    </svg>
  );
}
