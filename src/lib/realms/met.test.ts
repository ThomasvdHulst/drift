import { describe, it, expect } from "vitest";
import {
  parseMetImage,
  metUpstreamImageUrl,
  metImageUrl,
  metPreviewUrl,
  metPageUrl,
  artImageAtWidth,
  isUsableArtwork,
  artFacts,
  artSubjects,
  metImageAlt,
  metPdInput,
  metArtistQid,
  metToCard,
  metToCandidate,
  MET_DEPT_RE,
  MET_NAME_RE,
  type MetObject,
} from "./met";
import { artworkEuPublicDomain } from "./publicdomain";

const NOW = new Date("2026-07-31T00:00:00Z");

/** A real record, trimmed: Van Gogh, Wheat Field with Cypresses (objectID 436535). */
const vanGogh: MetObject = {
  objectID: 436535,
  title: "Wheat Field with Cypresses",
  artistDisplayName: "Vincent van Gogh",
  artistDisplayBio: "Dutch, Zundert 1853-1890 Auvers-sur-Oise",
  artistBeginDate: "1853",
  artistEndDate: "1890",
  objectDate: "1889",
  objectBeginDate: 1889,
  objectEndDate: 1889,
  medium: "Oil on canvas",
  dimensions: "28 13/16 × 36 3/4 in. (73.2 × 93.4 cm)",
  creditLine: "Purchase, The Annenberg Foundation Gift, 1993",
  department: "European Paintings",
  classification: "Paintings",
  objectName: "Painting",
  culture: "",
  country: "",
  isPublicDomain: true,
  primaryImage: "https://images.metmuseum.org/CRDImages/ep/original/DP-42549-001.jpg",
  primaryImageSmall:
    "https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg",
  tags: [{ term: "Landscapes" }, { term: "Cypresses" }, { term: "Summer" }],
};

describe("parseMetImage", () => {
  it("pulls the department and file name out of a museum URL", () => {
    expect(parseMetImage(vanGogh.primaryImage)).toEqual({
      dept: "ep",
      name: "DP-42549-001",
    });
  });

  it("reads any of the museum's size buckets", () => {
    expect(parseMetImage(vanGogh.primaryImageSmall)).toEqual({
      dept: "ep",
      name: "DP-42549-001",
    });
  });

  it("handles the other department codes the museum uses", () => {
    for (const [url, dept] of [
      ["https://images.metmuseum.org/CRDImages/as/original/DP251139.jpg", "as"],
      ["https://images.metmuseum.org/CRDImages/eg/original/DP-24216-003.jpg", "eg"],
      ["https://images.metmuseum.org/CRDImages/gr/original/DP328403.jpg", "gr"],
    ] as const) {
      expect(parseMetImage(url)?.dept).toBe(dept);
    }
  });

  it("returns nothing for an absent or empty image", () => {
    // An in-copyright work presents as an empty string, not a missing field.
    expect(parseMetImage("")).toBeUndefined();
    expect(parseMetImage(null)).toBeUndefined();
    expect(parseMetImage(undefined)).toBeUndefined();
  });

  // The whole point of parsing to components and rebuilding: nothing upstream
  // says can aim our proxy somewhere else.
  it("refuses a URL on any other host", () => {
    expect(
      parseMetImage("https://evil.example.com/CRDImages/ep/original/x.jpg"),
    ).toBeUndefined();
    expect(
      parseMetImage("http://images.metmuseum.org/CRDImages/ep/original/x.jpg"),
    ).toBeUndefined();
    expect(
      parseMetImage("https://images.metmuseum.org.evil.com/CRDImages/ep/original/x.jpg"),
    ).toBeUndefined();
  });

  it("refuses components that would not survive re-validation", () => {
    expect(
      parseMetImage("https://images.metmuseum.org/CRDImages/EP/original/x.jpg"),
    ).toBeUndefined(); // uppercase dept
    expect(
      parseMetImage("https://images.metmuseum.org/CRDImages/toolongdept/original/x.jpg"),
    ).toBeUndefined();
    expect(
      parseMetImage("https://images.metmuseum.org/CRDImages/ep/original/a b.jpg"),
    ).toBeUndefined(); // space in the name
  });
});

describe("the anchored component patterns", () => {
  it("accept what the museum actually uses", () => {
    expect(MET_DEPT_RE.test("ep")).toBe(true);
    expect(MET_NAME_RE.test("DP-42549-001")).toBe(true);
    expect(MET_NAME_RE.test("DP251139")).toBe(true);
  });

  it("reject traversal and separators", () => {
    for (const bad of ["../ep", "e/p", "ep/", ".."]) {
      expect(MET_DEPT_RE.test(bad), bad).toBe(false);
    }
    for (const bad of ["../../etc/passwd", "a/b", "a\\b", "a b", ""]) {
      expect(MET_NAME_RE.test(bad), bad).toBe(false);
    }
  });
});

describe("image URLs", () => {
  const ref = { dept: "ep", name: "DP-42549-001" };

  it("builds the museum's own URL for the proxy to fetch", () => {
    expect(metUpstreamImageUrl(ref)).toBe(
      "https://images.metmuseum.org/CRDImages/ep/original/DP-42549-001.jpg",
    );
    expect(metUpstreamImageUrl(ref, "web-large")).toBe(
      "https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg",
    );
  });

  // Same-origin is not an optimisation here: it is what keeps the trail map's
  // PNG export untainted, because the museum sends no CORS header.
  it("serves card and zoom images from our own origin", () => {
    expect(metImageUrl(ref)).toBe("/api/img/met/ep/DP-42549-001/843");
    expect(metImageUrl(ref, 1686)).toBe("/api/img/met/ep/DP-42549-001/1686");
    expect(metImageUrl(ref, 160)).toBe("/api/img/met/ep/DP-42549-001/160");
  });

  it("links the instant placeholder straight to the museum", () => {
    expect(metPreviewUrl(ref)).toContain("web-large");
    expect(metPreviewUrl(ref).startsWith("https://images.metmuseum.org/")).toBe(true);
  });

  it("points the source link at the public object page", () => {
    expect(metPageUrl(436535)).toBe(
      "https://www.metmuseum.org/art/collection/search/436535",
    );
  });
});

describe("artImageAtWidth", () => {
  it("rewrites the width of a URL we built", () => {
    expect(artImageAtWidth("/api/img/met/ep/DP-42549-001/843", 160)).toBe(
      "/api/img/met/ep/DP-42549-001/160",
    );
    expect(artImageAtWidth("/api/img/met/ep/DP-42549-001/843", 1686)).toBe(
      "/api/img/met/ep/DP-42549-001/1686",
    );
  });

  // Anything we did not build is returned untouched: a Wikipedia thumbnail, or
  // an Art Institute URL still sitting in a trail saved before Phase 31.
  it("leaves other sources alone", () => {
    const wiki = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/x.jpg/800px-x.jpg";
    expect(artImageAtWidth(wiki, 160)).toBe(wiki);
    const aic = "https://www.artic.edu/iiif/2/abc/full/843,/0/default.jpg";
    expect(artImageAtWidth(aic, 160)).toBe(aic);
    expect(artImageAtWidth(undefined, 160)).toBeUndefined();
  });
});

describe("isUsableArtwork", () => {
  it("accepts a public-domain work with an image and a title", () => {
    expect(isUsableArtwork(vanGogh)).toBe(true);
  });

  it("refuses a work the museum has not released", () => {
    expect(isUsableArtwork({ ...vanGogh, isPublicDomain: false })).toBe(false);
  });

  // How an in-copyright record presents: catalogued, but no image to serve.
  it("refuses a record whose image is an empty string", () => {
    expect(isUsableArtwork({ ...vanGogh, primaryImage: "" })).toBe(false);
    expect(isUsableArtwork({ ...vanGogh, primaryImage: "   " })).toBe(false);
  });

  it("refuses a record with no title", () => {
    expect(isUsableArtwork({ ...vanGogh, title: "  " })).toBe(false);
  });

  it("refuses nothing at all", () => {
    expect(isUsableArtwork(null)).toBe(false);
    expect(isUsableArtwork(undefined)).toBe(false);
  });
});

describe("artFacts — the museum label", () => {
  it("keeps the reading order and skips what is missing", () => {
    expect(artFacts(vanGogh).map((r) => r.label)).toEqual([
      "Medium",
      "Dimensions",
      "Classification",
      "Department",
      "Subjects",
      "Credit",
    ]);
  });

  it("falls back to objectName when there is no classification", () => {
    const rows = artFacts({ ...vanGogh, classification: "" });
    expect(rows.find((r) => r.label === "Classification")?.value).toBe("Painting");
  });

  it("prefers culture over country for the origin row", () => {
    const rows = artFacts({ ...vanGogh, culture: "Japan", country: "France" });
    expect(rows.find((r) => r.label === "Origin")?.value).toBe("Japan");
  });

  it("joins subjects in the museum's own order", () => {
    expect(artFacts(vanGogh).find((r) => r.label === "Subjects")?.value).toBe(
      "Landscapes, Cypresses, Summer",
    );
  });

  it("returns no rows at all for an empty record", () => {
    expect(artFacts({ objectID: 1 })).toEqual([]);
  });
});

describe("artSubjects", () => {
  it("de-duplicates case-insensitively while keeping order", () => {
    expect(
      artSubjects({
        objectID: 1,
        tags: [{ term: "Birds" }, { term: "birds" }, { term: "Trees" }],
      }),
    ).toEqual(["Birds", "Trees"]);
  });

  it("copes with a null tag list", () => {
    expect(artSubjects({ objectID: 1, tags: null })).toEqual([]);
    expect(artSubjects({ objectID: 1 })).toEqual([]);
  });
});

describe("metImageAlt", () => {
  // The Met ships no alt text. Every clause here is a field the museum recorded;
  // nothing is invented (principle 5).
  it("composes a real description from the catalogue", () => {
    expect(metImageAlt(vanGogh)).toBe(
      "Wheat Field with Cypresses, oil on canvas by Vincent van Gogh, 1889",
    );
  });

  it("drops the clauses it has no data for", () => {
    expect(metImageAlt({ objectID: 1, title: "Krater", medium: "Terracotta" })).toBe(
      "Krater, terracotta",
    );
    expect(metImageAlt({ objectID: 1, title: "Krater" })).toBe("Krater");
  });

  it("still says something for an untitled work", () => {
    expect(metImageAlt({ objectID: 1, medium: "Bronze" })).toBe("Untitled, bronze");
  });
});

describe("metPdInput — feeding the EU public-domain test", () => {
  it("reads a single artist's death year", () => {
    expect(metPdInput(vanGogh)).toEqual({
      deathYears: [1890],
      attributed: true,
      finishedYear: 1889,
    });
    expect(artworkEuPublicDomain(metPdInput(vanGogh), NOW).ok).toBe(true);
  });

  // The Met's date fields are pipe-delimited for a work with several hands.
  it("splits several hands and requires all of them to clear", () => {
    const collab: MetObject = {
      ...vanGogh,
      artistDisplayName: "Thomas Rowlandson|Henry Brookes",
      artistEndDate: "1827|1970",
      objectEndDate: 1900,
    };
    expect(metPdInput(collab).deathYears).toEqual([1827, 1970]);
    expect(artworkEuPublicDomain(metPdInput(collab), NOW)).toEqual({
      ok: false,
      reason: "artist-in-copyright",
    });
  });

  // A named artist with no recorded dates must not be mistaken for an anonymous
  // work, which gets the more generous pre-1830 fallback.
  it("counts a named but undated artist as one unresolved hand", () => {
    const undated: MetObject = {
      ...vanGogh,
      artistEndDate: "",
      objectEndDate: 1900,
    };
    expect(metPdInput(undated)).toEqual({
      deathYears: [null],
      attributed: true,
      finishedYear: 1900,
    });
    expect(artworkEuPublicDomain(metPdInput(undated), NOW).ok).toBe(false);
  });

  it("treats an unnamed work as anonymous and lets the date decide", () => {
    const anon: MetObject = {
      objectID: 2,
      title: "Krater",
      artistDisplayName: "",
      objectEndDate: -450,
    };
    expect(metPdInput(anon)).toEqual({
      deathYears: [],
      attributed: false,
      finishedYear: -450,
    });
    expect(artworkEuPublicDomain(metPdInput(anon), NOW).ok).toBe(true);
  });

  it("falls back to the begin date when there is no end date", () => {
    expect(
      metPdInput({ objectID: 3, objectBeginDate: 1500, objectEndDate: undefined })
        .finishedYear,
    ).toBe(1500);
  });

  // A mid-century artist the museum flags public domain in the US is still in
  // term here. This is the whole reason the filter exists.
  it("refuses the profile the compliance audit warned about", () => {
    const midCentury: MetObject = {
      ...vanGogh,
      artistEndDate: "1970",
      objectEndDate: 1925,
    };
    expect(artworkEuPublicDomain(metPdInput(midCentury), NOW).ok).toBe(false);
  });
});

describe("metArtistQid", () => {
  it("reads the artist's Wikidata id", () => {
    expect(
      metArtistQid({ ...vanGogh, artistWikidata_URL: "https://www.wikidata.org/wiki/Q5582" }),
    ).toBe("Q5582");
  });

  it("returns nothing when the museum recorded none", () => {
    expect(metArtistQid(vanGogh)).toBeUndefined();
    expect(metArtistQid({ ...vanGogh, artistWikidata_URL: "" })).toBeUndefined();
  });

  // The id is interpolated into a Wikidata request, so anything that is not
  // exactly a Q-number on Wikidata's own host is refused rather than passed on.
  it("refuses anything that is not a Wikidata Q-id on their host", () => {
    for (const bad of [
      "https://evil.example.com/wiki/Q5582",
      "http://www.wikidata.org/wiki/Q5582",
      "https://www.wikidata.org/wiki/P31",
      "https://www.wikidata.org/wiki/Q5582?x=1",
      "https://www.wikidata.org/wiki/Q5582/../../x",
    ]) {
      expect(metArtistQid({ ...vanGogh, artistWikidata_URL: bad }), bad).toBeUndefined();
    }
  });
});

describe("metToCard", () => {
  const card = metToCard(vanGogh);

  it("keys the card by the museum's object id", () => {
    expect(card.pageTitle).toBe("436535");
    expect(card.source).toBe("met");
  });

  it("carries the title, the catalogue line and the museum page", () => {
    expect(card.displayTitle).toBe("Wheat Field with Cypresses");
    expect(card.description).toBe("Vincent van Gogh · 1889");
    expect(card.extract).toBe("Oil on canvas");
    expect(card.sourceUrl).toBe(
      "https://www.metmuseum.org/art/collection/search/436535",
    );
  });

  it("serves card and zoom from our origin and the placeholder from theirs", () => {
    expect(card.imageUrl).toBe("/api/img/met/ep/DP-42549-001/843");
    expect(card.zoomUrl).toBe("/api/img/met/ep/DP-42549-001/1686");
    expect(card.previewUrl).toContain("images.metmuseum.org");
  });

  it("always carries alt text, since the museum provides none", () => {
    expect(card.imageAlt).toBeTruthy();
  });

  it("carries the museum label", () => {
    expect(card.facts?.length).toBeGreaterThan(3);
  });

  it("omits every image field when the work has no usable image URL", () => {
    const noImage = metToCard({ ...vanGogh, primaryImage: "" });
    expect(noImage.imageUrl).toBeUndefined();
    expect(noImage.zoomUrl).toBeUndefined();
    expect(noImage.previewUrl).toBeUndefined();
  });

  it("names an untitled work rather than leaving it blank", () => {
    expect(metToCard({ ...vanGogh, title: "" }).displayTitle).toBe("Untitled");
  });
});

describe("metToCandidate", () => {
  it("carries the thread label, facet and eyebrow", () => {
    const c = metToCandidate(vanGogh, "Vincent van Gogh", "artist:Vincent van Gogh", "More by");
    expect(c.threadLabel).toBe("Vincent van Gogh");
    expect(c.facet).toBe("artist:Vincent van Gogh");
    expect(c.eyebrow).toBe("More by");
  });

  it("omits the eyebrow when there is none", () => {
    expect(metToCandidate(vanGogh, "x", "subject:x").eyebrow).toBeUndefined();
  });

  // A pulled thread lands on a full card, so the rich fields have to ride along.
  it("carries the same rich fields a card gets", () => {
    const c = metToCandidate(vanGogh, "x", "subject:x");
    expect(c.zoomUrl).toBe("/api/img/met/ep/DP-42549-001/1686");
    expect(c.previewUrl).toBeTruthy();
    expect(c.imageAlt).toBeTruthy();
    expect(c.facts?.length).toBeGreaterThan(3);
    expect(c.source).toBe("met");
    expect(c.sourceUrl).toBeTruthy();
  });
});
