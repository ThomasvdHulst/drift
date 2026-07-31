import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Monogram } from "@/components/BrandLogo";
import { PublicFooter } from "@/components/PublicFooter";
import { noteBySlug, formatNoteDate } from "@/lib/notes";

// The shared shell for Drift's public reading pages (/about, /how-it-works,
// /principles, /sources, /faq, /colophon, /notes and each note). Lifted out of
// about/page.tsx, which had grown this markup first and would otherwise have been
// copied six times: one back link, one monogram, one column width, one footer.
//
// Server-only and hook-free, so every page using it stays a server component and
// server-renders its full text. That matters here beyond tidiness: these pages
// exist to be READ by people and by crawlers, and a crawler should not have to
// run JavaScript to find the words.

export function PublicPage({
  title,
  intro,
  backTo = { href: "/", label: "Home" },
  children,
}: {
  title: string;
  /** The standfirst under the title. Optional: a note supplies its own. */
  intro?: ReactNode;
  /** Where the top-left link goes. Notes point back at the index. */
  backTo?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:py-16">
        <header className="mb-8">
          <Link
            href={backTo.href}
            className="text-sm text-ink-soft transition hover:text-accent-strong"
          >
            ← {backTo.label}
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <Monogram className="h-8" />
            <h1 className="font-serif text-4xl text-ink">{title}</h1>
          </div>
          {intro ? (
            <div className="mt-3 text-base leading-relaxed text-ink-soft">
              {intro}
            </div>
          ) : null}
        </header>

        <div className="space-y-8 text-ink">{children}</div>
      </main>

      <PublicFooter />
    </div>
  );
}

/** One note, wrapped in the public shell: dated, titled from the registry, and
 *  linking back to the index rather than to the home page. Taking the title and
 *  date from `lib/notes.ts` (rather than repeating them in the page) is what
 *  keeps the index, the sitemap and the note itself saying the same thing. */
export function NotePage({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const note = noteBySlug(slug);
  if (!note) notFound(); // unreachable: notes.test.ts pins every slug to a page
  return (
    <PublicPage
      title={note.title}
      backTo={{ href: "/notes", label: "Notes" }}
      intro={
        <>
          <span className="block text-xs uppercase tracking-wide">
            {formatNoteDate(note.date)}
          </span>
          <span className="mt-2 block">{note.excerpt}</span>
        </>
      }
    >
      {children}
    </PublicPage>
  );
}

/** One titled section of a public page. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 font-serif text-2xl text-ink">{title}</h2>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

/** A body paragraph. `text-ink-soft` is the reading tone on these pages; it is
 *  the lowest passing ink token, so it never takes a further `/NN` (§10). */
export function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-ink-soft first:mt-0">{children}</p>;
}

/** A bulleted list in the same reading tone. */
export function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-soft first:mt-0">
      {children}
    </ul>
  );
}

/**
 * The lead-in phrase of a sentence or bullet, lifted to full-strength ink.
 *
 * CONVENTION: put the trailing space INSIDE the tag (`<Lead>Nearby </Lead>means`).
 * JSX drops the whitespace between an element and a following line in some
 * positions, so a space written outside can silently vanish and render as
 * "Nearbymeans". A space inside cannot: HTML collapses runs of whitespace, so it
 * is a single space whether or not the outer one survived.
 *
 * The rule has no exceptions on purpose. Where a comma or colon follows the
 * lead-in, put it inside the tag too (`<Lead>only the link targets: </Lead>`),
 * so there is never a `</Lead>` sitting directly against punctuation, which
 * would render as "targets ." Keeping one uniform rule is easier to hold than a
 * rule plus a carve-out.
 */
export function Lead({ children }: { children: ReactNode }) {
  return <span className="text-ink">{children}</span>;
}

/** An in-page link in the accent colour. `text-accent-strong` is the text-safe
 *  accent; plain `text-accent` is a non-text (3:1) colour (§10). */
export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("http");
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-strong hover:underline"
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="text-accent-strong hover:underline">
      {children}
    </Link>
  );
}
