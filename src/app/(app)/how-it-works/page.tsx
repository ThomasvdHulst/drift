import { PublicPage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";
import { ThreadDemo } from "@/components/landing/ThreadDemo";
import { TrailMap } from "@/components/TrailMap";
import { EXAMPLE_TRAILS } from "@/components/landing/data";

export const metadata = {
  title: "How Drift works",
  description:
    "Cards, threads, realms and trail maps: what Drift actually does, with a demo you can steer without an account.",
  alternates: { canonical: "/how-it-works" },
};

// The full walkthrough. The landing page pitches Drift in a few lines; this is the
// page for someone who wants to know exactly what happens when they tap something.
//
// It embeds the SAME bundled demo the landing uses (ThreadDemo, EXAMPLE_TRAILS),
// so the page demonstrates rather than only describes, and it still makes no live
// Wikipedia or Art Institute call: every card here is hand-authored and every
// image is a CC0 artwork. See components/landing/data.ts.
export default function HowItWorksPage() {
  return (
    <PublicPage
      title="How Drift works"
      intro={
        <>
          Drift is a feed where you pick the direction. There is no recommender
          choosing what comes next. This page describes what happens at each
          step, and includes the demo from the home page so you can try it
          without an account.
        </>
      }
    >
      <Section title="A card">
        <P>
          Every stop is one card filling the screen: a Wikipedia article, or a
          public domain artwork from the Art Institute of Chicago. A title, a
          short description, an opening extract, and a picture if the page has a
          freely licensed one. &ldquo;Read more&rdquo; opens the full article
          inside the card, with tables and the infobox.
        </P>
        <P>
          Nothing on a card moves on its own. No autoplay, no countdown, no next
          card sliding partway in.
        </P>
      </Section>

      <Section title="Threads">
        <P>
          Under each card is a short row of threads: related articles you can go
          to, labelled so you know what they are first. <Lead>Nearby </Lead>means
          closely related. <Lead>Tangent </Lead>means further out.
        </P>
        <P>
          Pulling one moves you sideways rather than forward, which is a
          different motion from an ordinary drift. Here is the demo, bundled into
          the page:
        </P>
        <div className="mt-5">
          <ThreadDemo />
        </div>
        <P>
          The Great Wave leads to ukiyo-e, which leads to Impressionism, because
          ukiyo-e did influence the Impressionists.
        </P>
      </Section>

      <Section title="Drifting">
        <P>
          If you do not want to pick a direction, swipe on or press the drift
          button and Drift chooses the next card, from well-formed pages in the
          areas you have been reading.
        </P>
        <P>
          Every card carries a line saying why it appeared: the thread you
          pulled, the field you are inside, or &ldquo;drifting&rdquo; when
          nothing was chosen.
        </P>
      </Section>

      <Section title="Four ways to begin">
        <Bullets>
          <li>
            <Lead>Surprise me. </Lead>Start anywhere.
          </li>
          <li>
            <Lead>Drift within a field. </Lead>Stay inside one of 28 areas, from
            Mathematics to Military History, for the session.
          </li>
          <li>
            <Lead>Circle one page. </Lead>Name an article and drift its widening
            neighbourhood.
          </li>
          <li>
            <Lead>In the news. </Lead>Wander the articles behind this
            month&apos;s stories in one subject. Not headlines: the encyclopedia
            pages behind them.
          </li>
        </Bullets>
        <P>
          You can change your mind partway through. A focus can be released
          (&ldquo;drift freely&rdquo;) or re-anchored on the card you are
          reading, without ending the trail.
        </P>
      </Section>

      <Section title="Realms">
        <P>
          There are two, and you can cross between them.{" "}
          <Lead>Encyclopedia </Lead>is Wikipedia. <Lead>Gallery </Lead>is the Art
          Institute of Chicago&apos;s open access collection: public domain
          paintings, prints and objects, zoomable, with the museum&apos;s own
          label.
        </P>
        <P>
          When a card has a counterpart in the other realm, a doorway appears.
          From an article about Monet you can step across to his paintings, and
          from a Hokusai print to the article.
        </P>
      </Section>

      <Section title="The trail map">
        <P>
          When you stop, the session is drawn as a map: where you began, each
          stop, which threads you pulled and where you drifted.
        </P>
        <div className="mt-4 rounded-2xl border border-line bg-paper-raised p-4">
          <TrailMap steps={EXAMPLE_TRAILS[0]} />
        </div>
        <P>
          You can name it, save it, export it as an image, or send it to a
          friend. It is only reachable by ending the session, which is
          deliberate.
        </P>
      </Section>

      <Section title="What Drift does not do">
        <P>
          No autoplay. No queue of preloaded cards (it fetches at most one
          ahead). No streaks, badges or notifications. After about 25 stops it
          notes that you have been going a while, and you can dismiss that and
          carry on.
        </P>
        <P>
          The reasoning for each is on the <A href="/principles">principles</A>{" "}
          page, and where the content comes from is on{" "}
          <A href="/sources">sources</A>.
        </P>
      </Section>
    </PublicPage>
  );
}
