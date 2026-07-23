import Link from "next/link";
import { Monogram } from "@/components/BrandLogo";
import { PublicFooter } from "@/components/PublicFooter";

export const metadata = {
  title: "About Drift",
  description:
    "Drift is a calm feed of knowledge cards where you are the algorithm. What it is, why it exists, where the content comes from, and who makes it.",
  alternates: { canonical: "/about" },
};

// The public "About" page. Reachable signed-out (allowlisted in AuthGate, listed in
// the sitemap) so anyone, including a reviewer, can read who Drift is and why it
// exists before deciding to trust it. Plain language, the same calm voice as the
// rest of the app, and honest about being a small independent project (§2).
export default function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:py-16">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm text-ink-soft transition hover:text-accent-strong"
          >
            ← Home
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <Monogram className="h-8" />
            <h1 className="font-serif text-4xl text-ink">About Drift</h1>
          </div>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            Drift is a calm feed of knowledge cards where you are the algorithm.
            It is built to be the opposite of an endless, addictive feed: a place
            to be curious on purpose, then put down.
          </p>
        </header>

        <div className="space-y-8 text-ink">
          <Section title="What Drift is">
            <p className="text-ink-soft">
              Every card is a full screen of real, human knowledge: a Wikipedia
              article or a public domain artwork, shown one at a time. Each card
              carries visible <span className="text-ink">threads</span>, which are
              related directions you can pull to steer where you go next. You are
              not fed by a hidden recommender. You choose the path, and the feed
              follows you.
            </p>
            <p className="mt-3 text-ink-soft">
              Every session has a shape: a beginning (a topic to start from), a
              middle (the trail you wander), and an end (a small map of where your
              curiosity went, which you can save and share). The reward waits at
              the exit, not at the next swipe.
            </p>
          </Section>

          <Section title="Why it exists">
            <p className="text-ink-soft">
              Most feeds are built to hold your attention as long as possible.
              Autoplay, infinite scroll, and opaque ranking are designed to keep
              you guessing and keep you there. Drift is a deliberate antidote to
              that. Nothing advances on its own. Nothing is hidden. There are no
              streaks, no red badges, and no notifications trying to pull you
              back. It is scrolling that leaves you a little more curious, not a
              little more numb.
            </p>
          </Section>

          <Section title="How it works">
            <ul className="list-disc space-y-1.5 pl-5 text-ink-soft">
              <li>
                <span className="text-ink">Start.</span> Begin with a topic, pick
                a realm, drift within a field, follow what is in the news, or let
                curiosity surprise you.
              </li>
              <li>
                <span className="text-ink">Steer.</span> Pull the visible threads
                to choose your own direction. You always see why the next card
                appeared: the thread you chose, or an honest &ldquo;drift&rdquo;.
              </li>
              <li>
                <span className="text-ink">Arrive.</span> When you stop, your
                wander becomes a trail map you can keep, export as an image, or
                share with a friend.
              </li>
            </ul>
          </Section>

          <Section title="What we believe">
            <p className="text-ink-soft">
              A few principles hold for every part of Drift, even when a shortcut
              would be easier:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-soft">
              <li>
                <span className="text-ink">Transparency over opacity.</span> You
                always see why a card appeared. No hidden ranking.
              </li>
              <li>
                <span className="text-ink">Agency over autoplay.</span> Every card
                waits for you. There is no bottomless feed teasing one more.
              </li>
              <li>
                <span className="text-ink">Sessions have shape.</span> A clear
                beginning, middle, and end, with the trail map as the payoff.
              </li>
              <li>
                <span className="text-ink">Gentle awareness, not guilt.</span> A
                quiet count of your stops and a soft nudge after a while, and
                nothing more.
              </li>
            </ul>
          </Section>

          <Section title="Where the content comes from">
            <p className="text-ink-soft">
              Every card is made from openly licensed, human curated knowledge:
              Wikipedia articles (CC BY-SA) and public domain artworks from the
              Art Institute of Chicago (CC0). Drift only reshapes that content
              into cards and threads. It never invents facts, and it is never in
              the driver&apos;s seat. You are.
            </p>
          </Section>

          <Section title="Who makes Drift">
            <p className="text-ink-soft">
              Drift is a small, independent project, built and maintained by one
              person, Thomas, not a company. It began as a personal experiment in
              healthier scrolling and is shared with a small circle of friends and
              anyone else who wants a calmer way to be curious. It is not built to
              maximize your time or harvest your attention, and it never will be.
            </p>
          </Section>

          <Section title="Get in touch">
            <p className="text-ink-soft">
              A real person reads every message. Tell us what is working, what is
              broken, or what you wish Drift did.{" "}
              <Link
                href="/contact"
                className="text-accent-strong hover:underline"
              >
                Get in touch here
              </Link>
              . You can also read exactly{" "}
              <Link
                href="/privacy"
                className="text-accent-strong hover:underline"
              >
                what Drift stores
              </Link>
              .
            </p>
          </Section>
        </div>
      </main>

      <PublicFooter />
    </div>
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
