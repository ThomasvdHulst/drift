import { PublicPage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";

export const metadata = {
  title: "The principles Drift is built on",
  description:
    "Five rules that decide what Drift is allowed to do, and the features each one rules out. The constraints the app is built under, written out.",
  alternates: { canonical: "/principles" },
};

// Not a description of Drift but the constraints it is built under, and what each
// one rules out. The same five principles that govern the codebase (CLAUDE.md §2),
// written for a reader rather than for a contributor.
export default function PrinciplesPage() {
  return (
    <PublicPage
      title="Principles"
      intro={
        <>
          Drift is built under five rules. They are worth stating publicly
          because each one rules out a feature that would make the app more
          habit-forming, and those features are individually easy to justify.
          Here they are, with what each one costs.
        </>
      }
    >
      <Section title="1. Transparency over opacity">
        <P>
          You can see why the card in front of you appeared: the thread you
          pulled, the field you chose to stay inside, the page you asked to
          circle, or &ldquo;drifting&rdquo; when nothing was chosen. There is a
          line on the card saying which.
        </P>
        <P>
          <Lead>What this rules out: </Lead>a recommender. The usual way to
          improve a feed is to learn what holds someone&apos;s attention and
          serve more of it without saying so. Drift keeps a light interest model,
          but it only affects which broad areas turn up when you drift at random,
          it is shown on the card, and it can be switched off. The working rule
          is that if the reason cannot be stated in about four words on the card,
          the feature does not get built.
        </P>
      </Section>

      <Section title="2. Agency over autoplay">
        <P>
          Nothing advances on its own. No autoplay, no timers, no card sliding
          partway into view.
        </P>
        <P>
          <Lead>What this rules out: </Lead>a deep queue. Drift fetches at most
          one card ahead. That is a deliberate limit rather than a technical one:
          a large buffer is what makes a feed feel like there is always more
          waiting, and once twenty cards are ready, stopping starts to feel
          wasteful. One ahead is enough for the next card to appear instantly.
        </P>
      </Section>

      <Section title="3. Sessions have shape">
        <P>
          A session has a beginning (you pick where to start), a middle (the
          trail), and an end (a map of where you went).
        </P>
        <P>
          <Lead>What this rules out: </Lead>putting the payoff at the next swipe.
          The trail map is the most interesting part of the app and it is only
          reachable by stopping. Moving it earlier would very likely increase
          time spent, and would remove the reason it works.
        </P>
      </Section>

      <Section title="4. Gentle awareness, not guilt">
        <P>
          There is a count of your stops in the corner. After about 25, Drift
          mentions once that you have been going a while. You can dismiss it and
          it will not ask again.
        </P>
        <P>
          <Lead>What this rules out: </Lead>most of the standard engagement
          toolkit.
        </P>
        <Bullets>
          <li>No streaks.</li>
          <li>No badges or unread counts.</li>
          <li>
            No push notifications. Drift does not contact you at all.
          </li>
          <li>No daily goal and no time-spent target.</li>
        </Bullets>
        <P>
          The counter is deliberately the whole of it. Anything stronger tends to
          become pressure of a different kind rather than less pressure.
        </P>
      </Section>

      <Section title="5. Content is vetted, and software only reshapes it">
        <P>
          Everything you read in Drift was written by people, for an encyclopedia
          or a museum catalogue. Drift cuts it into cards and works out the
          threads between them. It does not write the facts.
        </P>
        <P>
          <Lead>What this rules out: </Lead>generated text on a card. Where a
          language model is used at all it is optional, runs locally, and is
          limited to labelling and ordering material a person already wrote. If
          it is unavailable the app behaves the same way, because no card depends
          on it. More on <A href="/sources">sources</A>.
        </P>
      </Section>

      <Section title="Why these are written down">
        <P>
          Mostly because they are easy to lose gradually. Nearly every change
          that would make Drift more habit-forming is small and locally
          reasonable, and the ones above are the specific things I would
          otherwise talk myself into.
        </P>
        <P>
          If you think Drift has broken one of these,{" "}
          <A href="/contact">let me know</A>.
        </P>
      </Section>
    </PublicPage>
  );
}
