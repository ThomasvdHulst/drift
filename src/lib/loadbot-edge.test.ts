// ---------------------------------------------------------------------------
// The load-test harness's edge emulator (scripts/bots/edge.mjs) stands where
// Vercel's CDN stands. Its whole value depends on it caching exactly what the
// real edge would cache — no more, and no less.
//
// So it is pinned against the app's OWN cache headers rather than against a
// hand-written expectation: the profiles in lib/cache-headers.ts are fed through
// the emulator's parser, and the emulator's session check is fed the same
// headers as the app's. Retune a profile, or add one, and this test is what
// notices that the emulator is now measuring something else.
//
// The session case is the one that matters beyond the test. `carriesUserSession`
// exists because a public s-maxage on an authenticated response is how one
// reader's data gets served to another (audit M-10). An emulator that cached one
// would be reproducing that leak inside the harness, where nobody is looking.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  cacheControl,
  carriesUserSession as appCarriesUserSession,
  CACHE_STABLE,
  CACHE_MEDIUM,
  CACHE_SHORT,
  NO_STORE,
} from "./cache-headers";
import {
  parseCacheControl,
  carriesUserSession as edgeCarriesUserSession,
} from "../../scripts/bots/edge.mjs";

describe("the emulator reads the app's own cache profiles", () => {
  it("caches every real profile for exactly the stated lifetimes", () => {
    for (const p of [CACHE_STABLE, CACHE_MEDIUM, CACHE_SHORT]) {
      expect(parseCacheControl(cacheControl(p))).toEqual({
        sMaxAge: p.sMaxAge,
        swr: p.swr,
      });
    }
  });

  it("refuses to store the app's degraded / error answer", () => {
    // Every empty, throttled or failed branch in the API routes sends this. If
    // the emulator held one, the swarm would freeze an upstream hiccup in place
    // for the whole run and the report would show an implausibly healthy app.
    expect(parseCacheControl(NO_STORE["Cache-Control"])).toBeNull();
  });

  it("refuses anything without a shared-cache lifetime", () => {
    for (const v of [
      undefined,
      "",
      "public",
      "max-age=0",
      "public, max-age=600",
      "private, max-age=600, s-maxage=600",
      "no-store",
      "public, no-store, s-maxage=60",
    ]) {
      expect(parseCacheControl(v)).toBeNull();
    }
  });

  it("reads the long immutable header the artwork proxy sends", () => {
    // /api/img/met/... is the most expensive route in the app (an ~8MB original
    // downloaded and resized by sharp), so whether the emulator holds its output
    // is most of what a Gallery run measures.
    expect(
      parseCacheControl("public, max-age=2592000, s-maxage=2592000, immutable"),
    ).toEqual({ sMaxAge: 2592000, swr: 0 });
  });
});

describe("the emulator never caches an authenticated request", () => {
  const cases: { name: string; headers: Record<string, string> }[] = [
    { name: "no headers", headers: {} },
    { name: "an unrelated cookie", headers: { cookie: "theme=dark" } },
    { name: "a bearer token", headers: { authorization: "Bearer abc.def.ghi" } },
    {
      name: "a supabase auth cookie",
      headers: { cookie: "sb-xtkchofdxcteyyhhiasa-auth-token=xyz" },
    },
    {
      name: "a chunked supabase auth cookie",
      headers: { cookie: "theme=dark; sb-abc123-auth-token.0=xyz" },
    },
  ];

  it("agrees with the app's guard on every shape", () => {
    for (const { name, headers } of cases) {
      const request = new Request("https://example.test/api/x", { headers });
      expect(
        edgeCarriesUserSession(headers),
        `emulator disagreed with the app on: ${name}`,
      ).toBe(appCarriesUserSession(request));
    }
  });

  it("bypasses the two shapes that mean 'signed in'", () => {
    expect(edgeCarriesUserSession({ authorization: "Bearer x" })).toBe(true);
    expect(edgeCarriesUserSession({ cookie: "sb-proj-auth-token=x" })).toBe(true);
  });

  it("caches an ordinary anonymous request", () => {
    // The bots MUST look like this to /api/* — the real browser does, because
    // supabase-js keeps the session in localStorage, not a cookie. A driver that
    // sent its JWT here would silently disable the whole cache measurement.
    expect(edgeCarriesUserSession({})).toBe(false);
    expect(edgeCarriesUserSession({ cookie: "drift-theme=night" })).toBe(false);
  });
});
