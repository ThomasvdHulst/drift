import Link from "next/link";
import { Monogram } from "@/components/BrandLogo";
import { CC_BY_SA_4, CC0_1 } from "@/lib/licenses";
import { LicenseLink } from "@/components/LicenseLink";

// A calm, shared footer for every PUBLIC (signed-out-reachable) page: the landing
// and the /about, /contact, /install, /privacy support pages. It gives each of
// those a consistent, clear set of links to the others (the "easy to navigate,
// with clear menus and links" a review looks for), plus the standard content
// licensing note and a plain ownership line. Presentational and hook-free, so it
// composes into both the client Landing and the server-rendered support pages.

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/install", label: "Install" },
  { href: "/privacy", label: "Privacy" },
];

export function PublicFooter() {
  // Server- and client-safe: getFullYear is deterministic, so it can't cause a
  // hydration mismatch on the pages that server-render (unlike Math.random/Date.now).
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line">
      {/* Bottom padding clears the fixed account + theme controls in the corner. */}
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-6 pb-20 pt-10 text-center">
        <Monogram className="h-6" />
        <nav
          aria-label="Site"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-ink-soft underline-offset-2 transition hover:text-accent-strong hover:underline"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {/* The standing licence notice. Both licences are LINKED, not merely
            named: reusing Wikipedia text requires a notice that reaches the
            licence text itself (WMF Terms of Use §7). See lib/licenses.ts. */}
        <p className="max-w-md text-xs leading-relaxed text-ink-soft">
          Content from Wikipedia, under <LicenseLink license={CC_BY_SA_4} />, and
          public domain artworks from the Art Institute of Chicago, under{" "}
          <LicenseLink license={CC0_1} />. Drift only reshapes it. It never
          invents facts.
        </p>
        <p className="text-xs text-ink-soft">
          © {year} Drift. A calm corner of the internet, for the curious.
        </p>
      </div>
    </footer>
  );
}
