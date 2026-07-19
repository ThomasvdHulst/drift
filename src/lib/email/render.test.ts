import { describe, it, expect } from "vitest";
import { renderEmail } from "./render";
import {
  confirmSignupTemplate,
  resetPasswordTemplate,
  welcomeEmail,
  goodbyeEmail,
} from "./messages";

describe("renderEmail", () => {
  const html = renderEmail({
    preheader: "preview text here",
    heading: "A calm heading",
    body: ["First paragraph.", "Second & <careful> paragraph."],
    cta: { label: "Do the thing", url: "https://example.com/go?a=1&b=2" },
    note: "a small note",
  });

  it("is a full HTML document with the heading and preheader", () => {
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("A calm heading");
    expect(html).toContain("preview text here");
  });

  it("includes the CTA label and its href verbatim", () => {
    expect(html).toContain("Do the thing");
    expect(html).toContain('href="https://example.com/go?a=1&b=2"');
  });

  it("escapes body text (no raw angle brackets from content)", () => {
    expect(html).toContain("Second &amp; &lt;careful&gt; paragraph.");
  });

  it("references the brand logo as an absolute URL", () => {
    expect(html).toMatch(/https?:\/\/[^"']+\/brand\/drift-logo\.png/);
  });

  it("omits the CTA block when no cta is given", () => {
    const plain = renderEmail({ preheader: "p", heading: "h", body: ["b"] });
    expect(plain).not.toContain("border-radius:9999px;background:");
  });
});

describe("email messages", () => {
  const all = [
    confirmSignupTemplate(),
    resetPasswordTemplate(),
    welcomeEmail(),
    goodbyeEmail(),
  ];

  it("each has a subject and non-empty html", () => {
    for (const m of all) {
      expect(m.subject.length).toBeGreaterThan(3);
      expect(m.html).toContain("<!DOCTYPE html>");
    }
  });

  it("the Supabase templates carry the ConfirmationURL placeholder verbatim", () => {
    expect(confirmSignupTemplate().html).toContain("{{ .ConfirmationURL }}");
    expect(resetPasswordTemplate().html).toContain("{{ .ConfirmationURL }}");
  });

  it("no em or en dashes in any subject or body copy (user preference)", () => {
    for (const m of all) {
      expect(m.subject).not.toMatch(/[—–]/);
      // Strip tags/styles; check only the visible-ish text for dashes.
      expect(m.html).not.toMatch(/[—–]/);
    }
  });
});
