import { describe, it, expect } from "vitest";
import {
  foldName,
  rankArtists,
  availableRings,
  nextArtistRing,
  describeSpan,
  describeArtistRing,
  artistRingLabel,
  artistBucketId,
  parseArtistBucket,
  type MetArtistHit,
  type MetArtistProfile,
} from "./met.artist";

const hit = (name: string, death: number | null = 1700): MetArtistHit => ({ name, death });

describe("foldName", () => {
  it("folds diacritics, case and punctuation", () => {
    expect(foldName("Albrecht Dürer")).toBe("albrecht durer");
    expect(foldName("Paul Cézanne")).toBe("paul cezanne");
    expect(foldName("Rembrandt (Rembrandt van Rijn)")).toBe("rembrandt rembrandt van rijn");
  });
});

describe("rankArtists", () => {
  it("keeps artists whose name contains every meaningful query token", () => {
    const hits = [hit("Vincent van Gogh"), hit("Vincent van Gogh"), hit("Rembrandt van Rijn")];
    expect(rankArtists(hits, "van gogh").map((m) => m.name)).toEqual(["Vincent van Gogh"]);
  });

  // The live case: one query, two genuinely different artists, both offerable.
  it("separates two artists who share a name", () => {
    const hits = [
      hit("Rembrandt (Rembrandt van Rijn)", 1669),
      hit("Rembrandt (Rembrandt van Rijn)", 1669),
      hit("Rembrandt Peale", 1860),
    ];
    const out = rankArtists(hits, "rembrandt");
    expect(out.map((m) => m.name)).toEqual([
      "Rembrandt (Rembrandt van Rijn)",
      "Rembrandt Peale",
    ]);
    expect(out[0].hits).toBe(2);
  });

  it("orders by how often the artist appears in the sample", () => {
    const hits = [hit("Utagawa Hiroshige"), hit("Utagawa Kunisada"), hit("Utagawa Kunisada")];
    expect(rankArtists(hits, "utagawa")[0].name).toBe("Utagawa Kunisada");
  });

  it("keeps a death year seen on any one work", () => {
    const out = rankArtists([hit("Katsushika Hokusai", null), hit("Katsushika Hokusai", 1849)], "hokusai");
    expect(out[0].death).toBe(1849);
  });

  it("returns nothing for a query that matches no one", () => {
    expect(rankArtists([hit("Vincent van Gogh")], "picasso")).toEqual([]);
  });

  it("returns nothing for an empty or single-character query", () => {
    expect(rankArtists([hit("Vincent van Gogh")], "")).toEqual([]);
    expect(rankArtists([hit("Vincent van Gogh")], "v")).toEqual([]);
  });

  it("respects the suggestion cap", () => {
    const hits = ["a Smith", "b Smith", "c Smith", "d Smith", "e Smith"].map((n) => hit(n));
    expect(rankArtists(hits, "smith").length).toBe(4);
  });
});

describe("the two-ring ladder", () => {
  const full: MetArtistProfile = {
    name: "Katsushika Hokusai",
    works: 400,
    department: "Asian Art",
    from: 1790,
    to: 1840,
  };
  const bare: MetArtistProfile = { name: "Anon", works: 3 };

  it("offers ring 1 only when there is somewhere to widen into", () => {
    expect(availableRings(full)).toEqual([0, 1]);
    expect(availableRings(bare)).toEqual([0]);
  });

  it("walks the ladder and then stops", () => {
    expect(nextArtistRing(full, 0)).toBe(1);
    expect(nextArtistRing(full, 1)).toBeNull();
    expect(nextArtistRing(bare, 0)).toBeNull();
  });

  it("says nothing extra at ring 0, and names where you are beyond it", () => {
    expect(describeArtistRing(full, 0)).toBeUndefined();
    expect(describeArtistRing(full, 1)).toContain("asian art");
  });

  // The card's provenance line must stop claiming the artist once the drift has
  // widened past their own work (§2.1).
  it("changes the why-this-card label as the drift widens", () => {
    expect(artistRingLabel(full, 0)).toBe("Katsushika Hokusai");
    expect(artistRingLabel(full, 1)).toContain("around Katsushika Hokusai");
    expect(artistRingLabel(full, 1)).not.toBe("Katsushika Hokusai");
  });

  it("still labels a ring 1 with no department", () => {
    expect(artistRingLabel(bare, 1)).toBe("Around Anon");
  });

  it("uses no em or en dashes in any reader-facing phrase", () => {
    for (const s of [describeArtistRing(full, 1), artistRingLabel(full, 1), describeSpan(1790, 1840)]) {
      expect(s ?? "").not.toMatch(/[—–]/);
    }
  });
});

describe("describeSpan", () => {
  it("names one century, or a range", () => {
    expect(describeSpan(1790, 1799)).toBe("18th century");
    expect(describeSpan(1790, 1840)).toBe("18th century to 19th century");
  });

  it("copes with BCE and with nothing at all", () => {
    expect(describeSpan(-450, -400)).toContain("BCE");
    expect(describeSpan(undefined, 1840)).toBeUndefined();
    expect(describeSpan()).toBeUndefined();
  });
});

describe("the artist bucket codec", () => {
  it("round-trips a plain name", () => {
    const b = artistBucketId("Katsushika Hokusai", 0);
    expect(parseArtistBucket(b)).toEqual({ name: "Katsushika Hokusai", ring: 0 });
  });

  it("round-trips names with the punctuation catalogues actually use", () => {
    for (const name of [
      "Rembrandt (Rembrandt van Rijn)",
      "Albrecht Dürer",
      "Charles-Dominique-Joseph Eisen",
      "Georgia O'Keeffe",
      "Master E.S.",
      "Currier & Ives",
      "Hokusai, Katsushika",
    ]) {
      for (const ring of [0, 1] as const) {
        expect(parseArtistBucket(artistBucketId(name, ring)), name).toEqual({ name, ring });
      }
    }
  });

  // This is the security-critical half: the parsed name reaches an upstream
  // query, where the Art Institute's numeric id could simply be digit-checked.
  it("refuses anything that is not a plausible catalogue name", () => {
    for (const bad of [
      "artist:../../etc/passwd:0",
      "artist:%2e%2e%2f:0",
      "artist:<script>:0",
      "artist:a%00b:0",
      "artist:https%3A%2F%2Fevil.example.com:0",
      "artist:%FF%FE:0", // malformed percent-escape
      "artist::0", // empty name
      "artist:x:0", // too short to be a name
      `artist:${"a".repeat(200)}:0`, // absurdly long
    ]) {
      expect(parseArtistBucket(bad), bad).toBeNull();
    }
  });

  it("refuses a malformed shape or an out-of-range ring", () => {
    for (const bad of [
      "",
      null,
      undefined,
      "artist:Hokusai",
      "artist:Hokusai:0:extra",
      "form:paintings:all",
      "artist:Hokusai:2", // ring 2 no longer exists
      "artist:Hokusai:-1",
      "artist:Hokusai:x",
    ]) {
      expect(parseArtistBucket(bad as string), String(bad)).toBeNull();
    }
  });

  // Defence in depth, and the two halves do different jobs. The ENCODER escapes
  // the separator so a name can never change the bucket's shape; the ALLOWLIST
  // then still refuses it, because no real catalogue name contains a colon and
  // the parser should not be the thing deciding it is harmless.
  it("never lets a name reintroduce the separator the codec splits on", () => {
    const b = artistBucketId("Weird:Name", 0);
    expect(b.split(":").length).toBe(3); // shape preserved
    expect(parseArtistBucket(b)).toBeNull(); // and still refused
  });
});
