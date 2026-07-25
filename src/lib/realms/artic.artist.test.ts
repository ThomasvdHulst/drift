import { describe, it, expect } from "vitest";
import {
  MAX_ARTIST_RING,
  MIN_MOVEMENT_WORKS,
  artistBucketId,
  artistRingLabel,
  availableRings,
  describeArtistRing,
  foldName,
  isMovement,
  movementHolds,
  nextArtistRing,
  parseArtistBucket,
  rankArtists,
  type ArtistHit,
  type ArtistProfile,
} from "./artic.artist";

// A page of hits shaped like AIC's, in relevance order.
const hit = (id: number, name: string): ArtistHit => ({
  artist_id: id,
  artist_title: name,
});

describe("foldName", () => {
  it("folds diacritics, case and punctuation", () => {
    expect(foldName("Albrecht Dürer")).toBe("albrecht durer");
    expect(foldName("Paul Cézanne")).toBe("paul cezanne");
    expect(foldName("Hilaire-Germain-Edgar Degas")).toBe(
      "hilaire germain edgar degas",
    );
    expect(foldName("  O'Keeffe  ")).toBe("o keeffe");
  });
});

describe("rankArtists — resolution", () => {
  // The real shape of a "van gogh" search: his works rank first, but Rembrandt
  // van Rijn and Anthony van Dyck come along for the ride on "van".
  const vanGoghPage = [
    ...Array(18).fill(null).map(() => hit(40610, "Vincent van Gogh")),
    ...Array(12).fill(null).map(() => hit(40769, "Rembrandt van Rijn")),
    ...Array(3).fill(null).map(() => hit(40563, "Anthony van Dyck")),
  ];

  it("resolves the artist actually asked for", () => {
    const out = rankArtists(vanGoghPage, "van gogh");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 40610, name: "Vincent van Gogh", hits: 18 });
  });

  it("drops artists that match only one token of the query", () => {
    const names = rankArtists(vanGoghPage, "van gogh").map((a) => a.name);
    expect(names).not.toContain("Rembrandt van Rijn");
    expect(names).not.toContain("Anthony van Dyck");
  });

  it("still finds everyone when the query IS the shared token", () => {
    expect(rankArtists(vanGoghPage, "van").map((a) => a.id)).toEqual([
      40610, 40769, 40563,
    ]);
  });

  it("matches across diacritics, as the live catalogue requires", () => {
    const page = [hit(40561, "Albrecht Dürer"), hit(41440, "Wenceslaus Hollar")];
    expect(rankArtists(page, "durer").map((a) => a.id)).toEqual([40561]);
    expect(rankArtists([hit(1, "Paul Cézanne")], "cezanne")).toHaveLength(1);
  });

  it("orders by how much of the sample is theirs", () => {
    const page = [
      hit(2, "Mary Cassatt"),
      hit(2, "Mary Cassatt"),
      hit(2, "Mary Cassatt"),
      hit(3, "Cassatt Imitator"),
    ];
    expect(rankArtists(page, "cassatt").map((a) => a.id)).toEqual([2, 3]);
  });

  // THE POINT OF THE GATE. Picasso and Kahlo are in copyright, so AIC's
  // public-domain set holds nothing by them — but search still returns pottery.
  // An honest empty answer beats a confident wrong one (§2.1).
  it("returns nothing when the collection holds no such artist", () => {
    const pottery = [
      hit(2601, "Ancient Greek"),
      hit(2601, "Ancient Greek"),
      hit(40784, "Salvator Rosa"),
      hit(35960, "Robert Nanteuil"),
    ];
    expect(rankArtists(pottery, "picasso")).toEqual([]);
    expect(rankArtists(pottery, "frida kahlo")).toEqual([]);
  });

  it("ignores blank queries, blank names and artist-less hits", () => {
    expect(rankArtists([hit(1, "Anyone")], "")).toEqual([]);
    expect(rankArtists([hit(1, "Anyone")], "   ")).toEqual([]);
    expect(rankArtists([{ artist_id: null, artist_title: "X" }], "x")).toEqual([]);
    expect(rankArtists([{ artist_id: 5, artist_title: "  " }], "x")).toEqual([]);
  });

  it("caps the number of suggestions", () => {
    const page = Array(9)
      .fill(null)
      .map((_, i) => hit(i + 1, `Painter Number${i}`));
    expect(rankArtists(page, "painter", 3)).toHaveLength(3);
  });
});

describe("isMovement", () => {
  // AIC files period labels in the same field as movements, and for some artists
  // a period label is the only value there (Dürer's is "nineteenth century",
  // from one later impression). Widening into a century is meaningless.
  it("accepts real movements and rejects period labels", () => {
    expect(isMovement("Post-Impressionism")).toBe(true);
    expect(isMovement("Japanese (culture or style)")).toBe(true);
    expect(isMovement("Renaissance")).toBe(true);
    expect(isMovement("19th century")).toBe(false);
    expect(isMovement("nineteenth century")).toBe(false);
    expect(isMovement("18th Century")).toBe(false);
    expect(isMovement("")).toBe(false);
  });
});

describe("movementHolds", () => {
  it("keeps a movement that characterises the artist", () => {
    expect(movementHolds(7, 18)).toBe(true); // Van Gogh, Post-Impressionism
    expect(movementHolds(426, 447)).toBe(true); // Hokusai
    expect(movementHolds(6, 53)).toBe(true); // Cassatt, Impressionism
  });

  it("rejects a movement attested on almost nothing", () => {
    expect(movementHolds(1, 235)).toBe(false); // Rembrandt filed "Renaissance" once
    expect(movementHolds(MIN_MOVEMENT_WORKS - 1, 4)).toBe(false);
  });
});

describe("the widening ladder", () => {
  const vanGogh: ArtistProfile = {
    id: 40610,
    name: "Vincent van Gogh",
    works: 18,
    movement: "Post-Impressionism",
    era: "1850-1899",
    form: "Painting",
  };
  // Dürer's only style value is a century label, so he has no movement ring.
  const durer: ArtistProfile = {
    id: 40561,
    name: "Albrecht Dürer",
    works: 253,
    era: "1500s",
    form: "Print",
  };
  const bare: ArtistProfile = { id: 1, name: "Unknown Artist", works: 4 };

  it("offers oeuvre, movement, then period for a well-described artist", () => {
    expect(availableRings(vanGogh)).toEqual([0, 1, 2]);
    expect(nextArtistRing(vanGogh, 0)).toBe(1);
    expect(nextArtistRing(vanGogh, 1)).toBe(2);
    expect(nextArtistRing(vanGogh, 2)).toBeNull();
  });

  it("skips the movement ring when there is no real movement", () => {
    expect(availableRings(durer)).toEqual([0, 2]);
    expect(nextArtistRing(durer, 0)).toBe(2);
    expect(nextArtistRing(durer, 2)).toBeNull();
  });

  it("has nowhere to widen for an artist we know nothing else about", () => {
    expect(availableRings(bare)).toEqual([0]);
    expect(nextArtistRing(bare, 0)).toBeNull();
  });

  it("never proposes a ring past the maximum", () => {
    for (const p of [vanGogh, durer, bare]) {
      for (const r of availableRings(p)) {
        expect(r).toBeLessThanOrEqual(MAX_ARTIST_RING);
      }
    }
  });

  it("says plainly where a widened drift has gone", () => {
    expect(describeArtistRing(vanGogh, 0)).toBeUndefined();
    expect(describeArtistRing(vanGogh, 1)).toBe(
      "wandering wider · Post-Impressionism",
    );
    expect(describeArtistRing(vanGogh, 2, "1850 to 1899")).toBe(
      "wandering wider · painting, 1850 to 1899",
    );
    expect(describeArtistRing(durer, 2, "1500s")).toBe(
      "wandering wider · print, 1500s",
    );
    expect(describeArtistRing(bare, 2)).toBe("wandering wider");
  });

  // A card served from a widened ring is not BY the artist any more, so its
  // provenance line must stop crediting them (§2.1).
  it("relabels the card's provenance as the drift widens", () => {
    expect(artistRingLabel(vanGogh, 0)).toBe("Vincent van Gogh");
    expect(artistRingLabel(vanGogh, 1)).toBe(
      "Post-Impressionism, around Vincent van Gogh",
    );
    expect(artistRingLabel(vanGogh, 2, "1850 to 1899")).toBe(
      "Painting, 1850 to 1899, around Vincent van Gogh",
    );
    expect(artistRingLabel(durer, 2, "1500s")).toBe(
      "Print, 1500s, around Albrecht Dürer",
    );
    expect(artistRingLabel(bare, 2)).toBe("Around Unknown Artist");
  });

  it("uses no em or en dashes in what the reader sees", () => {
    for (const r of [1, 2] as const) {
      expect(describeArtistRing(vanGogh, r, "1850 to 1899") ?? "").not.toMatch(
        /[—–]/,
      );
    }
  });
});

describe("artist bucket encoding", () => {
  it("round-trips an id and a ring", () => {
    expect(parseArtistBucket(artistBucketId(40610, 0))).toEqual({
      artistId: "40610",
      ring: 0,
    });
    expect(parseArtistBucket(artistBucketId("31492", 2))).toEqual({
      artistId: "31492",
      ring: 2,
    });
  });

  // The id lands in a numeric term query upstream, so anything but digits has to
  // be refused here rather than passed along.
  it("rejects malformed, non-numeric and injected buckets", () => {
    for (const junk of [
      null,
      undefined,
      "",
      "artist",
      "artist:40610",
      "artist:40610:0:extra",
      "artist:abc:0",
      "artist:40610:3",
      "artist:40610:-1",
      "artist::0",
      "artist:4061 0:0",
      "form:40610:0",
      'artist:40610") OR 1=1:0',
      "artist:1234567890123:0",
    ]) {
      expect(parseArtistBucket(junk), String(junk)).toBeNull();
    }
  });
});
