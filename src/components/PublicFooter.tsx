import Link from "next/link";
import { Monogram } from "@/components/BrandLogo";
import { CC_BY_SA_4, CC0_1 } from "@/lib/licenses";
import { LicenseLink } from "@/components/LicenseLink";
import { CookieSettingsLink } from "@/components/ConsentGate";

// A calm, shared footer for every PUBLIC (signed-out-reachable) page: the landing
// and the explainer + support pages. It gives each of those a consistent, clear
// set of links to the others (the "easy to navigate, with clear menus and links"
// a review looks for), plus the standard content licensing note and a plain
// ownership line. Presentational and hook-free, so it composes into both the
// client Landing and the server-rendered pages.
//
// THIS IS THE ONLY PLACE the explainer pages are linked from, and it renders on
// the public pages only. A signed-in reader's home has its own short list (trails,
// atlas, interests, install, contact) and never sees this, so the reading section
// cannot turn their home screen into twenty buttons. Someone signed in who wants
// it can still reach every page: they are ordinary URLs, and /about links across.
//
// Two rows rather than one, because eleven links in a single wrapped line reads as
// a pile. The first row is the reading: what Drift is and how it thinks. The
// second is the small print.

const READ_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/principles", label: "Principles" },
  { href: "/sources", label: "Sources" },
  { href: "/faq", label: "FAQ" },
  { href: "/notes", label: "Notes" },
];

const UTILITY_LINKS: { href: string; label: string }[] = [
  { href: "/install", label: "Install" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/legal", label: "Legal" },
  { href: "/colophon", label: "Colophon" },
];

export function PublicFooter() {
  // Server- and client-safe: getFullYear is deterministic, so it can't cause a
  // hydration mismatch on the pages that server-render (unlike Math.random/Date.now).
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line">
      {/* Bottom padding clears the fixed account + theme controls in the corner. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-6 pb-20 pt-10 text-center">
        {/* The mark and the line that goes with it. This used to sit at the very
            bottom next to the copyright, where it was the fourth line of small
            print and read as legalese. It is brand, so it belongs with the
            brand. */}
        <div className="flex flex-col items-center gap-1.5">
          <Monogram className="h-6" />
          <p className="text-xs text-ink-soft">
            A calm corner of the internet, for the curious.
          </p>
        </div>
        <nav
          aria-label="Site"
          className="flex flex-col items-center gap-y-3"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            {READ_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-ink-soft underline-offset-2 transition hover:text-accent-strong hover:underline"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            {UTILITY_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-ink-soft underline-offset-2 transition hover:text-accent-strong hover:underline"
              >
                {l.label}
              </Link>
            ))}
            {/* Withdrawal has to be as easy as giving it, from every page
                (compliance audit B-1). Renders nothing while the ads switch is
                off, so the footer never offers to manage a choice that does not
                exist. It is a client component in an otherwise server-rendered
                footer, which is why it is the only entry here that is not a
                <Link>. */}
            <CookieSettingsLink className="text-ink-soft underline-offset-2 transition hover:text-accent-strong hover:underline" />
          </div>
        </nav>
        {/* The small print, in TWO blocks rather than four. Every element the
            compliance audit requires is still here; what changed is that they
            are no longer four stacked paragraphs of legalese on a page whose
            whole job is to feel quiet.

            1. The licence notice. Both licences are LINKED, not merely named:
               reusing Wikipedia text requires a notice that reaches the licence
               text itself (WMF Terms of Use §7). See lib/licenses.ts.
            2. The illustrations. Unlike card images these are HOSTED COPIES on
               our own origin, which makes them reproduction and distribution by
               us and the attribution position stricter (audit M-1). They appear
               as small trail-map thumbnails and demo cards, where a credit
               beside each one is not a workable medium, so the per-image credits
               live on /colophon and this links to them. CC BY 4.0 §3(a)(2)
               expressly allows attribution "by providing a URI or hyperlink to a
               resource that includes the required information", which is what
               this is. The enumeration that used to sit here was never the
               compliance mechanism, only a summary of it, so folding it into the
               link loses nothing. Per-file record: public/landing/CREDITS.md.
            3. The independence line. CC BY-SA 4.0 §2(a)(6) and the Wikimedia
               trademark policy both allow naming a source to say where content
               came from, but not implying an association with it. Drift's copy
               leans on words like "vetted" and "curated", which edges toward
               implying an editorial relationship, so this is cheap insurance
               (audit Mi-7). Kept as its own sentence, and it still names the
               Foundation rather than "Wikipedia", because the Foundation is who
               holds the marks. */}
        <p className="max-w-md text-xs leading-relaxed text-ink-soft">
          Content from Wikipedia, under <LicenseLink license={CC_BY_SA_4} />, and
          public domain artworks from The Art Institute of Chicago, under{" "}
          <LicenseLink license={CC0_1} />. Drift only reshapes it. It never
          invents facts. Illustrations on this site are{" "}
          <Link
            href="/colophon#illustrations"
            className="underline decoration-ink/30 underline-offset-2 transition hover:text-accent-strong"
          >
            credited in full on the colophon
          </Link>
          .
        </p>
        <p className="max-w-md text-xs leading-relaxed text-ink-soft">
          An independent project, not affiliated with, endorsed by or sponsored
          by the Wikimedia Foundation or The Art Institute of Chicago. ©{" "}
          {year} Drift.
        </p>
      </div>
    </footer>
  );
}
