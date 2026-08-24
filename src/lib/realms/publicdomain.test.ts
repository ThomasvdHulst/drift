import { describe, it, expect } from "vitest";
import {
  euPublicDomainCutoff,
  deathYearCleared,
  parseDeathYear,
  splitDeathYears,
  artworkEuPublicDomain,
  artistsOutOfCopyright,
  ANONYMOUS_CUTOFF_YEAR,
  type PdInput,
} from "./publicdomain";

const NOW = new Date("2026-07-31T00:00:00Z");
const CUTOFF = 1955; // 2026 - 71

/** An attributed work: one entry per hand, `null` where the year is unknown. */
const by = (deaths: (number | null)[], finishedYear?: number | null): PdInput => ({
  deathYears: deaths,
  attributed: true,
  finishedYear,
});

/** An unattributed work: nobody named, so only the date proxy can save it. */
const anon = (finishedYear?: number | null): PdInput => ({
  deathYears: [],
  attributed: false,
  finishedYear,
});

describe("euPublicDomainCutoff", () => {
  // Life plus 70, running from 31 December of the year of death. In 2026 that
  // reaches everyone who died in 1955: their term ran to the end of 2025.
  it("is the current year minus 71", () => {
    expect(euPublicDomainCutoff(NOW)).toBe(1955);
    expect(euPublicDomainCutoff(new Date("2027-01-01T00:00:00Z"))).toBe(1956);
  });

  it("widens by exactly one year each 1 January, with no edit", () => {
    const dec = euPublicDomainCutoff(new Date("2026-12-31T23:59:59Z"));
    const jan = euPublicDomainCutoff(new Date("2027-01-01T00:00:00Z"));
    expect(jan - dec).toBe(1);
  });
});

describe("deathYearCleared", () => {
  it("admits a death in or before the cut-off year", () => {
    expect(deathYearCleared(1926, CUTOFF)).toBe(true); // Monet
    expect(deathYearCleared(1955, CUTOFF)).toBe(true); // exactly on it
  });

  it("refuses a death after the cut-off", () => {
    expect(deathYearCleared(1956, CUTOFF)).toBe(false);
    expect(deathYearCleared(1970, CUTOFF)).toBe(false);
  });

  // The audit's worked example: US public domain, EU protected until 2041.
  it("refuses the exact profile the audit warned about", () => {
    expect(deathYearCleared(1970, CUTOFF)).toBe(false);
  });

  it("treats a missing, null or unparseable death year as not established", () => {
    expect(deathYearCleared(null, CUTOFF)).toBe(false);
    expect(deathYearCleared(undefined, CUTOFF)).toBe(false);
    expect(deathYearCleared(NaN, CUTOFF)).toBe(false);
  });
});

describe("parseDeathYear", () => {
  it("reads a plain year, as a number or a string", () => {
    expect(parseDeathYear(1926)).toBe(1926);
    expect(parseDeathYear("1926")).toBe(1926);
    expect(parseDeathYear(" 1926 ")).toBe(1926);
  });

  it("reads a BCE year as negative", () => {
    expect(parseDeathYear("-450")).toBe(-450);
  });

  // Museums write "unknown" as 0 rather than omitting the field, and a 0 that
  // was taken at face value would clear every cut-off there has ever been.
  it("treats 0 as not established, not as the year zero", () => {
    expect(parseDeathYear("0")).toBeNull();
    expect(parseDeathYear(0)).toBeNull();
  });

  it("refuses anything that is not a plain year", () => {
    expect(parseDeathYear("")).toBeNull();
    expect(parseDeathYear("ca. 1926")).toBeNull();
    expect(parseDeathYear("1926-1930")).toBeNull();
    expect(parseDeathYear(null)).toBeNull();
    expect(parseDeathYear(undefined)).toBeNull();
  });
});

describe("splitDeathYears", () => {
  // The Met returns one pipe-delimited field for a work with several hands.
  it("splits a pipe-delimited field into one entry per hand", () => {
    expect(splitDeathYears("1757|1830")).toEqual([1757, 1830]);
  });

  it("keeps an unresolvable hand as null rather than dropping it", () => {
    expect(splitDeathYears("1757|")).toEqual([1757, null]);
    expect(splitDeathYears("|1830")).toEqual([null, 1830]);
    expect(splitDeathYears("1757|ca. 1830")).toEqual([1757, null]);
  });

  it("yields nothing for an empty field", () => {
    expect(splitDeathYears("")).toEqual([]);
    expect(splitDeathYears("   ")).toEqual([]);
    expect(splitDeathYears(null)).toEqual([]);
  });
});

describe("artworkEuPublicDomain", () => {
  it("admits a work whose only artist is long dead", () => {
    expect(artworkEuPublicDomain(by([1926], 1899), NOW).ok).toBe(true);
  });

  it("refuses a modern work by an artist still in term", () => {
    expect(artworkEuPublicDomain(by([1970], 1925), NOW)).toEqual({
      ok: false,
      reason: "artist-in-copyright",
    });
  });

  it("refuses a collaboration where one hand is still in term", () => {
    expect(artworkEuPublicDomain(by([1890, 1970], 1925), NOW)).toEqual({
      ok: false,
      reason: "artist-in-copyright",
    });
  });

  it("admits a collaboration where all hands are cleared", () => {
    expect(artworkEuPublicDomain(by([1890, 1926], 1899), NOW).ok).toBe(true);
  });

  describe("the anonymous fallback", () => {
    it("admits an unattributed work finished before the cut-off year", () => {
      expect(artworkEuPublicDomain(anon(1500), NOW).ok).toBe(true);
    });

    it("refuses an unattributed work finished on or after it", () => {
      for (const year of [ANONYMOUS_CUTOFF_YEAR, ANONYMOUS_CUTOFF_YEAR + 1, 1900]) {
        expect(artworkEuPublicDomain(anon(year), NOW), String(year)).toEqual({
          ok: false,
          reason: "undated-unknown-artist",
        });
      }
    });

    it("refuses an unattributed work with no date at all", () => {
      expect(artworkEuPublicDomain(anon(), NOW).ok).toBe(false);
      expect(artworkEuPublicDomain(anon(null), NOW).ok).toBe(false);
    });

    // An artist we could not resolve is not a pass, but it is also not fatal:
    // the work falls to the date proxy, so an upstream hiccup narrows the
    // Gallery to old work rather than emptying it.
    it("treats an unresolvable artist as unknown, not as cleared", () => {
      expect(artworkEuPublicDomain(by([null], 1500), NOW).ok).toBe(true); // saved by the date
      expect(artworkEuPublicDomain(by([null], 1900), NOW)).toEqual({
        ok: false,
        reason: "artist-in-copyright",
      });
    });

    it("treats an artist with no recorded death year the same way", () => {
      expect(artworkEuPublicDomain(by([null], 1900), NOW).ok).toBe(false);
    });
  });

  it("shrinks the Gallery at the modern end and leaves the old end alone", () => {
    // The pre-1900 European and Japanese material the landing page draws on is
    // exactly what must survive this change.
    const hokusai = artworkEuPublicDomain(by([1849], 1833), NOW);
    const midCentury = artworkEuPublicDomain(by([1989], 1948), NOW);
    expect(hokusai.ok).toBe(true);
    expect(midCentury.ok).toBe(false);
  });

  it("reports the reason an unattributed refusal differs from an attributed one", () => {
    expect(artworkEuPublicDomain(anon(1900), NOW)).toEqual({
      ok: false,
      reason: "undated-unknown-artist",
    });
    expect(artworkEuPublicDomain(by([1970], 1900), NOW)).toEqual({
      ok: false,
      reason: "artist-in-copyright",
    });
  });
});

describe("artistsOutOfCopyright", () => {
  it("returns only the keys that clear the cut-off", () => {
    const set = artistsOutOfCopyright(
      [
        { key: 1, death: 1890 },
        { key: 2, death: 1970 },
        { key: 3, death: null },
        { key: 4, death: 1955 },
      ],
      NOW,
    );
    expect([...set].sort()).toEqual([1, 4]);
  });

  it("works for a museum that keys artists by name rather than id", () => {
    const set = artistsOutOfCopyright(
      [
        { key: "Claude Monet", death: 1926 },
        { key: "Pablo Picasso", death: 1973 },
      ],
      NOW,
    );
    expect([...set]).toEqual(["Claude Monet"]);
  });
});
