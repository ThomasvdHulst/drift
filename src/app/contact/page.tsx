import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";

export const metadata = {
  title: "Contact Drift",
  description: "Send feedback, report something broken, or just say hello.",
};

// The contact page. Public (allowlisted in AuthGate) on purpose: someone who
// cannot sign in is exactly the person who most needs to reach us, so this must
// not sit behind the gate it might be about. Nothing pushy anywhere in the app
// asks for feedback; this is a page you choose to visit (§2).
export default function ContactPage() {
  return (
    // Extra bottom padding so the submit button clears the floating account and
    // theme controls, which sit fixed at the bottom on every page.
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-6 pb-28 pt-12 sm:pt-16">
      <header>
        <Link
          href="/"
          className="text-sm text-ink-soft transition hover:text-accent-strong"
        >
          ← Home
        </Link>
        <h1 className="mt-2 font-serif text-4xl text-ink">Get in touch</h1>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-ink-soft">
          Drift is a small project, and a real person reads every message. Tell us
          what is working, what is broken, or what you wish it did. We reply to
          everything, usually within a few days.
        </p>
      </header>

      <div className="mt-8">
        <ContactForm />
      </div>
    </main>
  );
}
