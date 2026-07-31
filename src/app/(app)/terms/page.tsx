import type { ReactNode } from "react";
import { PublicPage, Section, P, Bullets, Lead, A } from "@/components/PublicPage";
import { TERMS, TERMS_EFFECTIVE, TERMS_INTRO } from "@/lib/terms";
import { parseInline } from "@/lib/inline";

export const metadata = {
  title: "Terms",
  description:
    "The rules for using Drift: what you may not do, how moderation works, how to report illegal content, and what happens if a rule is broken.",
  alternates: { canonical: "/terms" },
};

// The Terms of Service (compliance audit M-5). Required by DSA Article 14 for
// every intermediary service regardless of size, and it is also what makes the
// account relationship a contract, which is the Article 6(1)(b) GDPR basis
// /privacy relies on for nearly everything.
//
// The words live in lib/terms.ts, not here, so `/terms.md` can serve the same
// document verbatim. Article 14(1) wants the terms in "an easily accessible and
// machine-readable format"; two hand-maintained copies would satisfy that only
// until they disagreed.
export default function TermsPage() {
  return (
    <PublicPage
      title="Terms"
      intro={
        <>
          <span className="block text-xs uppercase tracking-wide">
            In force from {TERMS_EFFECTIVE}
          </span>
          <span className="mt-2 block">{TERMS_INTRO}</span>
        </>
      }
    >
      {TERMS.map((section) => (
        <Section key={section.id} title={section.heading}>
          {/* The anchor is on an empty span rather than the heading, so a link
              to a clause lands on it without PublicPage's Section having to know
              anything about terms. */}
          <span id={section.id} className="sr-only" />
          {section.blocks.map((block, i) =>
            "bullets" in block ? (
              <Bullets key={i}>
                {block.bullets.map((b, j) => (
                  <li key={j}>{inline(b)}</li>
                ))}
              </Bullets>
            ) : (
              <P key={i}>{inline(block.p)}</P>
            ),
          )}
        </Section>
      ))}

      <p className="border-t border-line pt-6 text-sm text-ink-soft">
        A plain-text copy of this page is at{" "}
        <A href="/terms.md">/terms.md</A>. Questions are welcome through{" "}
        <A href="/contact">the contact form</A>.
      </p>
    </PublicPage>
  );
}

/** Render one string of terms prose. `**strong**` becomes the shared `Lead`
 *  treatment (full-strength ink), which is the same lift the other public pages
 *  give a lead-in phrase. */
function inline(source: string): ReactNode {
  return parseInline(source).map((seg, i) => {
    if (seg.kind === "strong") return <Lead key={i}>{seg.text}</Lead>;
    if (seg.kind === "link")
      return (
        <A key={i} href={seg.href}>
          {seg.text}
        </A>
      );
    return <span key={i}>{seg.text}</span>;
  });
}
