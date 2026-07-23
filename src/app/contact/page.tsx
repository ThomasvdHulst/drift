import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { PublicFooter } from "@/components/PublicFooter";

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
      </main>

      <PublicFooter />
    </div>
  );
}
