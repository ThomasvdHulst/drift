import Link from "next/link";
import { Monogram } from "@/components/BrandLogo";

export const metadata = {
  title: "What Drift stores",
  description: "A plain note on what Drift keeps, where, and how to remove it.",
};

// A calm, plain-language "what we store" note. Intentionally NOT a legal wall of
// text: Drift is a small personal project shared with friends, so this just says
// honestly what's kept, where, and how to delete it. Reachable signed-out too
// (allowlisted in AuthGate) so people can read it before creating an account.
export default function PrivacyPage() {
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
          <h1 className="font-serif text-4xl text-ink">What Drift stores</h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Drift is a small, calm project shared with friends. Here is the whole
          story of what it keeps about you, in plain words.
        </p>
      </header>

      <div className="space-y-8 text-ink">
        <Section title="What's stored">
          <p>When you have an account, Drift keeps only:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
            <li>Your email address (so you can sign in).</li>
            <li>The trails you save, and the cards in them.</li>
            <li>
              Your likes and dislikes, and the gentle interests they build, so
              drifting can reflect what you enjoy.
            </li>
            <li>Small settings, like dark mode.</li>
            <li>
              If you set one: a handle and display name, plus who your friends
              are and any trails you have shared with them.
            </li>
          </ul>
          <p className="mt-3 text-ink-soft">
            There is no tracking, no advertising, no third-party analytics
            following you around, and nothing is ever sold. Drift has no interest
            in maximizing your time. It is built to be the opposite of that.
          </p>
        </Section>

        <Section title="Where it lives">
          <p className="text-ink-soft">
            Everything is stored on your device first, and (when you are signed
            in) synced privately to a Supabase database so your trails follow you
            between devices. Your data is yours alone: it is protected so that
            only your account can read or change it.
          </p>
        </Section>

        <Section title="Where the content comes from">
          <p className="text-ink-soft">
            The cards themselves are made from openly licensed human knowledge:
            Wikipedia articles (CC BY-SA) and public-domain artworks from the Art
            Institute of Chicago (CC0). Drift only reshapes that content into
            cards and threads. It never invents facts.
          </p>
        </Section>

        <Section title="Removing your data">
          <p className="text-ink-soft">
            You are in control. Sign out to clear Drift from a device. To remove
            everything for good, open{" "}
            <Link href="/account" className="text-accent-strong hover:underline">
              your account
            </Link>{" "}
            and choose <span className="text-ink">Delete account</span>. That
            permanently deletes your account and every trail, like, interest,
            handle, and share tied to it. It cannot be undone.
          </p>
        </Section>

        <p className="border-t border-line pt-6 text-sm text-ink-soft">
          Questions about any of this are always welcome.
        </p>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 font-serif text-2xl text-ink">{title}</h2>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}
