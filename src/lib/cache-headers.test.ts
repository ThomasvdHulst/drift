import { describe, it, expect, afterEach, vi } from "vitest";
import {
  cacheControl,
  cacheHeaders,
  carriesUserSession,
  CACHE_STABLE,
  CACHE_MEDIUM,
  NO_STORE,
} from "./cache-headers";

const req = (headers: Record<string, string> = {}) =>
  new Request("https://drift.test/api/realm/gallery/discover?bucket=x", { headers });

// `process.env.NODE_ENV` is not a plain writable property under vitest, so it
// takes the framework's own stub rather than an assignment.
const setEnv = (value: string) => vi.stubEnv("NODE_ENV", value);
afterEach(() => vi.unstubAllEnvs());

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
    expect(cacheHeaders(CACHE_STABLE, req())).toEqual({
      "Cache-Control": cacheControl(CACHE_STABLE),
    });
  });

  it("NO_STORE never caches (guards transient failures)", () => {
    expect(NO_STORE["Cache-Control"]).toBe("no-store");
  });
});

describe("carriesUserSession", () => {
  it("sees a bearer token", () => {
    expect(carriesUserSession(req({ authorization: "Bearer abc.def" }))).toBe(true);
  });

  it("sees a Supabase auth cookie, including a chunked one", () => {
    expect(carriesUserSession(req({ cookie: "sb-xtkc1234-auth-token=x" }))).toBe(true);
    expect(carriesUserSession(req({ cookie: "sb-abc-auth-token.0=x; other=1" }))).toBe(true);
    expect(carriesUserSession(req({ cookie: "theme=dark; sb-p-auth-token=y" }))).toBe(true);
  });

  it("is not fooled by an unrelated cookie that merely starts with sb", () => {
    expect(carriesUserSession(req({ cookie: "sbux=1; sb-theme=dark" }))).toBe(false);
  });

  it("is false for an ordinary anonymous request", () => {
    expect(carriesUserSession(req())).toBe(false);
    expect(carriesUserSession(req({ cookie: "theme=dark" }))).toBe(false);
  });
});

// `Cache-Control: public` plus `s-maxage` on a shared edge is exactly how one
// user's response gets served to everyone else (compliance audit M-10). Today no
// cached route reads the session. This makes that a property rather than a habit.
describe("the shared-cache guard", () => {
  it("throws in development, at the moment the mistake is made", () => {
    setEnv("development");
    expect(() => cacheHeaders(CACHE_STABLE, req({ authorization: "Bearer x" }))).toThrow(
      /refusing to set a public, shared-CDN cache/,
    );
  });

  // Asymmetric on purpose: in production a route that stops caching is a
  // performance problem, and serving one reader's data to another is not a
  // problem you get to fix afterwards.
  it("degrades to no-store in production rather than taking the site down", () => {
    setEnv("production");
    expect(cacheHeaders(CACHE_STABLE, req({ authorization: "Bearer x" }))).toEqual(
      NO_STORE,
    );
    expect(cacheHeaders(CACHE_STABLE, req({ cookie: "sb-abc-auth-token=y" }))).toEqual(
      NO_STORE,
    );
  });

  it("never emits an s-maxage for a request carrying a session, in any environment", () => {
    for (const env of ["development", "production", "test"]) {
      setEnv(env);
      let value: string;
      try {
        value = cacheHeaders(CACHE_STABLE, req({ authorization: "Bearer x" }))[
          "Cache-Control"
        ];
      } catch {
        continue; // throwing is the strongest possible pass
      }
      expect(value, env).not.toContain("s-maxage");
    }
  });
});
