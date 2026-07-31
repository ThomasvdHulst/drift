import { NotePage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";
import { noteBySlug } from "@/lib/notes";

const SLUG = "the-endpoint-that-died";
const note = noteBySlug(SLUG)!;

export const metadata = {
  title: note.title,
  description: note.description,
  alternates: { canonical: `/notes/${SLUG}` },
};

export default function Note() {
  return (
    <NotePage slug={SLUG}>
      <Section title="The dependency">
        <P>
          Drift needs an answer to one question: given this article, which other
          articles are near it? That is what the threads under each card are.
          Without a decent answer the app is a random article button.
        </P>
        <P>
          Wikimedia had a REST endpoint for exactly this, returning a page&apos;s
          related articles. I built around it. It returns 403 to anyone outside
          Wikimedia&apos;s own apps, and has for a while; the documentation had
          not caught up. I found out after the feed, the cards and the storage
          were already written.
        </P>
      </Section>

      <Section title="Why the article's own links do not work">
        <P>
          The first replacement I tried was the list of links in the article,
          which is available through the API and looks like the obvious answer.
        </P>
        <P>
          It is not, and the reason is worth writing down. The links in an
          article are the words that needed explaining, not the articles nearest
          to it. A composer&apos;s page links to a year, a country and a city.
          All are related in a technical sense and none is a direction anyone
          wants to take.
        </P>
        <Bullets>
          <li>
            <Lead>Volume. </Lead>Hundreds per article, with no useful ordering.
          </li>
          <li>
            <Lead>Wrong kind. </Lead>Years, places, units of measurement. Prose
            scaffolding rather than subject matter.
          </li>
          <li>
            <Lead>One direction. </Lead>Links point outward. What a page is about
            is often better indicated by what points at it.
          </li>
        </Bullets>
      </Section>

      <Section title="Using the search index instead">
        <P>
          What worked was Wikipedia&apos;s own search, which supports a
          more-like-this query: name an article and it returns pages whose text
          sits closest to it. That is a different question from &ldquo;what does
          this link to&rdquo;, and closer to the one I actually had.
        </P>
        <P>
          The results are noticeably better. From Impressionism you get
          Post-Impressionism, Claude Monet, En plein air, rather than 1874 and
          France.
        </P>
      </Section>

      <Section title="It also costs less">
        <P>
          The old endpoint returned titles. Building a card from a title then
          needed another request each for the description, extract and thumbnail,
          so twenty related pages meant twenty one requests.
        </P>
        <P>
          The search query can return all of those fields alongside the results
          in the same request, so it is one call instead of twenty one. That
          matters more than it would elsewhere: this is a donated public API and
          Drift is a hobby project pointing a feed at it.
        </P>
      </Section>

      <Section title="Two things I would do differently">
        <P>
          Check the riskiest call first. I had built most of the app before
          discovering the one request it could not do without did not work, and a
          few minutes of curl at the start would have caught it.
        </P>
        <P>
          And when a dependency goes away, do not assume the replacement should
          have the same shape. My first instinct was to reconstruct the old
          endpoint&apos;s behaviour from other calls, which would have been worse
          than what I ended up with.
        </P>
        <P>
          What Drift asks of Wikipedia now is described on{" "}
          <A href="/sources">sources</A>.
        </P>
      </Section>
    </NotePage>
  );
}
