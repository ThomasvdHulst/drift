import { describe, it, expect } from "vitest";
import {
  parseImageCredit,
  mayDisplayImage,
  creditLine,
  isPublicDomainLicense,
  plainText,
} from "./imagecredit";

/** Shape `extmetadata` the way the API actually returns it. */
const meta = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));

describe("plainText", () => {
  it("strips the HTML Wikimedia embeds in Artist", () => {
    expect(
      plainText('<a href="//commons.wikimedia.org/wiki/User:X" title="X">Diego Delso</a>'),
    ).toBe("Diego Delso");
    expect(plainText("<bdi>Katsushika&nbsp;Hokusai</bdi>")).toBe("Katsushika Hokusai");
    expect(plainText("Foo &amp; Bar")).toBe("Foo & Bar");
  });

  it("returns empty for markup that reduces to nothing, and for non-strings", () => {
    expect(plainText("<span></span>")).toBe("");
    expect(plainText(undefined)).toBe("");
    expect(plainText(42)).toBe("");
  });
});

describe("isPublicDomainLicense", () => {
  it("recognises the no-attribution families", () => {
    for (const n of ["CC0", "CC0 1.0", "Public domain", "PD-US", "PD-old-70", "No restrictions"]) {
      expect(isPublicDomainLicense(n), n).toBe(true);
    }
  });

  it("does not mistake an attribution licence for one", () => {
    for (const n of ["CC BY-SA 4.0", "CC BY 2.0", "GFDL", "CC BY-SA 3.0", undefined]) {
      expect(isPublicDomainLicense(n), String(n)).toBe(false);
    }
  });
});

describe("parseImageCredit", () => {
  it("reads a CC BY-SA file", () => {
    const c = parseImageCredit(
      meta({
        Artist: '<a href="#">Diego Delso</a>',
        LicenseShortName: "CC BY-SA 4.0",
        LicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
        ObjectName: "Catedral de Sevilla",
        AttributionRequired: "true",
      }),
      "https://commons.wikimedia.org/wiki/File:Sevilla.jpg",
    );
    expect(c.artist).toBe("Diego Delso");
    expect(c.licenseShortName).toBe("CC BY-SA 4.0");
    expect(c.attributionRequired).toBe(true);
    expect(c.fileUrl).toContain("File:Sevilla.jpg");
    expect(mayDisplayImage(c)).toBe(true);
    expect(creditLine(c)).toBe("Diego Delso · CC BY-SA 4.0");
  });

  it("prefers the licensor's own requested credit string over Artist", () => {
    // CC BY-SA 4.0 §3(a)(1)(A)(i): attribution in any reasonable manner REQUESTED.
    const c = parseImageCredit(
      meta({
        Artist: "SomeUploader",
        Attribution: "Photo by J. Smith, courtesy of the Smith Archive",
        LicenseShortName: "CC BY 4.0",
      }),
    );
    expect(creditLine(c)).toBe(
      "Photo by J. Smith, courtesy of the Smith Archive · CC BY 4.0",
    );
  });

  it("treats a public domain licence as needing no attribution", () => {
    const c = parseImageCredit(meta({ LicenseShortName: "Public domain" }));
    expect(c.attributionRequired).toBe(false);
    expect(mayDisplayImage(c)).toBe(true);
    expect(creditLine(c)).toBe("Public domain");
  });

  it("honours an explicit AttributionRequired=false", () => {
    for (const v of ["false", "0", "no", false]) {
      const c = parseImageCredit(
        meta({ LicenseShortName: "CC BY-SA 4.0", AttributionRequired: v }),
      );
      expect(c.attributionRequired, String(v)).toBe(false);
    }
  });

  // The safe direction: a missing flag means we do not know, and not knowing must
  // never quietly become "no credit needed".
  it("assumes attribution IS required when the flag is absent", () => {
    const c = parseImageCredit(meta({ LicenseShortName: "CC BY-SA 4.0" }));
    expect(c.attributionRequired).toBe(true);
  });

  it("survives a missing or malformed extmetadata block", () => {
    for (const bad of [undefined, null, {}, "nonsense", 7]) {
      const c = parseImageCredit(bad);
      expect(c.attributionRequired).toBe(true); // unknown ⇒ required
      expect(mayDisplayImage(c)).toBe(false); // ⇒ and therefore not displayable
    }
  });
});

describe("mayDisplayImage — the fail-closed rules", () => {
  it("refuses an image whose licence needs a credit we do not have", () => {
    const c = parseImageCredit(meta({ LicenseShortName: "CC BY-SA 4.0" }));
    expect(c.artist).toBeUndefined();
    expect(mayDisplayImage(c)).toBe(false);
  });

  it("refuses any image carrying Restrictions, even a public domain one", () => {
    // Restrictions flags trademark / personality rights: copyright-free is not
    // use-free, so the licence being permissive does not rescue it.
    const c = parseImageCredit(
      meta({
        LicenseShortName: "Public domain",
        Artist: "Anon",
        Restrictions: "trademarked",
      }),
    );
    expect(mayDisplayImage(c)).toBe(false);
  });

  it("refuses when nothing is known at all", () => {
    expect(mayDisplayImage(undefined)).toBe(false);
    expect(mayDisplayImage(null)).toBe(false);
  });

  it("allows a credited attribution-licence file and an uncredited PD one", () => {
    expect(
      mayDisplayImage(
        parseImageCredit(meta({ LicenseShortName: "CC BY 4.0", Artist: "A. Person" })),
      ),
    ).toBe(true);
    expect(
      mayDisplayImage(parseImageCredit(meta({ LicenseShortName: "CC0 1.0" }))),
    ).toBe(true);
  });
});

describe("creditLine", () => {
  it("returns null when there is genuinely nothing to say", () => {
    expect(creditLine(parseImageCredit(meta({})))).toBeNull();
  });

  it("gives the creator alone when the licence name is missing", () => {
    expect(creditLine(parseImageCredit(meta({ Artist: "A. Person" })))).toBe("A. Person");
  });
});
