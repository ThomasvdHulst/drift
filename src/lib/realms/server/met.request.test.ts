// ---------------------------------------------------------------------------
// How many requests the Met adapter MAKES, which is a different question from
// what it returns and is the one that nearly took the Gallery down.
//
// A 25-reader load rehearsal drew 1,470 refusals from the museum. Measuring
// where they came from found that 92.6% were `/api/doorway` calls on ENCYCLOPEDIA
// cards: every card searched the museum for its article title, then fetched five
// records to keep at most one, and the gate that judged them rejected nearly all.
//
// None of that is visible in a return value — the doorway looked fine, it was
// just ruinously expensive. So these tests assert on the fetch mock's call
// COUNT and on the URLs, not only on the answer.
//
// This is also the first test of anything in `realms/server/*`; the `@/` alias
// in vitest.config.ts exists so it can be.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

function json(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

/** A record that survives `usable()`: public domain, imaged, titled, long dead. */
function work(objectID: number, over: Partial<Record<string, unknown>> = {}) {
  return {
    objectID,
    title: `Work ${objectID}`,
    isPublicDomain: true,
    primaryImage: "https://images.metmuseum.org/CRDImages/ep/original/x.jpg",
    primaryImageSmall: "https://images.metmuseum.org/CRDImages/ep/web-large/x.jpg",
    artistDisplayName: "Anon",
    artistEndDate: "1700",
    objectDate: "1650",
    department: "European Paintings",
    tags: [],
    ...over,
  };
}

const url = (call: unknown[]) => String(call[0]);
const searchCalls = (m: { mock: { calls: unknown[][] } }) =>
  m.mock.calls.filter((c) => url(c).includes("/search?"));
const objectCalls = (m: { mock: { calls: unknown[][] } }) =>
  m.mock.calls.filter((c) => url(c).includes("/objects/"));

// Each test needs a module with EMPTY caches, or the previous test's objects
// would be served from memory and every call count here would be a fiction.
let met: typeof import("./met");
beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  met = await import("./met");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("metTopMatch — the doorway lookup", () => {
  it("phrase-quotes the term", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ objectIDs: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await met.metTopMatch("Powers of the president of the United States");

    // Read it back through URL, not decodeURIComponent: URLSearchParams encodes
    // a space as `+`, which decodeURIComponent leaves as a literal plus.
    const q = new URL(url(searchCalls(fetchMock)[0])).searchParams.get("q");
    expect(q).toBe('"Powers of the president of the United States"');
  });

  it("costs ONE request when the search finds nothing", async () => {
    // The common case for an ordinary article, and it used to cost six.
    const fetchMock = vi.fn().mockResolvedValue(json({ objectIDs: [] }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await met.metTopMatch("Unicode")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops at the first record the caller accepts, rather than fetching five", async () => {
    const fetchMock = vi.fn(async (u: string) => {
      if (u.includes("/search?")) return json({ objectIDs: [1, 2, 3, 4, 5] });
      const id = Number(u.split("/objects/")[1]);
      return json(work(id, { title: id === 1 ? "A cat" : "An octopus" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const top = await met.metTopMatch("octopus", ({ title }) =>
      title.toLowerCase().includes("octopus"),
    );

    expect(top?.title).toBe("An octopus");
    // Record 1 was rejected, record 2 accepted: two fetches, not five.
    expect(objectCalls(fetchMock)).toHaveLength(2);
  });

  it("gives up after five candidates rather than walking the whole result set", async () => {
    const fetchMock = vi.fn(async (u: string) => {
      if (u.includes("/search?")) {
        return json({ objectIDs: Array.from({ length: 200 }, (_, i) => i + 1) });
      }
      return json(work(Number(u.split("/objects/")[1])));
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await met.metTopMatch("nothing matches", () => false)).toBeNull();
    expect(objectCalls(fetchMock)).toHaveLength(5);
  });

  it("THROWS when the search fails, instead of reporting 'no doorway'", async () => {
    // The load-bearing half of caching a miss for a day: a throttled lookup must
    // not be indistinguishable from a settled "there is nothing here", or the
    // route freezes a busy moment onto a card until tomorrow.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 403)));
    await expect(met.metTopMatch("Octopus")).rejects.toThrow();
  });
});

describe("de-duplication, which is what more than one reader needs", () => {
  it("makes one request for two concurrent identical searches", async () => {
    let resolveSearch: (v: Response) => void = () => {};
    const gate = new Promise<Response>((r) => (resolveSearch = r));
    const fetchMock = vi.fn(async (u: string) => {
      if (u.includes("/search?")) return gate;
      return json(work(Number(u.split("/objects/")[1])));
    });
    vi.stubGlobal("fetch", fetchMock);

    // Both start before either resolves — the case a cache cannot help with.
    const a = met.metTopMatch("Octopus", () => true);
    const b = met.metTopMatch("Octopus", () => true);
    resolveSearch(json({ objectIDs: [7] }));
    await Promise.all([a, b]);

    expect(searchCalls(fetchMock)).toHaveLength(1);
  });

  it("makes one request for the same object fetched twice at once", async () => {
    let release: (v: Response) => void = () => {};
    const gate = new Promise<Response>((r) => (release = r));
    const fetchMock = vi.fn(async (u: string) => {
      if (u.includes("/search?")) return json({ objectIDs: [42] });
      return gate;
    });
    vi.stubGlobal("fetch", fetchMock);

    const a = met.metTopMatch("Octopus", () => true);
    const b = met.metSummary("42");
    release(json(work(42)));
    await Promise.all([a, b]);

    expect(objectCalls(fetchMock).filter((c) => url(c).endsWith("/42"))).toHaveLength(1);
  });

  it("serves a repeated search from cache without asking again", async () => {
    const fetchMock = vi.fn(async (u: string) =>
      u.includes("/search?")
        ? json({ objectIDs: [1] })
        : json(work(Number(u.split("/objects/")[1]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    await met.metTopMatch("Octopus", () => true);
    await met.metTopMatch("Octopus", () => true);
    expect(searchCalls(fetchMock)).toHaveLength(1);
  });

  it("never caches an empty search result", async () => {
    // An empty answer is far more likely a throttle than an empty room; holding
    // it for an hour would freeze that room shut. Same rule `poolFor` states.
    const fetchMock = vi.fn().mockResolvedValue(json({ objectIDs: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await met.metTopMatch("Unicode");
    await met.metTopMatch("Unicode");
    expect(searchCalls(fetchMock)).toHaveLength(2);
  });
});

describe("a throttle must never be cached as 'no doorway'", () => {
  // The property the day-long cache rests on. `/api/doorway` answers a THROWN
  // error with NO_STORE and a `null` with a day of CACHE_STABLE, so if a refused
  // search came back as `null` the museum being busy for one second would freeze
  // "nothing here" onto that card until tomorrow. This is the test that says the
  // two are different values.
  it("propagates the failure instead of returning null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 403)));
    const { crossRealmDoorway } = await import("./doorway");
    await expect(crossRealmDoorway("encyclopedia", "Octopus")).rejects.toThrow();
  });

  it("still returns null for a search that genuinely found nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ objectIDs: [] })));
    const { crossRealmDoorway } = await import("./doorway");
    await expect(crossRealmDoorway("encyclopedia", "Unicode")).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phrase-quoting belongs to the doorway and nowhere else (27 August).
//
// Phase 33 quoted every free-text search, including the three that build a
// card's threads. Quoting is measured to pay for the DOORWAY, where a loose OR
// returned 55,804 works the gate was going to reject one record at a time. It
// pays nothing here: a facet search costs one request whatever it returns, and
// only the first three ids are ever fetched. What it does instead is
// occasionally return nothing, which silently deletes a thread from the card.
//
// Measured live, twice: `artistOrCulture q=Winslow Homer` returns 13 works and
// `q="Winslow Homer"` returns 0.
// ---------------------------------------------------------------------------

describe("thread facets are not phrase-quoted", () => {
  async function facetQueries(self: Record<string, unknown>) {
    const fetchMock = vi.fn(async (u: string) =>
      u.includes("/search?")
        ? json({ objectIDs: [] })
        : json(work(9, self)),
    );
    vi.stubGlobal("fetch", fetchMock);
    await met.metRelated("9");
    return searchCalls(fetchMock)
      .map(url)
      .map((u) => new URL(u).searchParams.get("q"));
  }

  it("sends the artist, subject and department bare", async () => {
    const qs = await facetQueries({
      artistDisplayName: "Winslow Homer",
      tags: [{ term: "Boats" }],
      department: "American Decorative Arts",
    });
    expect(qs).toContain("Winslow Homer");
    expect(qs).toContain("Boats");
    expect(qs).toContain("American Decorative Arts");
    expect(qs.some((q) => q?.startsWith('"'))).toBe(false);
  });

  it("still puts `q` last, so the other filters are not silently dropped", async () => {
    // The undocumented parameter-order trap in `searchIds`. Read off the RAW
    // query string, because URL parsing would hide the ordering that is the
    // entire point. (Moved here from the doorway block: `metTopMatch` sends no
    // other filters, so a facet search is the only place the trap can bite.)
    const fetchMock = vi.fn(async (u: string) =>
      u.includes("/search?")
        ? json({ objectIDs: [] })
        : json(work(9, { artistDisplayName: "Winslow Homer" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await met.metRelated("9");
    const artistSearch = searchCalls(fetchMock)
      .map(url)
      .find((u) => u.includes("artistOrCulture"));
    const qs = artistSearch!.split("?")[1];
    expect(qs.indexOf("q=")).toBeGreaterThan(qs.indexOf("artistOrCulture"));
  });

  it("keeps the quoting on the doorway, where it is measured to pay", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ objectIDs: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await met.metTopMatch("Winslow Homer");
    const q = new URL(url(searchCalls(fetchMock)[0])).searchParams.get("q");
    expect(q).toBe('"Winslow Homer"');
  });
});

// ---------------------------------------------------------------------------
// The Gallery half of the doorway, which /api/doorway caches for a DAY.
// ---------------------------------------------------------------------------

describe("metArtworkMeta and the day-long cache behind it", () => {
  it("THROWS when the record could not be fetched, rather than saying 'no doorway'", async () => {
    // A throttled second used to return null here, which the route wrote into
    // the CDN as a settled answer until tomorrow.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 403)));
    await expect(met.metArtworkMeta("437980")).rejects.toThrow();
  });

  it("still answers null for a genuine 404, which is a settled answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 404)));
    await expect(met.metArtworkMeta("999999999")).resolves.toBeNull();
  });

  it("leaves every other caller forgiving — a batch that loses a record still serves", async () => {
    const fetchMock = vi.fn(async (u: string) => {
      if (u.includes("/search?")) return json({ objectIDs: [1, 2, 3] });
      const id = Number(u.split("/objects/")[1]);
      return id === 2 ? json({}, 403) : json(work(id));
    });
    vi.stubGlobal("fetch", fetchMock);
    const cards = await met.metDiscover("impressionism", 0, 3);
    expect(cards.length).toBeGreaterThan(0);
  });
});
