// Pure, dependency-free renderer for Drift's transactional emails. Kept import-free
// so it can be reused at runtime (welcome / goodbye) AND to generate the static
// Supabase auth templates (confirm / reset) from one source of truth.
//
// Email HTML is its own dialect: no flexbox/grid, no external CSS, no web fonts you
// can rely on. So this uses nested tables, fully inline styles, an email-safe serif
// (Georgia, evoking Fraunces) for the display heading, and an absolute-URL PNG logo
// (email clients need absolute image URLs). The look mirrors the app's "quiet
// reading room": warm cream card, ink text, one sage accent. No em/en dashes.

// Canonical site + asset origin. The logo must be an absolute HTTPS URL served by
// the app (public/brand/drift-logo.png). Overridable for a different deployment.
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.usedrift.org").replace(
  /\/$/,
  "",
);

const LOGO_URL = `${SITE}/brand/drift-logo.png`;

// Brand palette (from logos/README.txt + the app tokens).
const C = {
  mat: "#efe8da", // outer background (a touch deeper than paper)
  card: "#fbf7ef", // the paper-raised card
  ink: "#2a2723", // headings / strong text
  soft: "#6f665b", // body / secondary text
  sage: "#4f6d55", // accent: button + links
  onSage: "#fbf7ef", // text on the sage button
  line: "#e4dbcb", // hairline
};

const SERIF =
  "Georgia, 'Iowan Old Style', 'Times New Roman', Times, serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface EmailOptions {
  /** Hidden preview text shown in the inbox list. */
  preheader: string;
  /** Serif display heading. */
  heading: string;
  /** One or more body paragraphs (plain text; not HTML). */
  body: string[];
  /** Optional call-to-action button. */
  cta?: { label: string; url: string };
  /** Optional small note under the body (e.g. "if you didn't request this..."). */
  note?: string;
}

// Minimal HTML escaping for any text we drop into the markup. Our copy is trusted,
// but escaping keeps it safe if a value ever comes from user input, and is correct
// for characters like & in URLs/text.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A bulletproof, table-based button that renders across email clients. The URL is
// NOT escaped for '&' inside placeholders like {{ .ConfirmationURL }} (those must
// survive verbatim for Supabase), so callers pass a clean URL or a placeholder.
function button(label: string, url: string): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 0;">
        <tr>
          <td align="center" style="border-radius:9999px;background:${C.sage};">
            <a href="${url}" target="_blank" style="display:inline-block;padding:13px 32px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;color:${C.onSage};text-decoration:none;border-radius:9999px;">${esc(
              label,
            )}</a>
          </td>
        </tr>
      </table>`;
}

/** Render a complete transactional email document as an HTML string. */
export function renderEmail(opts: EmailOptions): string {
  const paragraphs = opts.body
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.soft};">${esc(
          p,
        )}</p>`,
    )
    .join("\n            ");

  const cta = opts.cta
    ? `<tr><td align="center" style="padding:8px 40px 4px;">${button(
        opts.cta.label,
        opts.cta.url,
      )}</td></tr>`
    : "";

  const note = opts.note
    ? `<tr><td style="padding:12px 40px 0;"><p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.soft};">${esc(
        opts.note,
      )}</p></td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${esc(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.mat};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(
    opts.preheader,
  )}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.mat};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.line};border-radius:16px;">
          <tr>
            <td style="padding:36px 40px 4px;text-align:center;">
              <img src="${LOGO_URL}" width="132" alt="Drift" style="display:block;margin:0 auto;width:132px;max-width:60%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 4px;text-align:center;">
              <h1 style="margin:0;font-family:${SERIF};font-size:27px;line-height:1.2;font-weight:400;color:${C.ink};">${esc(
                opts.heading,
              )}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 0;">
            ${paragraphs}
            </td>
          </tr>
          ${cta}
          ${note}
          <tr>
            <td style="padding:28px 40px 36px;">
              <hr style="border:none;border-top:1px solid ${C.line};margin:0 0 16px;">
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.soft};text-align:center;">
                Drift. A calm corner of the internet, for the curious.<br>
                <a href="${SITE}" target="_blank" style="color:${C.sage};text-decoration:none;">usedrift.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const EMAIL_SITE_URL = SITE;
