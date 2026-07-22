import { describe, it, expect } from "vitest";
import { normalizeSiteUrl, INDEXABLE_ROUTES, PRIVATE_ROUTES } from "./site";

describe("normalizeSiteUrl", () => {
  it("drops trailing slashes so `${siteUrl()}/x` never doubles up", () => {
    expect(normalizeSiteUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeSiteUrl("https://example.com///")).toBe("https://example.com");
    expect(normalizeSiteUrl("  https://example.com/  ")).toBe("https://example.com");
  });

  it("keeps a path prefix intact for a sub-path deployment", () => {
    expect(normalizeSiteUrl("https://example.com/drift")).toBe(
      "https://example.com/drift",
    );
  });

  it("falls back to the live site when unset or blank", () => {
    for (const raw of [undefined, null, "", "   "]) {
      expect(normalizeSiteUrl(raw)).toBe("https://www.usedrift.org");
    }
  });
});

describe("what search engines are pointed at", () => {
  it("indexes only routes that render content to a signed-out visitor", () => {
    // These four are `/` (the landing page) plus AuthGate's PUBLIC_ROUTES.
    expect([...INDEXABLE_ROUTES]).toEqual(["/", "/privacy", "/install", "/contact"]);
  });

  it("never lists a login-gated route as indexable", () => {
    for (const priv of PRIVATE_ROUTES) {
      const clash = INDEXABLE_ROUTES.filter(
        (r) => r !== "/" && (r === priv || r.startsWith(priv)),
      );
      expect(clash, `${priv} is both indexable and private`).toEqual([]);
    }
  });

  it("keeps every route rooted, so they concatenate onto the origin cleanly", () => {
    for (const r of [...INDEXABLE_ROUTES, ...PRIVATE_ROUTES]) {
      expect(r.startsWith("/"), r).toBe(true);
      expect(r.includes("//"), r).toBe(false);
    }
  });

  it("blocks the API surface from crawlers", () => {
    expect([...PRIVATE_ROUTES]).toContain("/api/");
  });
});
