import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { PublicFooter } from "@/components/PublicFooter";
import { contactAddress } from "@/lib/site";

export const metadata = {
  title: "Contact Drift",
  description: "Send feedback, report something broken, or just say hello.",
  alternates: { canonical: "/contact" },
};

// The contact page. Public (allowlisted in AuthGate) on purpose: someone who
// cannot sign in is exactly the person who most needs to reach us, so this must
// not sit behind the gate it might be about. Nothing pushy anywhere in the app
// asks for feedback; this is a page you choose to visit (§2).
export default function ContactPage() {
  const CONTACT_ADDRESS = contactAddress();
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-12 pt-12 sm:pt-16">
        <header>
          <Link
            href="/"
            className="text-sm text-ink-soft transition hover:text-accent-strong"
          >
            ← Home
          </Link>
          <h1 className="mt-2 font-serif text-4xl text-ink">Get in touch</h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-ink-soft">
            Drift is a small project, and a real person reads every message. Tell
            us what is working, what is broken, or what you wish it did. We reply
            to everything, usually within a few days.
          </p>
        </header>

        <div className="mt-8">
          <ContactForm />
        </div>

        {/* DSA Articles 11 and 12: a single point of contact for Member State
            authorities, the Commission and the Board (11), and a point of
            contact for recipients of the service allowing direct and rapid
            communication by electronic means (12). Both apply to every
            intermediary service with no size threshold, and both have to be
            PUBLISHED, not merely to exist. `/contact` already was the second
            one in substance; Article 12 wants it designated as such, so this
            says so in as many words. The address is written out rather than
            linked, because an authority writing to a provider needs an address
            it can put in a letter, and because the form is not always the right
            channel for one.

            The imprint required by Article 3:15d BW is a different obligation
            and lives on its own page, `/legal`, linked from the footer of every
            public page. It is not repeated here: 3:15d wants the operator's
            identity "easily, directly and permanently accessible", which one
            stable page linked everywhere satisfies better than the same block
            copied onto several. */}
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="font-serif text-xl text-ink">
            Official points of contact
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Single point of contact for the authorities of the Member States, the
            European Commission and the European Board for Digital Services under
            Articles 11 and 12 of Regulation (EU) 2022/2065:{" "}
            <a
              href={`mailto:${CONTACT_ADDRESS}`}
              className="text-accent-strong underline-offset-2 hover:underline"
            >
              {CONTACT_ADDRESS}
            </a>
            . Languages of communication: English and Dutch. Recipients of the
            service may use the same address, or the form above.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            To report content on Drift you believe is illegal, choose{" "}
            <span className="text-ink">Report illegal content</span> in the form
            above. That is the notice and action mechanism required by Article
            16, and how it is handled is set out in{" "}
            <Link
              href="/terms"
              className="text-accent-strong underline-offset-2 hover:underline"
            >
              the terms
            </Link>
            .
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
