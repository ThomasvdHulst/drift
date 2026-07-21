import { describe, it, expect } from "vitest";
import { renderEmail } from "./render";
import {
  confirmSignupTemplate,
  resetPasswordTemplate,
  welcomeEmail,
  goodbyeEmail,
  contactReceiptEmail,
  contactNotificationEmail,
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

describe("renderEmail quote block", () => {
  it("is omitted unless a quote is given", () => {
    const plain = renderEmail({ preheader: "p", heading: "h", body: ["b"] });
    expect(plain).not.toContain("white-space:pre-wrap");
  });

  it("renders the quoted text and its optional label", () => {
    const html = renderEmail({
      preheader: "p",
      heading: "h",
      body: ["b"],
      quote: { label: "Your message", text: "I love the trail maps." },
    });
    expect(html).toContain("Your message");
    expect(html).toContain("I love the trail maps.");
  });

  it("preserves the author's line breaks as <br>", () => {
    const html = renderEmail({
      preheader: "p",
      heading: "h",
      body: ["b"],
      quote: { text: "line one\nline two\r\nline three" },
    });
    expect(html).toContain("line one<br>line two<br>line three");
  });

  // The quote block is the ONE place in these emails that carries text a stranger
  // typed, so it is the only real injection surface. It must be escaped before
  // newlines become markup.
  it("escapes HTML in quoted text so a submission cannot inject markup", () => {
    const html = renderEmail({
      preheader: "p",
      heading: "h",
      body: ["b"],
      quote: { text: '<script>alert("xss")</script> & <img src=x onerror=y>' },
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("escapes HTML in the quote label too", () => {
    const html = renderEmail({
      preheader: "p",
      heading: "h",
      body: ["b"],
      quote: { label: "<b>bold</b>", text: "hi" },
    });
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });
});

describe("email messages", () => {
  const sample = {
    name: "Ada",
    email: "ada@example.com",
    topicLabel: "Feedback",
    message: "The trail maps are lovely.",
  };
  const all = [
    confirmSignupTemplate(),
    resetPasswordTemplate(),
    welcomeEmail(),
    goodbyeEmail(),
    contactReceiptEmail(sample),
    contactNotificationEmail(sample),
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

describe("contact emails", () => {
  const sample = {
    name: "Ada",
    email: "ada@example.com",
    topicLabel: "Something is broken",
    message: "The Gallery cards do not load for me.",
  };

  it("the receipt echoes the sender's own message back to them", () => {
    const m = contactReceiptEmail(sample);
    expect(m.subject).toBe("Thanks for writing to Drift");
    expect(m.html).toContain("Hello Ada,");
    expect(m.html).toContain("The Gallery cards do not load for me.");
  });

  it("the receipt greets without a name when none was given", () => {
    const m = contactReceiptEmail({ ...sample, name: "" });
    expect(m.html).toContain("Hello,");
    expect(m.html).not.toContain("Hello ,");
  });

  it("the notification carries who wrote, the topic, and the message", () => {
    const m = contactNotificationEmail(sample);
    expect(m.subject).toBe("[Drift] Something is broken from Ada (ada@example.com)");
    expect(m.html).toContain("Ada &lt;ada@example.com&gt;");
    expect(m.html).toContain("The Gallery cards do not load for me.");
  });

  it("the notification has a plain-text alternative containing the message", () => {
    const m = contactNotificationEmail(sample);
    expect(m.text).toContain("The Gallery cards do not load for me.");
    expect(m.text).toContain("ada@example.com");
  });

  it("neither email lets a submitted message inject markup", () => {
    const nasty = { ...sample, name: "<b>x</b>", message: "<script>bad()</script>" };
    for (const m of [contactReceiptEmail(nasty), contactNotificationEmail(nasty)]) {
      expect(m.html).not.toContain("<script>");
      expect(m.html).not.toContain("<b>x</b>");
    }
  });
});
