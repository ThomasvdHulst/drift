import Link from "next/link";
import { Monogram } from "@/components/BrandLogo";
import { PublicFooter } from "@/components/PublicFooter";
import { CC_BY_SA_4, CC0_1 } from "@/lib/licenses";
import { LicenseLink } from "@/components/LicenseLink";

export const metadata = {
  title: "About Drift",
  description:
    "A calm feed of knowledge cards from Wikipedia and The Met, where you pick the direction. What Drift is, why it exists, where the content comes from, and who makes it.",
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
            Drift is a calm feed of knowledge cards from Wikipedia and The
            Metropolitan Museum of Art. You pick the direction at every step,
            and every session has an end.
          </p>
        </header>

        <div className="space-y-8 text-ink">
          <Section title="What Drift is">
            <p className="text-ink-soft">
              Every card fills the screen: a Wikipedia article or a public
              domain artwork, one at a time. Each card carries visible{" "}
              <span className="text-ink">threads</span>, which are related
              directions you can pull to decide where you go next. There is no
              recommender choosing for you.
            </p>
            <p className="mt-3 text-ink-soft">
              A session has a beginning (a topic to start from), a middle (the
              trail you wander) and an end (a small map of where you went, which
              you can save and share). The map is only reachable by stopping.
            </p>
          </Section>

          <Section title="Why it exists">
            <p className="text-ink-soft">
              Most feeds are built to hold attention for as long as possible;
              autoplay, infinite scroll and hidden ranking are the mechanics of
              it. Drift started as an attempt to build one that works the other
              way: nothing advances on its own, the reason each card appeared is
              written on the card, and there are no streaks, badges or
              notifications. Whether that is actually better is something you
              would have to use it for a week to know.
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
                <span className="text-ink">Steer.</span> Pull the visible
                threads to choose your own direction. Every card says why it
                appeared: the thread you pulled, or &ldquo;drifting&rdquo; when
                you did not choose.
              </li>
              <li>
                <span className="text-ink">Arrive.</span> When you stop, your
                wander becomes a trail map you can keep or export as an image.
              </li>
            </ul>
          </Section>

          <Section title="The rules it is built under">
            <p className="text-ink-soft">
              A few rules hold for every part of Drift. The full set, with what
              each one rules out, is on the{" "}
              <Link
                href="/principles"
                className="text-accent-strong hover:underline"
              >
                principles
              </Link>{" "}
              page.
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-soft">
              <li>
                <span className="text-ink">Transparency over opacity.</span> You
                always see why a card appeared. No hidden ranking.
              </li>
              <li>
                <span className="text-ink">Agency over autoplay.</span> Nothing
                advances on its own. Every card waits for you.
              </li>
              <li>
                <span className="text-ink">Sessions have shape.</span> A
                beginning, a middle and an end, with the trail map at the end.
              </li>
              <li>
                <span className="text-ink">Gentle awareness, not guilt.</span> A
                count of your stops, and one note after about 25 of them.
                Nothing stronger than that.
              </li>
            </ul>
          </Section>

          <Section title="Where the content comes from">
            <p className="text-ink-soft">
              Every card is made from openly licensed, human curated knowledge:
              Wikipedia articles, under <LicenseLink license={CC_BY_SA_4} />, and
              public domain artworks from The Metropolitan Museum of Art, under{" "}
              <LicenseLink license={CC0_1} />. Every card links back to the page it
              came from, whose history credits the people who wrote it. Drift
              only reshapes that content into cards and threads. It does not
              write the facts.
            </p>
          </Section>

          <Section title="Who makes Drift">
            <p className="text-ink-soft">
              Drift is built and maintained by one person, Thomas, in the
              Netherlands. There is no company behind it. It began as a personal
              experiment in whether a feed could work differently, and it is
              shared with a small circle of friends and anyone else who wants to
              try it. Nothing in it is tuned for time spent.
            </p>
          </Section>

          <Section title="Read further">
            <p className="text-ink-soft">
              This page is the short version. There is more detail on:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-soft">
              <li>
                <Link href="/how-it-works" className="text-accent-strong hover:underline">
                  How it works
                </Link>
                , with a demo you can try without an account.
              </li>
              <li>
                <Link href="/principles" className="text-accent-strong hover:underline">
                  Principles
                </Link>
                , the five rules Drift is built under and what each rules out.
              </li>
              <li>
                <Link href="/sources" className="text-accent-strong hover:underline">
                  Sources
                </Link>
                , where each card comes from and under which licence.
              </li>
              <li>
                <Link href="/faq" className="text-accent-strong hover:underline">
                  Questions
                </Link>
                , and{" "}
                <Link href="/notes" className="text-accent-strong hover:underline">
                  notes
                </Link>{" "}
                from building it.
              </li>
            </ul>
          </Section>

          <Section title="Get in touch">
            <p className="text-ink-soft">
              Messages come to me and I read all of them. Tell me what is
              working, what is broken, or what you wish Drift did.{" "}
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
