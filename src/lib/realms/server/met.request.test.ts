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

// ---------------------------------------------------------------------------
// The doorway reads a BAKED INDEX and asks the museum nothing to decide
// (Phase 34). These run against the real `met.doorway.*` files, deliberately:
// the whole claim is about the real catalogue, and a synthetic blob would prove
// only that the matcher works — which doorwayindex.test.ts already pins.
// ---------------------------------------------------------------------------
describe("metTopMatch — the doorway lookup", () => {
  it("costs NOTHING when there is no Gallery match", async () => {
    // The point of the phase. About half of all cards land here, and each of
    // those used to pay a search plus up to five record fetches to find out.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await met.metTopMatch("Existentialism")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("costs ONE request when there is one", async () => {
    // The image path is the only thing the published catalogue lacks, so a hit
    // is exactly one record fetch and never a search.
    const fetchMock = vi.fn(async (u: string) =>
      json(work(Number(u.split("/objects/")[1]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await met.metTopMatch("Octopus")).not.toBeNull();
    expect(searchCalls(fetchMock)).toHaveLength(0);
    expect(objectCalls(fetchMock)).toHaveLength(1);
  });

  it("never searches, whatever the term", async () => {
    const fetchMock = vi.fn(async (u: string) =>
      json(work(Number(u.split("/objects/")[1]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    for (const term of ["Octopus", "Mount Fuji", "Quantum mechanics", "Cat"]) {
      await met.metTopMatch(term);
    }
    expect(searchCalls(fetchMock)).toHaveLength(0);
  });

  it("falls through to the next candidate when a record is unusable", async () => {
    // A work the museum has withdrawn since the index was baked, or one whose
    // record fails `usable()`. The spares exist for exactly this.
    let n = 0;
    const fetchMock = vi.fn(async (u: string) => {
      const id = Number(u.split("/objects/")[1]);
      n++;
      return json(n === 1 ? work(id, { primaryImage: "" }) : work(id));
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await met.metTopMatch("Octopus")).not.toBeNull();
    expect(objectCalls(fetchMock)).toHaveLength(2);
  });

  it("gives up after three records rather than walking the candidates", async () => {
    const fetchMock = vi.fn(async (u: string) =>
      json(work(Number(u.split("/objects/")[1]), { primaryImage: "" })),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await met.metTopMatch("Cat")).toBeNull();
    expect(objectCalls(fetchMock).length).toBeLessThanOrEqual(3);
  });

  it("answers the canonical cases, and stays silent on the abstract ones", async () => {
    // The same cases the old gate was verified against against the live API,
    // now answered from the baked catalogue with no request behind the decision.
    const fetchMock = vi.fn(async (u: string) =>
      json(work(Number(u.split("/objects/")[1]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    for (const term of ["Octopus", "Samurai", "Mount Fuji", "Cat", "Hokusai"]) {
      expect(await met.metTopMatch(term), term).not.toBeNull();
    }
    for (const term of [
      "Quantum mechanics",
      "Existentialism",
      "Inflation",
      "Game theory",
      "Photosynthesis",
    ]) {
      expect(await met.metTopMatch(term), term).toBeNull();
    }
  });

  it("THROWS when the record cannot be fetched, instead of saying 'no doorway'", async () => {
    // The load-bearing half of caching a miss for a day. The decision is now
    // local and cannot be throttled, but the record fetch behind a HIT still
    // can, and that failure must not be cached as a settled "nothing here".
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 403)));
    await expect(met.metTopMatch("Octopus")).rejects.toThrow();
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

  it("still returns null for an article with genuinely no match", async () => {
    // And now without asking anyone: the index settles it locally.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { crossRealmDoorway } = await import("./doorway");
    await expect(
      crossRealmDoorway("encyclopedia", "Existentialism"),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
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
  // ⚠️ THESE NOW EXERCISE THE FALLBACK, and the values are chosen so they must.
  // Phase 35 answers a facet from the baked index whenever it has one, so a real
  // artist like Winslow Homer never reaches a search any more. The quoting and
  // parameter-order rules still govern the search that runs when the index has
  // nothing, so the values below are deliberately absent from the catalogue.
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
      artistDisplayName: "Zzz Nonexistent Painter",
      tags: [{ term: "Zzzsubject" }],
      department: "Zzz Nonexistent Department",
    });
    expect(qs).toContain("Zzz Nonexistent Painter");
    expect(qs).toContain("Zzzsubject");
    expect(qs).toContain("Zzz Nonexistent Department");
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
        : json(work(9, { artistDisplayName: "Zzz Nonexistent Painter" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await met.metRelated("9");
    const artistSearch = searchCalls(fetchMock)
      .map(url)
      .find((u) => u.includes("artistOrCulture"));
    const qs = artistSearch!.split("?")[1];
    expect(qs.indexOf("q=")).toBeGreaterThan(qs.indexOf("artistOrCulture"));
  });

  it("and the doorway does not search at all any more", async () => {
    // This case used to assert the OPPOSITE — that the doorway phrase-quoted,
    // because quoting was measured to pay there and only there. Phase 34 removed
    // the search itself, so the facet searches below are the only ones left and
    // `phraseQuery` is gone. Kept, inverted, because "the doorway must not
    // search" is now the property worth pinning.
    const fetchMock = vi.fn().mockResolvedValue(json({ objectIDs: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await met.metTopMatch("Winslow Homer");
    expect(searchCalls(fetchMock)).toHaveLength(0);
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
  // ⚠️ `vi.doMock` REGISTRATIONS SURVIVE `vi.resetModules()`, so this block has to
  // clean up after itself. Without this every test declared BELOW it silently ran
  // against a mocked `fetchJson` that never touches the fetch stub — and three of
  // the Phase 35 tests passed for that reason rather than on their merits, which
  // is the worst way for a test to be green.
  afterEach(() => {
    vi.doUnmock("@/lib/upstream");
    vi.resetModules();
  });

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

    await mod.metTopMatch("Octopus");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.opts.optional === true)).toBe(true);

    calls.length = 0;
    await mod.metArtworkMeta("11");
    expect(calls.every((c) => c.opts.optional === true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 35 — the Gallery's own lookups stop searching too.
//
// Measured before any of this, on 30 August 2026: six cards read in European
// Paintings cost 26 Met requests (7 searches, 19 record fetches), one artist
// search cost 30 to return two names, and one artist profile about 24. The
// artist and subject facets differ on every card, so unlike the room and
// department searches they could never be cached — which is why an artist-rich
// room cost twice what `medieval` did.
//
// These run against the real baked tables, like the doorway's, because the claim
// is about the real catalogue.
// ---------------------------------------------------------------------------
describe("the Gallery's threads come from the baked facets", () => {
  /** A record whose facets all exist in the baked index. */
  function gallery(id: number) {
    return work(id, {
      artistDisplayName: "Rembrandt (Rembrandt van Rijn)",
      culture: "",
      country: "",
      department: "Drawings and Prints",
      tags: [{ term: "Cats" }],
    });
  }

  it("makes NO search at all for a card's threads", async () => {
    const fetchMock = vi.fn(async (u: string) =>
      json(gallery(Number(u.split("/objects/")[1]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const threads = await met.metRelated("11");
    expect(threads.length).toBeGreaterThan(0);
    expect(searchCalls(fetchMock)).toHaveLength(0);
  });

  it("fetches at most two records per facet, not three", async () => {
    // FETCH_PER_FACET was 3 only because a live search returned works the filter
    // then dropped. The baked lists are already filtered.
    const fetchMock = vi.fn(async (u: string) =>
      json(gallery(Number(u.split("/objects/")[1]))),
    );
    vi.stubGlobal("fetch", fetchMock);

    await met.metRelated("11");
    // The card itself, plus at most 2 per facet across at most 3 facets.
    expect(objectCalls(fetchMock).length).toBeLessThanOrEqual(1 + 2 * 3);
  });

  it("falls back to the live search for a facet the index cannot answer", async () => {
    // The fallback is a real one, not a formality: a card with no doorway chip is
    // ordinary, but a card with no threads is a dead end. So unlike the doorway,
    // a facet the index has nothing for degrades to the search it replaced —
    // which also covers a newly acquired work, or a missing index file.
    const fetchMock = vi.fn(async (u: string) =>
      u.includes("/search?")
        ? json({ objectIDs: [91, 92, 93] })
        : json(
            work(Number(u.split("/objects/")[1]), {
              artistDisplayName: "Zzz Nonexistent Painter",
              department: "Zzz Nonexistent Department",
            }),
          ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const threads = await met.metRelated("11");
    expect(searchCalls(fetchMock).length).toBeGreaterThan(0);
    expect(threads.length).toBeGreaterThan(0);
  });
});

describe("the artist lookups cost nothing", () => {
  it("answers an artist search without a single request", async () => {
    // This was the most expensive single action in the app, and it fired while
    // the reader was waiting: 30 requests to return two names.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const hits = await met.metArtistSearch("Rembrandt");
    expect(hits.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still separates the two Rembrandts", async () => {
    vi.stubGlobal("fetch", vi.fn());
    // The museum's own spelling is what the table is keyed on, and the case the
    // live version was verified against: both Rembrandts, told apart.
    const names = (await met.metArtistSearch("Rembrandt")).map((a) => a.name);
    expect(names).toContain("Rembrandt (Rembrandt van Rijn)");
    expect(names).toContain("Rembrandt Peale");
  });

  it("refuses an artist still in copyright, rather than offering an empty feed", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await met.metArtistSearch("Picasso")).toEqual([]);
  });

  it("answers a profile without a single request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const profile = await met.metArtistProfile("Rembrandt (Rembrandt van Rijn)");
    expect(profile?.works).toBeGreaterThan(0);
    expect(profile?.department).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
