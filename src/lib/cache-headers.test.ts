import { describe, it, expect } from "vitest";
import {
  cacheControl,
  cacheHeaders,
  CACHE_STABLE,
  CACHE_MEDIUM,
  NO_STORE,
} from "./cache-headers";

describe("cacheControl", () => {
  it("emits a public, edge-cacheable directive with browsers revalidating", () => {
    const v = cacheControl(CACHE_STABLE);
    expect(v).toContain("public");
    expect(v).toContain("max-age=0"); // browser does not cache
    expect(v).toContain("s-maxage=86400"); // shared CDN caches a day
    expect(v).toContain("stale-while-revalidate=604800");
  });

  it("distinguishes the medium profile", () => {
    expect(cacheControl(CACHE_MEDIUM)).toContain("s-maxage=3600");
  });

  it("cacheHeaders wraps the value under Cache-Control", () => {
    expect(cacheHeaders(CACHE_STABLE)).toEqual({
      "Cache-Control": cacheControl(CACHE_STABLE),
    });
  });

  it("NO_STORE never caches (guards transient failures)", () => {
    expect(NO_STORE["Cache-Control"]).toBe("no-store");
  });
});
