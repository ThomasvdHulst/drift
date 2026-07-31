import { NotePage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";
import { noteBySlug } from "@/lib/notes";

const SLUG = "measuring-a-palette-you-designed-by-eye";
const note = noteBySlug(SLUG)!;

export const metadata = {
  title: note.title,
  description: note.description,
  alternates: { canonical: `/notes/${SLUG}` },
};

export default function Note() {
  return (
    <NotePage slug={SLUG}>
      <Section title="The audit">
        <P>
          Drift&apos;s palette was picked by eye over a couple of evenings: warm
          off-white instead of white, ink-dark text, one muted sage accent, and a
          dark mode of warm grey rather than black. I never checked it against
          the accessibility standard the app claims to meet.
        </P>
        <P>
          When I did, 258 pieces of text on the site were below the bar.
        </P>
      </Section>

      <Section title="What the standard asks for">
        <P>
          WCAG 2.2 Level AA is a short list of ratios between two colours:
        </P>
        <Bullets>
          <li>
            <Lead>Body text: 4.5 to 1 </Lead>against its background. Large text
            gets 3 to 1.
          </li>
          <li>
            <Lead>The boundary of a control: 3 to 1, </Lead>so you can see where
            a text box is.
          </li>
          <li>
            <Lead>A visible focus indicator </Lead>at every tab stop.
          </li>
        </Bullets>
        <P>
          The useful property is that none of it is a matter of taste. It also
          explains why the problems had gone unnoticed: low contrast does not
          look broken, it looks restrained. Soft grey on cream reads as a design
          decision until someone uses it outdoors.
        </P>
      </Section>

      <Section title="The dark mode tiles">
        <P>
          The largest single problem was the grid of field tiles on the home
          screen, each tinted with its own hue. In light mode those tints are
          pale washes over cream and they work. In dark mode the same pale tints
          were being mixed into the dark background, and mixing something pale
          into something dark gives a mid-tone, which is the worst case: too
          light for light text, too dark for dark text.
        </P>
        <P>
          Measured, the tile label was at 3.42 to 1 and its description at 2.22
          to 1, against a 4.5 bar.
        </P>
        <P>
          Reducing the tint strength does not fix it. Weaken it enough for the
          text to pass and the tiles stop being distinguishable from each other,
          which fails a different requirement. There is no value where both hold,
          so the mixing approach had to go.
        </P>
        <P>
          Instead the dark face is derived from the authored hue rather than
          mixed with the background: same hue and saturation, re-lit for a dark
          surface in a colour space where lightness is a separable axis. Text
          clears at 9.17 and 5.94, and the tiles are also easier to tell apart
          than before, which I had not expected.
        </P>
      </Section>

      <Section title="Two checks, because one is not enough">
        <P>
          The fix was the smaller part of the work. Keeping it fixed needs two
          separate checks, and the reason they are separate matters.
        </P>
        <P>
          <Lead>A unit test reads the palette </Lead>out of the stylesheet and
          computes the ratios. Fast, runs on every commit, and catches a retuned
          colour on its own.
        </P>
        <P>
          <Lead>A browser sweep measures rendered pixels. </Lead>It opens every
          page in both themes and reads the actual colours. This exists because
          the token values are not the whole truth: text at 75 percent opacity
          over a tinted surface inside a translucent card has a real ratio that
          you cannot get by reasoning about the underlying values.
        </P>
        <P>
          The dark tiles were exactly that case. The ink and the tint were both
          legal on their own; only the composite failed, and only the second
          check could see it.
        </P>
      </Section>

      <Section title="Notes for next time">
        <P>
          Measure early. The 258 failures were not 258 mistakes, they were about
          six decisions repeated everywhere, so fixing them at the token layer
          fixed 37 buttons at once. Doing it in the first week would have been an
          afternoon.
        </P>
        <P>
          The other thing, which I was not expecting: the constraint improved the
          dark mode rather than compromising it. The derived tiles are both more
          legible and more distinct than the ones I made by hand.
        </P>
        <P>
          Both checks now run before anything ships. Some of the other decisions
          behind the look are on <A href="/colophon">the colophon</A>.
        </P>
      </Section>
    </NotePage>
  );
}
