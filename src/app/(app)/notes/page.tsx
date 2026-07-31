import Link from "next/link";
import { PublicPage } from "@/components/PublicPage";
import { NOTES, formatNoteDate } from "@/lib/notes";

export const metadata = {
  title: "Notes",
  description:
    "Writing from building Drift: design decisions, things that broke, and why a calm feed is harder to make than a loud one.",
  alternates: { canonical: "/notes" },
};

// The journal index. Reads from the NOTES registry (lib/notes.ts), which is also
// what the sitemap submits, so publishing a note is one edit there plus its page.
export default function NotesPage() {
  return (
    <PublicPage
      title="Notes"
      intro={
        <>
          Occasional write-ups from building Drift: design decisions, things that
          broke, and how a few of the parts work. Added to when there is
          something worth recording.
        </>
      }
    >
      <ul className="space-y-6">
        {NOTES.map((n) => (
          <li key={n.slug}>
            <article>
              <p className="text-xs uppercase tracking-wide text-ink-soft">
                {formatNoteDate(n.date)}
              </p>
              <h2 className="mt-1 font-serif text-2xl leading-snug text-ink">
                <Link
                  href={`/notes/${n.slug}`}
                  className="underline-offset-4 transition hover:text-accent-strong hover:underline"
                >
                  {n.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {n.excerpt}
              </p>
              <Link
                href={`/notes/${n.slug}`}
                className="mt-2 inline-block text-sm text-accent-strong hover:underline"
              >
                Read this note →
              </Link>
            </article>
          </li>
        ))}
      </ul>
    </PublicPage>
  );
}
