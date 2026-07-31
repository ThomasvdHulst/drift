// GET /terms.md — the Terms of Service as Markdown.
//
// DSA Article 14(1) requires the terms to be publicly available "in an easily
// accessible and machine-readable format". The HTML page at /terms is the one
// people read; this is the same document, from the same registry, as a plain
// file anything else can consume. Because both surfaces render lib/terms.ts,
// they cannot say different things.
//
// Public and uncached-by-user: it carries no personal data and never reads the
// session, so the shared-CDN cache below is safe (compliance audit M-10).

import { TERMS, TERMS_EFFECTIVE, TERMS_INTRO } from "@/lib/terms";
import { absolutizeLinks } from "@/lib/inline";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const origin = siteUrl();
  const abs = (s: string) => absolutizeLinks(s, origin);

  const lines: string[] = [
    "# Drift: Terms of Service",
    "",
    `In force from ${TERMS_EFFECTIVE}.`,
    "",
    TERMS_INTRO,
    "",
    `Canonical version: ${origin}/terms`,
    "",
  ];

  for (const section of TERMS) {
    lines.push(`## ${section.heading}`, "");
    for (const block of section.blocks) {
      if ("bullets" in block) {
        for (const b of block.bullets) lines.push(`- ${abs(b)}`);
      } else {
        lines.push(abs(block.p));
      }
      lines.push("");
    }
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
