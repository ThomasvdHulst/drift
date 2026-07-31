import { describe, it, expect } from "vitest";
import {
  normalizeSiteUrl,
  INDEXABLE_ROUTES,
  PRIVATE_ROUTES,
  PUBLIC_CONTENT_ROUTES,
  PUBLIC_UTILITY_ROUTES,
  isPublicRoute,
} from "./site";

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
  // The invariant, rather than a copy of the list: every indexed route must
  // actually render to a signed-out visitor, and every content page that does
  // render must be indexed. Pinning the literal list instead only proved the
  // list had not changed, which is not the property that matters and went stale
  // the first time a page was added.
  it("indexes the landing page and exactly the public content routes", () => {
    expect([...INDEXABLE_ROUTES]).toEqual(["/", ...PUBLIC_CONTENT_ROUTES]);
  });

  it("indexes nothing the auth gate would hide", () => {
    for (const r of INDEXABLE_ROUTES) {
      if (r === "/") continue; // the landing page IS the signed-out view of /
      expect(isPublicRoute(r), `${r} is indexed but gated`).toBe(true);
    }
  });

  it("keeps the one-time auth landing strip out of the sitemap", () => {
    for (const r of PUBLIC_UTILITY_ROUTES) {
      expect(isPublicRoute(r), `${r} must render signed out`).toBe(true);
      expect([...INDEXABLE_ROUTES], `${r} has nothing to index`).not.toContain(r);
    }
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

describe("isPublicRoute", () => {
  it("opens every published note, and the index", () => {
    expect(isPublicRoute("/notes")).toBe(true);
    expect(isPublicRoute("/notes/why-drift-exists")).toBe(true);
    expect(isPublicRoute("/notes/anything-published-later")).toBe(true);
  });

  it("keeps the gate closed on everything else", () => {
    for (const p of ["/drift", "/trails", "/atlas", "/account", "/friends", "/"]) {
      expect(isPublicRoute(p), p).toBe(false);
    }
  });

  it("matches the notes prefix on a path boundary, not a string prefix", () => {
    // `/notes` + slash, never bare `startsWith("/notes")`: otherwise a route that
    // merely begins with those letters would fall out of the gate.
    expect(isPublicRoute("/notesecret")).toBe(false);
    expect(isPublicRoute("/notes-private")).toBe(false);
  });
});
