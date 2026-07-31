import { describe, it, expect } from "vitest";
import {
  euPublicDomainCutoff,
  attributedArtistIds,
  artistOutOfCopyright,
  artworkEuPublicDomain,
  artistsOutOfCopyright,
  ANONYMOUS_CUTOFF_YEAR,
  type ArticAgent,
} from "./realms/artic.publicdomain";

const NOW = new Date("2026-07-31T00:00:00Z");
const CUTOFF = 1955; // 2026 - 71

const agent = (id: number, death: number | null): ArticAgent => ({
  id,
  death_date: death,
});

const agents = (...list: ArticAgent[]) => new Map(list.map((a) => [a.id, a]));

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

describe("artistOutOfCopyright", () => {
  it("admits a death in or before the cut-off year", () => {
    expect(artistOutOfCopyright(agent(1, 1926), CUTOFF)).toBe(true); // Monet
    expect(artistOutOfCopyright(agent(1, 1955), CUTOFF)).toBe(true); // exactly on it
  });

  it("refuses a death after the cut-off", () => {
    expect(artistOutOfCopyright(agent(1, 1956), CUTOFF)).toBe(false);
    expect(artistOutOfCopyright(agent(1, 1970), CUTOFF)).toBe(false);
  });

  // The whole point of the finding: the museum's flag is a US determination.
  // A 1925 painting by an artist who died in 1970 is public domain there and
  // protected here until 2041.
  it("refuses the exact profile the audit warned about", () => {
    expect(artistOutOfCopyright(agent(1, 1970), CUTOFF)).toBe(false);
  });

  it("treats a missing, null or unparseable death date as not established", () => {
    expect(artistOutOfCopyright(agent(1, null), CUTOFF)).toBe(false);
    expect(artistOutOfCopyright({ id: 1 }, CUTOFF)).toBe(false);
    expect(artistOutOfCopyright(undefined, CUTOFF)).toBe(false);
    expect(artistOutOfCopyright({ id: 1, death_date: NaN }, CUTOFF)).toBe(false);
  });
});

describe("attributedArtistIds", () => {
  it("merges the array and the primary id, without duplicates", () => {
    expect(attributedArtistIds({ artist_id: 7, artist_ids: [7, 9] })).toEqual([7, 9]);
  });

  it("copes with either field alone, or neither", () => {
    expect(attributedArtistIds({ artist_id: 7 })).toEqual([7]);
    expect(attributedArtistIds({ artist_ids: [9] })).toEqual([9]);
    expect(attributedArtistIds({})).toEqual([]);
    expect(attributedArtistIds({ artist_id: null, artist_ids: null })).toEqual([]);
  });
});

describe("artworkEuPublicDomain", () => {
  it("admits a work whose only artist is long dead", () => {
    const v = artworkEuPublicDomain(
      { artist_ids: [1], date_end: 1889 },
      agents(agent(1, 1890)), // van Gogh
      NOW,
    );
    expect(v.ok).toBe(true);
  });

  it("refuses a modern work by an artist still in term", () => {
    const v = artworkEuPublicDomain(
      { artist_ids: [1], date_end: 1925 },
      agents(agent(1, 1970)),
      NOW,
    );
    expect(v).toEqual({ ok: false, reason: "artist-in-copyright" });
  });

  // Rule 3 in the module header, and the one most likely to be got wrong: a
  // collaborative work needs EVERY hand cleared, not just the first.
  it("refuses a collaboration where one hand is still in term", () => {
    const v = artworkEuPublicDomain(
      { artist_ids: [1, 2], date_end: 1900 },
      agents(agent(1, 1890), agent(2, 1971)),
      NOW,
    );
    expect(v).toEqual({ ok: false, reason: "artist-in-copyright" });
  });

  it("admits a collaboration where all hands are cleared", () => {
    const v = artworkEuPublicDomain(
      { artist_ids: [1, 2], date_end: 1900 },
      agents(agent(1, 1890), agent(2, 1912)),
      NOW,
    );
    expect(v.ok).toBe(true);
  });

  describe("the anonymous fallback", () => {
    it("admits an unattributed work finished before the cut-off year", () => {
      const v = artworkEuPublicDomain({ date_end: 1500 }, agents(), NOW);
      expect(v.ok).toBe(true);
    });

    it("refuses an unattributed work finished on or after it", () => {
      for (const year of [ANONYMOUS_CUTOFF_YEAR, ANONYMOUS_CUTOFF_YEAR + 1, 1900]) {
        expect(
          artworkEuPublicDomain({ date_end: year }, agents(), NOW),
          String(year),
        ).toEqual({ ok: false, reason: "undated-unknown-artist" });
      }
    });

    it("refuses an unattributed work with no date at all", () => {
      expect(artworkEuPublicDomain({}, agents(), NOW).ok).toBe(false);
    });

    it("falls back to date_start when there is no date_end", () => {
      expect(artworkEuPublicDomain({ date_start: 1500 }, agents(), NOW).ok).toBe(true);
      expect(artworkEuPublicDomain({ date_start: 1900 }, agents(), NOW).ok).toBe(false);
    });

    // An artist we could not look up is not a pass, but it is also not fatal:
    // the work falls to the date proxy, so an upstream hiccup narrows the
    // Gallery to old work rather than emptying it.
    it("treats an unresolvable artist as unknown, not as cleared", () => {
      const old = artworkEuPublicDomain({ artist_ids: [99], date_end: 1500 }, agents(), NOW);
      expect(old.ok).toBe(true); // saved by the date
      const recent = artworkEuPublicDomain({ artist_ids: [99], date_end: 1900 }, agents(), NOW);
      expect(recent).toEqual({ ok: false, reason: "artist-in-copyright" });
    });

    it("treats an artist with no recorded death date the same way", () => {
      const v = artworkEuPublicDomain(
        { artist_ids: [1], date_end: 1900 },
        agents(agent(1, null)),
        NOW,
      );
      expect(v.ok).toBe(false);
    });
  });

  it("shrinks the Gallery at the modern end and leaves the old end alone", () => {
    // The pre-1900 European and Japanese material the landing page draws on is
    // exactly what must survive this change.
    const hokusai = artworkEuPublicDomain(
      { artist_ids: [1], date_end: 1833 },
      agents(agent(1, 1849)),
      NOW,
    );
    const midCentury = artworkEuPublicDomain(
      { artist_ids: [2], date_end: 1948 },
      agents(agent(2, 1989)),
      NOW,
    );
    expect(hokusai.ok).toBe(true);
    expect(midCentury.ok).toBe(false);
  });
});

describe("artistsOutOfCopyright", () => {
  it("returns only the ids that clear the cut-off", () => {
    const set = artistsOutOfCopyright(
      [agent(1, 1890), agent(2, 1970), agent(3, null), agent(4, 1955)],
      NOW,
    );
    expect([...set].sort()).toEqual([1, 4]);
  });
});
