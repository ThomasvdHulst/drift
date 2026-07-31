import { NotePage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";
import { noteBySlug } from "@/lib/notes";

const SLUG = "why-drift-exists";
const note = noteBySlug(SLUG)!;

export const metadata = {
  title: note.title,
  description: note.description,
  alternates: { canonical: `/notes/${SLUG}` },
};

export default function Note() {
  return (
    <NotePage slug={SLUG}>
      <Section title="The complaint">
        <P>
          The starting point was not very original: I would spend half an hour in
          a feed and afterwards could not have told you much about what I had
          seen. Cutting down on it did not really help, because the amount was
          not the thing bothering me. Half an hour of reading something I had
          chosen would have been fine.
        </P>
        <P>
          So the question I ended up with was whether a feed could work
          differently, rather than whether I should use one less.
        </P>
      </Section>

      <Section title="What those feeds are good at">
        <P>
          Worth being specific, because the mechanics are well understood and
          they are not accidental. Three things do most of the work:
        </P>
        <Bullets>
          <li>
            <Lead>Variable reward. </Lead>You do not know whether the next item
            will be worth it. The uncertainty is what keeps you pulling.
          </li>
          <li>
            <Lead>No end. </Lead>There is no last item and no point at which the
            thing is finished, so stopping is always an interruption rather than
            a completion.
          </li>
          <li>
            <Lead>Hidden selection. </Lead>You choose from what you are shown,
            and you cannot see how that set was picked.
          </li>
        </Bullets>
      </Section>

      <Section title="What Drift does instead">
        <P>
          Roughly, it inverts each of those, and then does not trade them back
          when something easier comes along.
        </P>
        <P>
          <Lead>Visible options instead of uncertainty. </Lead>Each card shows a
          few labelled directions you can go next. You are picking rather than
          finding out. This works less well than variable reward at holding
          attention, which is the intended trade.
        </P>
        <P>
          <Lead>A defined end instead of an open one. </Lead>A session starts
          somewhere you chose, wanders, and finishes with a map of where it went.
          The map is only reachable by stopping.
        </P>
        <P>
          <Lead>A stated reason instead of a hidden one. </Lead>Each card says
          why it is there: the thread you pulled, the field you picked, or
          &ldquo;drifting&rdquo; when nothing was chosen. The rule I use when
          deciding whether to build something is whether its reason fits in four
          words on a card. That rules out more than anything else does.
        </P>
      </Section>

      <Section title="The trail map">
        <P>
          This was meant to be a small closing screen and ended up being the part
          I use most. Seeing a session drawn out, with the stops and which
          threads were pulled, makes it easier to remember afterwards than a list
          of pages would be.
        </P>
        <P>
          It also sits in an awkward place commercially: the most interesting
          thing in the app is behind the decision to stop using it. Moving it
          earlier would almost certainly increase how long people stay, and would
          remove the reason it works.
        </P>
      </Section>

    </NotePage>
  );
}
