import { PublicPage, Section, P, A } from "@/components/PublicPage";
import { imprint } from "@/lib/imprint";

export const metadata = {
  title: "Legal notice",
  description:
    "Who operates Drift: legal name, establishment address, Chamber of Commerce number, and how to reach them.",
  alternates: { canonical: "/legal" },
};

// The imprint required by Article 3:15d BW (compliance audit M-6). Deliberately
// short and unstyled: this page exists so that a user with a complaint, a
// rightsholder with a takedown demand, or a regulator with a question has
// somebody to write to in a legal capacity. Anything else on it gets in the way.
//
// The details live in lib/imprint.ts, so /privacy names the same controller.
export default function LegalPage() {
  const d = imprint();
  return (
    <PublicPage
      title="Legal notice"
      intro={<>Who operates Drift, and how to reach them.</>}
    >
      <Section title="Operator">
        <dl className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
          <Row label="Name">{d.legalName}</Row>
          <Row label="Trading as">
            {d.tradeName}, a registered trade name of the sole proprietorship
            also trading as {d.alsoTradingAs}
          </Row>
          <Row label="Establishment address">
            <span className="block">
              {d.address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </span>
          </Row>
          <Row label="Chamber of Commerce (KvK)">{d.kvk}</Row>
          <Row label="Email">
            <a
              href={`mailto:${d.email}`}
              className="text-accent-strong hover:underline"
            >
              {d.email}
            </a>
          </Row>
          {d.vat && <Row label="VAT identification number">{d.vat}</Row>}
        </dl>
        <P>
          Drift is run by one person. There is no company behind it and no team,
          which is also why replies can take a few days.
        </P>
      </Section>

      <Section title="Contacting the operator">
        <P>
          The fastest route is <A href="/contact">the contact form</A>, which a
          real person reads. The email address above reaches the same person and
          is the right one to use for anything that needs to go in writing, such
          as a legal notice or a request from an authority.
        </P>
        <P>
          That page also carries the single point of contact required by Articles
          11 and 12 of Regulation (EU) 2022/2065, the Digital Services Act, and
          the notice and action mechanism required by Article 16 for reporting
          content you believe is illegal.
        </P>
      </Section>

      <Section title="Value added tax">
        <P>
          No VAT identification number is published for Drift because Drift
          carries on no VAT-liable activity: it is free, it shows no advertising
          and it earns nothing. Article 3:15d(1)(f) BW requires the number only
          insofar as such an activity is carried on. If that changes, this page
          changes first.
        </P>
      </Section>

      <Section title="The rest of the paperwork">
        <P>
          <A href="/terms">The terms</A> are the agreement between you and the
          operator, and set out what is and is not allowed, how moderation works,
          and what happens if a rule is broken.{" "}
          <A href="/privacy">What Drift stores</A> is the privacy notice: what is
          kept about you, why it is allowed, who else sees it and for how long.{" "}
          <A href="/sources">Sources</A> explains where the content comes from
          and under which licences.
        </P>
      </Section>
    </PublicPage>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sm:flex sm:gap-4">
      <dt className="text-ink sm:w-56 sm:shrink-0">{label}</dt>
      <dd className="sm:flex-1">{children}</dd>
    </div>
  );
}
