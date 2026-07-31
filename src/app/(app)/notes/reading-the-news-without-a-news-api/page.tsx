import { NotePage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";
import { noteBySlug } from "@/lib/notes";

const SLUG = "reading-the-news-without-a-news-api";
const note = noteBySlug(SLUG)!;

export const metadata = {
  title: note.title,
  description: note.description,
  alternates: { canonical: `/notes/${SLUG}` },
};

export default function Note() {
  return (
    <NotePage slug={SLUG}>
      <Section title="The gap">
        <P>
          Drift handled the timeless well and the present not at all. You could
          wander Byzantine history for an hour, but if something was happening
          this month the app had no idea. A fair amount of curiosity starts from
          &ldquo;what is going on with that&rdquo;, so it was a real gap.
        </P>
        <P>
          What I wanted was to pick a subject and wander the encyclopedia
          articles behind what has been happening in it.
        </P>
      </Section>

      <Section title="Why a news API was the wrong fit">
        <P>
          A news API is the obvious route and would have taken about ten minutes.
          Three problems, in descending order of how much they bothered me:
        </P>
        <Bullets>
          <li>
            <Lead>Licensing. </Lead>Everything else in Drift is openly licensed,
            so it can be cut into cards, stored and shown, and I can say under
            what terms. Headlines and article text are copyrighted work under
            someone&apos;s terms of service, and I would be taking on obligations
            I am not set up to meet.
          </li>
          <li>
            <Lead>Editorial position. </Lead>Showing headlines means choosing
            outlets, and that is a stance. A one-person project should not
            acquire one by accident.
          </li>
          <li>
            <Lead>Tone. </Lead>News is written for urgency. Dropping it into a
            reading app aimed at the opposite does not work.
          </li>
        </Bullets>
      </Section>

      <Section title="Wikipedia already keeps a list">
        <P>
          The thing I actually wanted was never headlines, it was subjects: which
          articles this month has been about.
        </P>
        <P>
          Wikipedia&apos;s editors maintain a current events portal, one page per
          day, grouped into stable sections such as politics, science and
          technology, disasters and armed conflicts. Each entry is a line of
          prose full of links to encyclopedia articles. So the list already
          exists, in the corpus Drift was using anyway.
        </P>
      </Section>

      <Section title="Reading only the link targets">
        <P>
          The rule is narrow. Drift reads <Lead>only the link targets: </Lead>
          which articles are pointed at, how often, and in which section. The
          prose around them is parsed to find the links and then discarded.
          No headline or editor-written sentence about an event is stored or
          shown.
        </P>
        <P>
          The result is that &ldquo;in the news&rdquo; is not a new content
          source. It is the same encyclopedia, entered from a different angle:
          instead of picking a field, you pick a set of articles the world
          happened to be interested in. No new licensing, no editorial position,
          and every card is still an ordinary article.
        </P>
        <P>
          One convenient detail: a month is about thirty day pages, and the API
          returns up to fifty pages of content per request, so a whole month
          costs one call.
        </P>
      </Section>

      <Section title="How it reads">
        <P>
          Different from a news app, and more useful than I expected. You get the
          articles a month has been about, ranked by how often they came up, and
          then drift from there normally. It gives you background rather than
          updates, which is the part that is still true next week.
        </P>
        <P>
          When a section runs out of unread articles, Drift widens outward from
          them instead of repeating, and says that it has.
        </P>
      </Section>

      <Section title="Afterwards">
        <P>
          The part worth remembering is that I nearly took on copyrighted
          content and an editorial stance to answer a question the openly
          licensed corpus already answered, mostly because the commercial API was
          the first thing that came to mind.
        </P>
        <P>
          How all of this is licensed is on <A href="/sources">sources</A>.
        </P>
      </Section>
    </NotePage>
  );
}
