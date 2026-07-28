import type { ContentLicense } from "@/lib/licenses";

// A licence notice inside a sentence: names the licence and links its text,
// which is what reusing CC BY-SA content requires of the notice (WMF Terms of
// Use §7 — see lib/licenses.ts for the full reasoning). Presentational and
// hook-free, so it works in the server-rendered support pages and the footer
// alike. The card's own notice is styled differently and lives in CardView.
export function LicenseLink({ license }: { license: ContentLicense }) {
  return (
    <a
      href={license.url}
      target="_blank"
      rel="license noopener noreferrer"
      className="underline decoration-ink/30 underline-offset-2 transition hover:text-accent-strong hover:decoration-accent"
    >
      {license.label}
    </a>
  );
}
