import { PublicPage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";

export const metadata = {
  title: "Colophon",
  description:
    "Who builds Drift, what it is built with, and the reasoning behind a few of the technical choices.",
  alternates: { canonical: "/colophon" },
};

// Who made it and how. Short on purpose: it exists so a reader can see there is a
// person and a set of ordinary decisions behind the app.
export default function ColophonPage() {
  return (
    <PublicPage
      title="Colophon"
      intro={<>Who builds Drift, what it is made of, and why.</>}
    >
      <Section title="Who">
        <P>
          Drift is built and maintained by one person, Thomas, in the
          Netherlands. There is no company or team behind it. It started as a
          way to find out whether a feed could work differently, which needed
          building one and using it for a while.
        </P>
        <P>
          Practically, that means replies come from me and can take a few days,
          and things break occasionally. The ones worth writing up end up in{" "}
          <A href="/notes">notes</A>.
        </P>
      </Section>

      <Section title="What it is built with">
        <Bullets>
          <li>
            <Lead>A web app rather than a native one. </Lead>Next.js and React,
            installable to a home screen. One codebase, no app store.
          </li>
          <li>
            <Lead>Local first. </Lead>A session lives in the browser&apos;s own
            database; the cloud is a sync layer on top, so the app keeps working
            when it is unreachable.
          </li>
          <li>
            <Lead>Postgres with row level security. </Lead>The rule that you can
            only read your own rows is enforced by the database rather than by
            the application code above it.
          </li>
          <li>
            <Lead>Trail maps in plain SVG, </Lead>drawn in React and exported to
            an image in the browser.
          </li>
        </Bullets>
      </Section>

      <Section title="Two choices worth explaining">
        <P>
          <Lead>Everything goes through Drift&apos;s own server. </Lead>The
          browser never calls Wikipedia directly. Partly etiquette, since a
          browser cannot send the identifying header Wikimedia asks API clients
          for, and partly so there is one place to filter out pages that make
          poor cards: disambiguation stubs, list pages, anything with no real
          text.
        </P>
        <P>
          <Lead>The palette is checked rather than assumed. </Lead>Drift targets
          WCAG 2.2 AA contrast, verified two ways: a test that reads the colour
          values, and a sweep that opens every page in both themes and measures
          rendered pixels. The second exists because the first cannot see what
          happens when a translucent tint lands on a dark surface. There is a{" "}
          <A href="/notes/measuring-a-palette-you-designed-by-eye">
            note on the audit
          </A>{" "}
          that prompted it.
        </P>
      </Section>

      <Section title="Type and look">
        <P>
          Warm off-white rather than white, ink-dark text, one muted accent used
          sparingly, and a dark mode of warm grey rather than black. Titles in a
          serif, body text in a sans, both at a generous line height.
        </P>
      </Section>

      {/* The per-image credits for the illustrations on the public pages. These
          are HOSTED COPIES on our own origin, unlike card images, which are
          linked from the source. They appear as small trail-map thumbnails and
          demo cards, where a credit beside each one is not a workable medium, so
          they are collected here and the footer links to this section. CC BY 4.0
          §3(a)(2) allows attribution "by providing a URI or hyperlink to a
          resource that includes the required information".

          The Hubble pair is the reason this section exists. NASA publishes
          Hubble outreach imagery as not subject to copyright, and hubblesite.org
          now redirects to that policy; ESA publishes the same files under CC BY
          4.0. Crediting them satisfies both readings and costs nothing.
          See public/landing/CREDITS.md for the full record. */}
      <Section title="Illustrations">
        <span id="illustrations" className="sr-only" />
        <P>
          The pictures on the public pages are hosted here rather than linked
          from their source, so they are credited individually.
        </P>
        <Bullets>
          <li>
            <Lead>Art and antiquities. </Lead>The Art Institute of Chicago, under{" "}
            <A href="https://creativecommons.org/publicdomain/zero/1.0/">
              CC0 1.0
            </A>
            . No credit is required; the museum requests one and this is it.
          </li>
          <li>
            <Lead>Sea creatures. </Lead>Plates by Ernst Haeckel, who died in
            1919, so they are public domain in Europe and everywhere else.
          </li>
          <li>
            <Lead>Earthrise. </Lead>William Anders, Apollo 8, 1968. NASA.
          </li>
          <li>
            <Lead>Saturn and Jupiter. </Lead>NASA / JPL / Space Science
            Institute, from the Cassini mission.
          </li>
          <li>
            <Lead>The Pillars of Creation and the Whirlpool Galaxy. </Lead>NASA,
            ESA and the Hubble Heritage Team (STScI / AURA), under{" "}
            <A href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</A>
            .
          </li>
        </Bullets>
      </Section>

      <Section title="Thanks">
        <P>
          To the Wikipedia editors who wrote the content, to the Art Institute of
          Chicago for putting its collection in the public domain with a usable
          API, to NASA for putting a telescope&apos;s worth of pictures in the
          public domain, and to the people in the beta who reported what was
          broken.
        </P>
      </Section>
    </PublicPage>
  );
}
