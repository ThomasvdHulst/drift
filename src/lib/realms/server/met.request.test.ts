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

// ---------------------------------------------------------------------------
// Phase 33I — a room that THINS instead of emptying.
//
// The bug these pin was measured in production on 30 August: five sequential
// Gallery room requests from ONE person left the last two serving zero cards,
// in 1.4ms, with the server log completely empty. `metDiscover` fired every
// candidate id through a single `Promise.all`, so when our own gate's window was
// spent all fifteen threw together and the batch collapsed to nothing.
//
// A room that is short by half still reads. A room with nothing in it is broken,
// and the feed has to fall back to a thread neighbour. So the properties are:
// ask for no more than needed, top up when the filter drops records, keep what
// arrived when the rest is refused, and SAY SO — because the class of refusal
// that actually fires (our gate, our breaker) is thrown before `fetchUpstream`
// ever logs a line, and so left no trace at all.
// ---------------------------------------------------------------------------
describe("metDiscover thins instead of emptying", () => {
  // `medieval` has a baked pool (met.pools.json), so there is no search to mock
  // and every request counted here is a record fetch.
  const BUCKET = "medieval";

  it("asks for only what it needs when every record is usable", async () => {
    // The overfetch multiplier exists to cover records the filter drops. On a
    // baked pool almost nothing is dropped, so paying for it up front was pure
    // waste: 15 requests for a 12-card seed where 12 would do.
    const fetchMock = vi.fn(async (u: string) =>
      json(work(Number(u.split("/objects/")[1]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const cards = await met.metDiscover(BUCKET, 0, 8);
    expect(cards).toHaveLength(8);
    expect(objectCalls(fetchMock)).toHaveLength(8);
  });

  it("tops up past the first wave when the filter drops records", async () => {
    // Two of the first wave are still in copyright, so it comes back short and
    // the next wave asks for exactly the shortfall — never for more than the
    // overfetch already allowed, which is what keeps the saving above honest.
    let n = 0;
    const fetchMock = vi.fn(async (u: string) => {
      const id = Number(u.split("/objects/")[1]);
      const dropped = n === 1 || n === 3;
      n++;
      return json(work(id, dropped ? { isPublicDomain: false } : {}));
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await met.metDiscover(BUCKET, 0, 6);
    expect(cards).toHaveLength(6);
    // Six asked for, two dropped, two more fetched: eight, which is exactly the
    // baked overfetch. The waves never exceed what one `Promise.all` used to.
    expect(objectCalls(fetchMock)).toHaveLength(8);
  });

  it("returns the cards it did get when the rest cannot be fetched", async () => {
    // The property the whole phase is named for. A 404 is a real answer from a
    // healthy host and must not stop anything — the batch simply keeps asking.
    const fetchMock = vi.fn(async (u: string) => {
      const id = Number(u.split("/objects/")[1]);
      return id % 3 === 0 ? json({}, 404) : json(work(id));
    });
    vi.stubGlobal("fetch", fetchMock);

    const cards = await met.metDiscover(BUCKET, 0, 8);
    expect(cards.length).toBeGreaterThan(0);
  });

  it("makes NO request at all once the circuit is open, and says so", async () => {
    // Before this, an open circuit produced an empty room and total silence.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Trip the breaker: five consecutive throttles. Each summary is two (one
    // attempt plus its single retry), so three sequential calls is enough.
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 403)));
    for (let i = 0; i < 3; i++) {
      await met.metSummary(String(900 + i)).catch(() => null);
    }

    // A fresh mock, so anything counted below belongs to the discover alone.
    const fetchMock = vi.fn(async (u: string) =>
      json(work(Number(u.split("/objects/")[1]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const cards = await met.metDiscover(BUCKET, 0, 8);
    expect(cards).toHaveLength(0);
    // The point of a breaker: the refused batch costs the museum nothing.
    expect(objectCalls(fetchMock)).toHaveLength(0);
    // And the point of this phase: it is no longer invisible.
    const said = warn.mock.calls.map((c) => String(c[0])).join("\n");
    expect(said).toContain(BUCKET);
    expect(said).toContain("circuit open");
  }, 15_000);
});

// ---------------------------------------------------------------------------
// The priority lane. One shared window, callers that are not equally important:
// a card with no thread chips still reads, a room with no cards is broken. So
// threads and the doorway state a short ceiling and leave the budget to
// discover. Asserted at the seam, on the options `fetchJson` actually receives.
// ---------------------------------------------------------------------------
describe("threads and the doorway yield the window to cards", () => {
  type Opts = { maxWaitMs?: number; optional?: boolean };
  /** Re-import the adapter with `fetchJson` replaced, and report its options. */
  async function withSpy() {
    vi.resetModules();
    const calls: { url: string; opts: Opts }[] = [];
    const actual = await vi.importActual<typeof import("@/lib/upstream")>(
      "@/lib/upstream",
    );
    vi.doMock("@/lib/upstream", () => ({
      ...actual,
      fetchJson: vi.fn(async (url: string, opts: Opts = {}) => {
        calls.push({ url, opts });
        return url.includes("/search?")
          ? { objectIDs: [11, 12, 13] }
          : work(Number(url.split("/objects/")[1]));
      }),
    }));
    return { calls, mod: await import("./met") };
  }

  it("gives discover the full ceiling and threads a short one", async () => {
    const { calls, mod } = await withSpy();

    await mod.metDiscover("medieval", 0, 4);
    // Discover states neither: it may hold for the gate's own ceiling, and it
    // is exactly the work the reserve exists to protect.
    expect(calls.every((c) => c.opts.maxWaitMs === undefined)).toBe(true);
    expect(calls.every((c) => c.opts.optional === undefined)).toBe(true);

    calls.length = 0;
    await mod.metRelated("11");
    // Every thread call, search and record alike, takes the optional lane.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.opts.maxWaitMs === 1200)).toBe(true);
    expect(calls.every((c) => c.opts.optional === true)).toBe(true);
  });

  it("gives the doorway a short ceiling too, in both directions", async () => {
    const { calls, mod } = await withSpy();

    await mod.metTopMatch("Octopus", () => true);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.opts.optional === true)).toBe(true);

    calls.length = 0;
    await mod.metArtworkMeta("11");
    expect(calls.every((c) => c.opts.optional === true)).toBe(true);
  });
});
