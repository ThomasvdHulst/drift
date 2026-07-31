import { PublicPage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";
import { CC_BY_SA_4, CC0_1 } from "@/lib/licenses";
import { LicenseLink } from "@/components/LicenseLink";

export const metadata = {
  title: "Where Drift's content comes from",
  description:
    "Every card in Drift comes from Wikipedia under CC BY-SA 4.0 or the Art Institute of Chicago under CC0. How each is used, credited and licensed.",
  alternates: { canonical: "/sources" },
};

// The provenance and licensing page. Two jobs: say plainly where the words and
// pictures come from, and put the licence obligations somewhere fuller than the
// one-line footer notice. See lib/licenses.ts for the obligations themselves
// (attribution AND a linked licence notice, which are distinct requirements).
export default function SourcesPage() {
  return (
    <PublicPage
      title="Sources"
      intro={
        <>
          Drift has no content of its own. Every card comes from an openly
          licensed collection and links back to where it came from. This page
          sets out what comes from where, under which licence, and what the app
          does to it.
        </>
      }
    >
      <Section title="Wikipedia">
        <P>
          The Encyclopedia realm is English Wikipedia: card titles,
          descriptions, extracts, and the full article body behind &ldquo;read
          more&rdquo;.
        </P>
        <P>
          The text is used under <LicenseLink license={CC_BY_SA_4} />. That
          carries two separate obligations:
        </P>
        <Bullets>
          <li>
            <Lead>Attribution. </Lead>Every card links to its article, and the
            article&apos;s history page credits everyone who wrote it. That is
            the form the Wikimedia Terms of Use accept.
          </li>
          <li>
            <Lead>A licence notice. </Lead>Naming the licence is not sufficient;
            the notice has to reach the licence text. So the licence is named and
            linked on the card itself, not only in a footer.
          </li>
        </Bullets>
        <P>
          Non-free images are excluded by construction. Wikipedia hosts some
          files under fair use, which are not CC BY-SA, so Drift requests freely
          licensed images only and the article parser drops embedded images
          entirely.
        </P>
      </Section>

      <Section title="Images are not covered by the article's licence">
        <P>
          Worth stating separately, because it is easy to get wrong and Drift got
          it wrong until July 2026. A photograph on a Wikipedia article is a{" "}
          <Lead>separate work </Lead>from the article. It has its own author, who
          is usually not among the article&apos;s authors, and its own licence,
          which may be CC BY-SA, CC BY, CC0, a public domain dedication or
          something else. The article&apos;s licence does not cover it.
        </P>
        <P>
          So Drift reads each file&apos;s own creator and licence from Wikipedia
          and shows them on the card, with a link to that file&apos;s description
          page. If a file&apos;s licence requires a credit and Drift cannot
          establish one, or if the file is flagged as carrying trademark or
          personality rights, the image is not displayed at all. A card without a
          picture is the correct outcome there.
        </P>
      </Section>

      <Section title="The Art Institute of Chicago">
        <P>
          The Gallery realm is The Art Institute of Chicago&apos;s
          <span aria-hidden="true">®</span> open access collection, under{" "}
          <LicenseLink license={CC0_1} />. Drift serves only works the museum
          itself marks as public domain, with the artist, date, medium and
          dimensions from its catalogue, and it checks the licence the museum
          states on every response rather than assuming it.
        </P>
      </Section>

      <Section title="Current events">
        <P>
          Drift can wander the articles behind the month&apos;s stories without
          using a news source. Wikipedia&apos;s editors maintain a current events
          portal, one page per day, made of links to encyclopedia articles.
        </P>
        <P>
          Drift reads <Lead>only the link targets: </Lead>which articles are
          being pointed at, how often, and in which section. No headline or
          reporting is fetched, stored or shown. So &ldquo;in the news&rdquo; is
          the same CC BY-SA encyclopedia as the rest of the app, selected
          differently. There is a longer note on{" "}
          <A href="/notes/reading-the-news-without-a-news-api">
            why it works that way
          </A>
          .
        </P>
      </Section>

      <Section title="What the software does">
        <P>
          Drift cuts an article into a card, works out which related pages to
          offer as threads, labels each thread as nearby or a tangent, and orders
          batches for variety so you do not get five near-identical pages in a
          row.
        </P>
        <P>
          It does not write the facts. No sentence on a card is generated. Where
          a language model is involved it runs locally, is optional, and is
          limited to labelling and ordering material a person already wrote;
          switch it off and the app behaves the same. That rule is on the{" "}
          <A href="/principles">principles</A> page.
        </P>
      </Section>

      <Section title="Corrections">
        <P>
          If something on a card is wrong, it is most likely wrong at the source,
          and the better fix is to correct it there. Wikipedia can be edited by
          anyone, and a fix there reaches everyone rather than just Drift. Every
          card links to its article.
        </P>
        <P>
          If Drift itself is at fault, for example misattributing something,
          mislabelling a thread, or showing an image it should not,{" "}
          <A href="/contact">let me know</A>.
        </P>
      </Section>

      <Section title="Independence">
        <P>
          Drift is an independent project. It is not affiliated with, endorsed by
          or sponsored by the Wikimedia Foundation or The Art Institute of
          Chicago. It uses their names only to say where the content came from.
        </P>
      </Section>
    </PublicPage>
  );
}
