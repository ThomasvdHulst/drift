import { describe, it, expect, afterEach } from "vitest";
import { imprint } from "./imprint";
import { contactAddress, PUBLIC_CONTENT_ROUTES, isPublicRoute } from "./site";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CONTACT_ADDRESS;
});

// Article 3:15d(1) BW lists what has to be easily, directly and permanently
// accessible. Dutch enforcement practice is strict about it: a trade name alone
// is not enough, because trade names need not be registered, and burying the
// identity in general terms and conditions does not count. So each required item
// is pinned rather than left to whoever next edits the page.
describe("the imprint carries what Article 3:15d BW requires", () => {
  const d = imprint();

  it("names the legal person, not only the trade name", () => {
    expect(d.legalName).toBe("Thomas van der Hulst");
    expect(d.tradeName).toBe("Usedrift");
    // Both trade names on the registration, so a reader who looks the KvK number
    // up and finds a different name is not left wondering.
    expect(d.alsoTradingAs).toBe("RiskOptimix");
  });

  it("gives a full establishment address", () => {
    expect(d.address).toEqual([
      "Uilenstede 138",
      "1183 AN Amstelveen",
      "Netherlands",
    ]);
  });

  it("gives the trade register number", () => {
    expect(d.kvk).toMatch(/^\d{8}$/);
    expect(d.kvk).toBe("90992318");
  });

  it("gives an email address, and the same one the DSA contact points use", () => {
    expect(d.email).toBe(contactAddress());
    expect(d.email).toContain("@");
  });

  // Sub (f) is conditional: the VAT number is required only "voor zover" a
  // VAT-liable activity is carried on. Drift is free, carries no advertising and
  // earns nothing, so none is published and /legal says why. This test exists to
  // make the omission deliberate rather than forgotten: it fails the day someone
  // adds a number without also removing the explanation.
  it("publishes no VAT number while there is no VAT-liable activity", () => {
    expect(d.vat).toBeUndefined();
  });

  it("is reachable signed out and listed for search engines", () => {
    expect(isPublicRoute("/legal")).toBe(true);
    expect([...PUBLIC_CONTENT_ROUTES]).toContain("/legal");
  });
});

describe("contactAddress", () => {
  it("defaults to the routed address the owner confirmed works", () => {
    expect(contactAddress()).toBe("contact@usedrift.org");
  });

  it("is overridable for another deployment", () => {
    process.env.NEXT_PUBLIC_CONTACT_ADDRESS = "  hello@example.test  ";
    expect(contactAddress()).toBe("hello@example.test");
  });

  it("falls back rather than publishing an empty contact point", () => {
    process.env.NEXT_PUBLIC_CONTACT_ADDRESS = "   ";
    expect(contactAddress()).toBe("contact@usedrift.org");
  });
});
