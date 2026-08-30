// ---------------------------------------------------------------------------
// The Gallery's baked lookups.
//
// What these pin is cost as much as correctness. Measured on 30 August 2026,
// before any of this existed: six cards read in European Paintings cost 26 Met
// requests, one artist search for "Rembrandt" cost 30 to return two names, and
// one artist profile cost about 24 to return a department and a date span. The
// per-card facets (artist, subject) differ on every card, so unlike the room and
// department searches they could never be served from a cache.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  facetCandidates,
  rankBakedArtists,
  bakedArtist,
  profileFromBaked,
  type FacetIndex,
  type BakedArtist,
} from "./metfacets";
import { deathYearCleared, euPublicDomainCutoff } from "./publicdomain";

const index: FacetIndex = {
  artist: { "rembrandt van rijn": [1, 2, 3, 4, 5], "vincent van gogh": [6, 7] },
  place: { japan: [10, 11, 12] },
  dept: { "european paintings": [1, 2, 6] },
  tag: { cats: [20, 21, 22, 23] },
};

const artists: BakedArtist[] = [
  { k: "rembrandt van rijn", n: "Rembrandt van Rijn", w: 812, d: "Drawings and Prints", f: 1625, t: 1669, x: 1669 },
  { k: "rembrandt peale", n: "Rembrandt Peale", w: 9, d: "The American Wing", f: 1801, t: 1855, x: 1860 },
  { k: "vincent van gogh", n: "Vincent van Gogh", w: 17, d: "European Paintings", f: 1887, t: 1890, x: 1890 },
  // Still in copyright: died well inside the EU term.
  { k: "pablo picasso", n: "Pablo Picasso", w: 553, x: 1973 },
  // No death year recorded at all.
  { k: "anonymous", n: "Anonymous", w: 40 },
];

describe("facetCandidates", () => {
  it("returns a facet's ids", () => {
    expect(facetCandidates(index, "place", "Japan").sort()).toEqual([10, 11, 12]);
  });

  it("normalises the value the same way the build script did", () => {
    // The card gives the museum's own spelling; the index is normalised.
    expect(facetCandidates(index, "artist", "Rembrandt van Rijn")).toHaveLength(5);
    expect(facetCandidates(index, "artist", "  REMBRANDT   VAN RIJN ")).toHaveLength(5);
  });

  it("says nothing for a facet value the museum does not use", () => {
    expect(facetCandidates(index, "tag", "quantum mechanics")).toEqual([]);
    expect(facetCandidates(index, "artist", "")).toEqual([]);
  });

  it("is inert without an index, so the caller can fall back to a search", () => {
    expect(facetCandidates(null, "artist", "Rembrandt van Rijn")).toEqual([]);
  });

  it("rotates daily without ever losing an id", () => {
    // A reader who comes back to the same subject tomorrow should meet different
    // work; everyone sharing today must get the same order, or the edge cache
    // cannot hold and every miss is upstream traffic.
    const mon = facetCandidates(index, "tag", "cats", new Date("2026-09-07T00:00:00Z"));
    const tue = facetCandidates(index, "tag", "cats", new Date("2026-09-08T00:00:00Z"));
    expect(mon.slice().sort()).toEqual([20, 21, 22, 23]);
    expect(tue.slice().sort()).toEqual([20, 21, 22, 23]);
    expect(mon).not.toEqual(tue);
  });

  it("gives every reader the same order within one day", () => {
    const a = facetCandidates(index, "tag", "cats", new Date("2026-09-07T01:00:00Z"));
    const b = facetCandidates(index, "tag", "cats", new Date("2026-09-07T23:00:00Z"));
    expect(a).toEqual(b);
  });
});

describe("rankBakedArtists", () => {
  it("offers both Rembrandts, most works first", () => {
    // The case the live version was verified against: "rembrandt" must separate
    // Rembrandt van Rijn from Rembrandt Peale and offer both.
    const got = rankBakedArtists(artists, "rembrandt");
    expect(got.map((m) => m.name)).toEqual(["Rembrandt van Rijn", "Rembrandt Peale"]);
    expect(got[0].hits).toBe(812);
  });

  it("requires EVERY meaningful token, so van gogh is not van rijn", () => {
    const got = rankBakedArtists(artists, "van gogh");
    expect(got.map((m) => m.name)).toEqual(["Vincent van Gogh"]);
  });

  it("ignores one-character fragments and an empty query", () => {
    expect(rankBakedArtists(artists, "a")).toEqual([]);
    expect(rankBakedArtists(artists, "   ")).toEqual([]);
  });

  it("carries the death year so the caller can apply the EU term", () => {
    // The refusal is the interesting half: an artist still in copyright is not
    // offered at all, rather than offered and then resolving to an empty feed.
    const cutoff = euPublicDomainCutoff(new Date("2026-01-01T00:00:00Z"));
    const got = rankBakedArtists(artists, "picasso");
    expect(got).toHaveLength(1);
    expect(deathYearCleared(got[0].death, cutoff)).toBe(false);
  });

  it("reports a missing death year as null, not as zero", () => {
    // A 0 would read as a real year and clear every cut-off.
    expect(rankBakedArtists(artists, "anonymous")[0].death).toBeNull();
  });

  it("is inert without a table, so the caller can fall back to a search", () => {
    expect(rankBakedArtists(null, "rembrandt")).toEqual([]);
  });
});

describe("bakedArtist and profileFromBaked", () => {
  it("finds an artist by the museum's own spelling", () => {
    expect(bakedArtist(artists, "Rembrandt van Rijn")?.w).toBe(812);
    expect(bakedArtist(artists, "rembrandt  VAN  rijn")?.w).toBe(812);
  });

  it("returns null for an artist not in the catalogue", () => {
    expect(bakedArtist(artists, "Nobody At All")).toBeNull();
    expect(bakedArtist(null, "Rembrandt van Rijn")).toBeNull();
  });

  it("becomes the profile the widening ladder expects", () => {
    expect(profileFromBaked(artists[0])).toEqual({
      name: "Rembrandt van Rijn",
      works: 812,
      department: "Drawings and Prints",
      from: 1625,
      to: 1669,
    });
  });

  it("leaves unknown fields absent rather than zero", () => {
    // `MetArtistProfile` treats absent as "unknown" and the ladder copes; a 0
    // would look like a real year and a real department count.
    expect(profileFromBaked(artists[4])).toEqual({ name: "Anonymous", works: 40 });
  });
});

// ---------------------------------------------------------------------------
// The real baked tables, checked for the one failure that would be silent.
//
// The build script normalises facet keys with its own copy of the normaliser
// (pinned in doorwayindex.test.ts). If the two ever drift, every lookup misses
// and the Gallery quietly falls back to the live search it was built to avoid —
// no error, no failing unit test, just the bill coming back.
// ---------------------------------------------------------------------------
describe("the built tables agree with the runtime normaliser", () => {
  async function load<T>(file: string): Promise<T> {
    const { readFileSync } = await import("node:fs");
    const { gunzipSync } = await import("node:zlib");
    return JSON.parse(
      gunzipSync(readFileSync(`src/lib/realms/${file}`)).toString("utf8"),
    ) as T;
  }

  it("every facet key is already normalised", async () => {
    const { normalizeForIndex } = await import("./doorwayindex");
    const facets = await load<FacetIndex>("met.facets.json.gz");
    for (const kind of ["artist", "place", "dept", "tag"] as const) {
      const keys = Object.keys(facets[kind]);
      expect(keys.length, kind).toBeGreaterThan(0);
      const drifted = keys.filter((k) => normalizeForIndex(k) !== k);
      expect(drifted.slice(0, 5), `${kind} keys not normalised`).toEqual([]);
    }
  });

  it("every artist key is already folded", async () => {
    const { foldName } = await import("./met.artist");
    const artists = await load<BakedArtist[]>("met.artists.json.gz");
    expect(artists.length).toBeGreaterThan(1000);
    const drifted = artists.filter((a) => foldName(a.n) !== a.k);
    expect(drifted.slice(0, 5).map((a) => a.n)).toEqual([]);
  });

  it("carries no impossible year, which a catalogue typo would produce", () => {
    // Measured on the first build: "Brewster & Co." spanned 1845 to 2870, and a
    // span is what ring 1 of an artist drift filters on.
    const year = new Date().getUTCFullYear();
    return load<BakedArtist[]>("met.artists.json.gz").then((artists) => {
      expect(artists.filter((a) => (a.t ?? 0) > year)).toEqual([]);
      expect(artists.filter((a) => a.f !== undefined && a.t !== undefined && a.f > a.t)).toEqual([]);
    });
  });
});
