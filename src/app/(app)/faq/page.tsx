import { PublicPage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";

export const metadata = {
  title: "Drift questions and answers",
  description:
    "Is it free, why does it need an account, what happens to trails, why there is no algorithm, whether it works offline. Answers about Drift.",
  alternates: { canonical: "/faq" },
};

// Questions people in the beta actually asked, answered the way they would be
// answered in a message. Kept short, and honest where the answer is "no" or
// "not really".
export default function FaqPage() {
  return (
    <PublicPage
      title="Questions"
      intro={
        <>
          Things people have asked. If yours is not here,{" "}
          <A href="/contact">send it over</A>.
        </>
      }
    >
      <Section title="Is Drift free?">
        <P>
          Yes. There is no paid tier and nothing held back behind one. It is a
          personal project rather than a business, and it costs little enough to
          run that keeping it free is straightforward.
        </P>
      </Section>

      <Section title="Why do I need an account?">
        <P>
          So your trails work across devices. Drift stores everything on your
          device first, which is fast, but a trail saved on a laptop would not
          exist on a phone. An account carries your trails, saved pages and
          settings between them, and is what makes sharing a trail possible.
        </P>
        <P>An email address and a password. Nothing else is asked for.</P>
      </Section>

      <Section title="Do you sell my data? Is there tracking?">
        <P>
          No. There is no analytics script, no third-party tracker and no
          advertising cookie on the site at present. Your trails are readable by
          you, and by anyone you deliberately send one to.{" "}
          <A href="/privacy">What Drift stores</A> sets out the detail, and you
          can delete your account and its contents from inside the app.
        </P>
      </Section>

      <Section title="Why is there no algorithm?">
        <P>
          There is one, it just runs on your input. The threads under each card
          are the steering. Drift also keeps a light record of which broad areas
          you have been reading, which only affects what turns up when you drift
          at random rather than choosing, and it can be switched off in settings.
        </P>
        <P>
          What it does not do is learn what holds your attention and serve more
          of it silently. The reasoning is on{" "}
          <A href="/principles">principles</A>.
        </P>
      </Section>

      <Section title="What happens to a trail?">
        <P>
          It is yours to name, keep, export as an image, or delete. A saved trail
          lives in your account and syncs across your devices. You can send one
          to a friend inside Drift if you are both there. Nothing is published
          publicly and there is no feed of other people&apos;s trails.
        </P>
      </Section>

      <Section title="Can I use it on my phone?">
        <P>
          Yes, and that is mainly what it is for. Drift installs to a home screen
          and runs full screen on iPhone and Android. The steps are on{" "}
          <A href="/install">install</A>. It is a web app, so there is no app
          store and nothing to update.
        </P>
      </Section>

      <Section title="Does it work offline?">
        <P>
          Not really. Cards are fetched live from Wikipedia or the Art Institute,
          so drifting needs a connection. Trails you have already saved are
          stored on your device and stay readable.
        </P>
      </Section>

      <Section title="Where does the content come from? Can I trust it?">
        <P>
          Wikipedia and the Art Institute of Chicago. Drift does not generate
          text on a card, so the accuracy is Wikipedia&apos;s accuracy: good for
          orientation, worth checking for anything that matters. Every card links
          to its source. Detail on <A href="/sources">sources</A>.
        </P>
      </Section>

      <Section title="Will there ever be ads?">
        <P>
          Possibly. If so they would be clearly marked and separate from cards,
          and the privacy page would be updated first, since an ad script sets
          third-party cookies. What I want to avoid is time spent becoming the
          number the app is tuned for.
        </P>
      </Section>

      <Section title="Who makes Drift?">
        <P>
          One person. More on <A href="/about">about</A> and{" "}
          <A href="/colophon">colophon</A>.
        </P>
      </Section>

      <Section title="Something is broken. What do I do?">
        <P>
          <A href="/contact">Let me know</A>. Useful things to include:
        </P>
        <Bullets>
          <li>
            <Lead>What you were doing </Lead>when it went wrong.
          </li>
          <li>
            <Lead>Phone or laptop, </Lead>and whether Drift was installed to your
            home screen.
          </li>
          <li>
            <Lead>What you expected </Lead>to happen instead.
          </li>
        </Bullets>
      </Section>
    </PublicPage>
  );
}
