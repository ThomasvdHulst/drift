import { describe, it, expect } from "vitest";
import {
  noticeReceiptEmail,
  noticeNotificationEmail,
  type ContactDetails,
} from "./messages";

// The two emails a DSA Article 16 notice produces. They are not courtesies:
//   16(4) — confirm receipt without undue delay where contact details were given
//   16(5) — notify the decision, "including information on the possibilities
//           for redress"
// The receipt is the 16(4) artefact and it is also where the 16(5) promise is
// made, so both obligations are on the record from the moment a notice arrives.

const notice: ContactDetails = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  topicLabel: "Report illegal content",
  message:
    "That handle uses my employer's registered trade mark and presents itself as their official account.",
  location: "@impostor, the display name",
  isReport: true,
};

const anonymous: ContactDetails = { ...notice, name: "", email: "" };

describe("noticeReceiptEmail (Article 16(4))", () => {
  it("confirms the notice arrived", () => {
    const mail = noticeReceiptEmail(notice);
    expect(mail.subject).toBe("We received your report");
    expect(mail.html).toContain("has been received");
  });

  it("promises the outcome and names a real avenue of redress (16(5))", () => {
    const mail = noticeReceiptEmail(notice);
    expect(mail.html).toMatch(/what was done and why/i);
    // A court and the Dutch Digital Services Coordinator are the two that
    // actually exist. Drift is not an online platform, so there is no Article 21
    // out-of-court dispute body to point at and none is claimed.
    expect(mail.html).toMatch(/court/i);
    expect(mail.html).toContain("Autoriteit Consument en Markt");
  });

  it("says the decision is not automated, because it is not", () => {
    expect(noticeReceiptEmail(notice).html).toMatch(/nothing about that decision is automated/i);
  });

  it("quotes back the location and the explanation", () => {
    const mail = noticeReceiptEmail(notice);
    expect(mail.html).toContain("@impostor");
    expect(mail.text).toContain("registered trade mark");
  });

  it("carries a plain-text alternative", () => {
    expect(noticeReceiptEmail(notice).text?.trim()).not.toBe("");
  });
});

describe("noticeNotificationEmail (the work item)", () => {
  it("is marked so it cannot be lost in a run of ordinary feedback", () => {
    expect(noticeNotificationEmail(notice).subject).toContain("ACTION");
  });

  it("carries everything Article 16(2) asked the notifier for", () => {
    const mail = noticeNotificationEmail(notice);
    expect(mail.text).toContain("Ada Lovelace"); // 16(2)(c) name and email
    expect(mail.text).toContain("ada@example.com");
    expect(mail.text).toContain("@impostor"); // 16(2)(b) location
    expect(mail.text).toContain("registered trade mark"); // 16(2)(a) explanation
    expect(mail.text).toMatch(/good faith/i); // 16(2)(d) statement
  });

  it("spells out what still has to happen, so the duty is not left in a spec", () => {
    const mail = noticeNotificationEmail(notice);
    expect(mail.text).toContain("16(5)");
    expect(mail.text).toContain("statement of reasons"); // Article 17
  });

  it("handles an anonymous notice without pretending it came from nobody", () => {
    const mail = noticeNotificationEmail(anonymous);
    expect(mail.subject).toContain("an anonymous notifier");
    expect(mail.text).toContain("From: Anonymous");
    // Nothing to confirm and nobody to notify, so the to-do must not tell the
    // operator to do either.
    expect(mail.text).toContain("nobody to notify");
    expect(mail.text).toContain("statement of reasons");
  });

  it("still reports a missing location honestly rather than as blank", () => {
    const mail = noticeNotificationEmail({ ...notice, location: undefined });
    expect(mail.text).toContain("Where: not given");
  });
});
