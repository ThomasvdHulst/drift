// ---------------------------------------------------------------------------
// One property, with a day-long blast radius: an EMPTY thread list must never
// be cached.
//
// This route sent `s-maxage=86400` on whatever came back. So a card whose
// threads were empty because the museum was throttling — or because the Met
// breaker was open and the adapter deliberately made no request at all — had
// "this card has no threads" written into the CDN for every reader until
// tomorrow, and nothing in the app would ever have re-asked. Discover had
// guarded against exactly this since Phase 31; related had not.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, afterEach } from "vitest";

const related = vi.fn();
vi.mock("@/lib/realms/server", () => ({
  serverRealm: (id: string) => (id === "gallery" ? { related } : undefined),
}));

const { GET } = await import("./route");

const call = (id: string) =>
  GET(new Request(`https://drift.test/api/realm/gallery/related?id=${id}`), {
    params: Promise.resolve({ realm: "gallery" }),
  });

afterEach(() => vi.restoreAllMocks());

describe("GET /api/realm/[realm]/related", () => {
  it("caches a real answer for a day", async () => {
    related.mockResolvedValue([{ pageTitle: "1", threadLabel: "Anon", facet: "artist:Anon" }]);
    const res = await call("437980");
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  it("does NOT cache an empty answer", async () => {
    related.mockResolvedValue([]);
    const res = await call("437980");
    expect(await res.json()).toEqual([]);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("does not cache an upstream failure either", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    related.mockRejectedValue(new Error("Upstream responded 403"));
    const res = await call("437980");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
