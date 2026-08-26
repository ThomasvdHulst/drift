import Link from "next/link";
import { Monogram } from "@/components/BrandLogo";
import { PublicFooter } from "@/components/PublicFooter";
import { SupporterBuy } from "@/components/SupporterBuy";
import { breakdown, formatEur } from "@/lib/billing/price";
import { REFUND_COOLDOWN_LABEL } from "@/lib/billing/cooldown";
import { imprint } from "@/lib/imprint";

export const metadata = {
  title: "Support Drift",
  description:
    "One payment, no subscription, no advertising. Lift the daily reading limit and keep a small project running.",
  alternates: { canonical: "/supporter" },
};

// ---------------------------------------------------------------------------
// The page that sells the supporter unlock, and the page that has to be honest
// about it (Phase 32).
//
// TWO JOBS, AND THE SECOND IS THE LEGAL ONE. It is the pitch, and it is also the
// pre-contractual information a trader owes a consumer before a distance
// contract (art. 6:230m BW / Consumer Rights Directive Art. 6): what the thing
// is, who is selling it, the total price with the tax named, how and when it is
// delivered, how long it lasts, and the right of withdrawal with how to use it.
// The "What you are buying" block below is that list, deliberately written as
// plain sentences rather than as a wall of clauses.
//
// WHAT THIS PAGE MUST NEVER DO. It must not sell "more scrolling". The daily
// allowance exists because a day's reading should end (§2.3), and the unlock
// exists because the project costs money to run. Those are separate arguments
// and merging them into "pay to keep going" is the casino's pitch with the
// serial numbers filed off. So the headline is about keeping Drift alive, the
// lifted limit is listed as a consequence rather than as the product, and there
// is no countdown, no scarcity, and no discount that expires.
//
// It is deliberately PUBLIC (allowlisted in lib/site.ts), so that somebody can
// read exactly what they would be paying for before making an account.
// ---------------------------------------------------------------------------

export default function SupporterPage() {
  const price = breakdown();
  const who = imprint();

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:py-16">
        <header className="mb-10">
          <Link
            href="/"
            className="focus-ring rounded text-sm text-ink-soft transition hover:text-accent-strong"
          >
            ← Home
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <Monogram className="h-8" />
            <h1 className="font-serif text-4xl text-ink">Support Drift</h1>
          </div>
          <p className="mt-4 text-base leading-relaxed text-ink/75">
            Drift is one person&rsquo;s project. It has no advertising, no
            tracking, no algorithm deciding what you see, and nothing in the feed
            but cards. Keeping it that way costs money, and this is the only
            thing here that asks you for any.
          </p>
        </header>

        <section className="rounded-2xl border border-line bg-paper-raised p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
            One payment
          </p>
          <p className="mt-1 font-serif text-3xl text-ink">
            {formatEur(price.grossCents)}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Including {price.ratePct}% BTW ({formatEur(price.vatCents)}). Not a
            subscription. Nothing renews and nothing recurs.
          </p>
          <div className="mt-5">
            <SupporterBuy />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-2xl text-ink">What it changes</h2>
          <ul className="mt-4 space-y-3 text-base leading-relaxed text-ink/75">
            <li>
              <span className="font-medium text-ink">
                The daily reading limit no longer applies.
              </span>{" "}
              Free reading has a generous allowance each day, because a day&rsquo;s
              reading should have an end. If you are someone who reads past it,
              this removes it.
            </li>
            <li>
              <span className="font-medium text-ink">
                Everything added to the unlock later is included,
              </span>{" "}
              at no extra cost. We are not promising particular features here,
              because promising things that do not exist yet is how software
              lies. We are promising that you will not be asked again.
            </li>
            <li>
              <span className="font-medium text-ink">
                Drift stays free of advertising.
              </span>{" "}
              This is the alternative to advertising, not an addition to it.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-2xl text-ink">What it does not change</h2>
          <p className="mt-4 text-base leading-relaxed text-ink/75">
            Nothing about how Drift reads. There is no supporter-only content, no
            better cards, no faster feed and no badge. The reading experience is
            the same one everybody gets, which is the point: what you are paying
            for is that it continues to exist, not a better seat.
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-line p-6">
          <h2 className="font-serif text-2xl text-ink">What you are buying</h2>
          <dl className="mt-4 space-y-4 text-sm leading-relaxed">
            <Row label="What it is">
              A one-time unlock on your Drift account that removes the daily
              reading limit, plus whatever is later added to the unlock.
            </Row>
            <Row label="Total price">
              {formatEur(price.grossCents)}, including {price.ratePct}% Dutch BTW
              of {formatEur(price.vatCents)}. That is the whole amount; there are
              no further charges and nothing renews.
            </Row>
            <Row label="How you pay">
              Through Stripe, with iDEAL or a card. Drift never receives or
              stores your payment details.
            </Row>
            <Row label="When it starts">
              Immediately after the payment is confirmed. You will get a receipt
              by email.
            </Row>
            <Row label="How long it lasts">
              For as long as Drift is running, and for at least twelve months
              from the day you buy it. It is attached to your account, so
              deleting your account ends it, and it does not transfer to a new
              one.
            </Row>
            <Row label="Changing your mind">
              You have fourteen days to withdraw, for any reason or none, and get
              the full amount back. You do not have to explain and you keep your
              access until the refund is made. Ask on your{" "}
              <Link
                href="/account"
                className="focus-ring rounded underline decoration-line underline-offset-2 hover:text-accent-strong"
              >
                account page
              </Link>{" "}
              or write to{" "}
              <a
                href={`mailto:${who.email}`}
                className="focus-ring rounded underline decoration-line underline-offset-2 hover:text-accent-strong"
              >
                {who.email}
              </a>
              . Most sellers of digital things take this right away with a
              consent box at checkout. Drift does not.
            </Row>
            {/* Stated BEFORE the sale, not discovered after one. It is a
                condition of buying, and art. 6:230m BW wants the conditions
                where the decision is made. It is not a limit on the refund and
                must never be written as though it were. */}
            <Row label="Buying again later">
              If you do get a refund, the unlock can be bought again after{" "}
              {REFUND_COOLDOWN_LABEL}. That is not a limit on the refund, which
              stays immediate and needs no reason. It is because a refund returns
              your payment but not the fee charged to take it, so buying and
              undoing repeatedly costs money with nothing changing. Your account
              page counts it down, and{" "}
              <Link
                href="/contact?topic=account"
                className="focus-ring rounded underline decoration-line underline-offset-2 hover:text-accent-strong"
              >
                a message
              </Link>{" "}
              lifts it sooner.
            </Row>
            <Row label="Who you are buying from">
              {who.legalName}, trading as {who.tradeName}, {who.address.join(", ")}
              . KVK {who.kvk}
              {who.vat ? `, BTW-id ${who.vat}` : ""}. Full details on the{" "}
              <Link
                href="/legal"
                className="focus-ring rounded underline decoration-line underline-offset-2 hover:text-accent-strong"
              >
                legal page
              </Link>
              .
            </Row>
            <Row label="If something is wrong">
              Write to{" "}
              <a
                href={`mailto:${who.email}`}
                className="focus-ring rounded underline decoration-line underline-offset-2 hover:text-accent-strong"
              >
                {who.email}
              </a>
              . Your statutory rights as a consumer are not affected by anything
              on this page or in the{" "}
              <Link
                href="/terms"
                className="focus-ring rounded underline decoration-line underline-offset-2 hover:text-accent-strong"
              >
                terms
              </Link>
              .
            </Row>
          </dl>
        </section>

        <p className="mt-10 text-sm leading-relaxed text-ink-soft">
          If you would rather not pay, that is completely fine. Drift is free to
          read every day and always will be, and nothing here will nag you about
          this again.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9.5rem_1fr] sm:gap-4">
      <dt className="font-medium text-ink">{label}</dt>
      <dd className="text-ink/75">{children}</dd>
    </div>
  );
}
