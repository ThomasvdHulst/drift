import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { confirmSignupTemplate, resetPasswordTemplate } from "./messages";

// The two Supabase-sent emails live twice: as code here, and as static HTML in
// supabase/email-templates/ that a human pastes into the dashboard. Nothing at
// runtime reads those files, so without this they can silently rot apart — and
// the copy in the dashboard is the copy real people actually receive.
const dir = join(process.cwd(), "supabase", "email-templates");
const read = (f: string) => readFileSync(join(dir, f), "utf8").trim();

describe("Supabase email templates stay in sync with messages.ts", () => {
  it("confirm-signup.html matches the renderer", () => {
    expect(read("confirm-signup.html")).toBe(confirmSignupTemplate().html.trim());
  });

  it("reset-password.html matches the renderer", () => {
    expect(read("reset-password.html")).toBe(resetPasswordTemplate().html.trim());
  });
});

// The whole point of the 2026-07-27 auth fix: the emailed link must be
// redeemable in ANY browser. A `{{ .ConfirmationURL }}` link is not — it returns
// a PKCE `?code=` that only the browser which started the sign-up can exchange,
// which is what left people stranded on the homepage, signed out.
describe("email links are browser-independent", () => {
  const cases = [
    ["confirm signup", confirmSignupTemplate().html, "signup"],
    ["reset password", resetPasswordTemplate().html, "recovery"],
  ] as const;

  for (const [name, html, type] of cases) {
    it(`${name} points at /auth/confirm with a token_hash`, () => {
      expect(html).toContain("/auth/confirm?token_hash={{ .TokenHash }}");
      expect(html).toContain(`type=${type}`);
    });

    it(`${name} no longer uses the browser-bound ConfirmationURL`, () => {
      expect(html).not.toContain("{{ .ConfirmationURL }}");
    });

    it(`${name} escapes the ampersand, so the href is valid HTML`, () => {
      // Written as &amp; because the renderer inserts URLs verbatim.
      expect(html).toContain("{{ .TokenHash }}&amp;type=");
      expect(html).not.toMatch(/token_hash=\{\{ \.TokenHash \}\}&type=/);
    });
  }
});
