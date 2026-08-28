import { describe, it, expect, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// The server registry honours the realm flags (pre-flyer review, finding 01).
//
// WHY THIS TEST EXISTS. `NEXT_PUBLIC_REALM_PAPERS` was read in the CLIENT
// registry only, so Papers vanished from the realm tabs while
// `/api/realm/papers/*` kept serving live arXiv abstracts to anyone who asked.
// The two registries disagreed, and nothing failed: no type error, no test, and
// no visible symptom, because the only way to see it was to call an endpoint the
// UI never calls.
//
// So the flag is pinned from BOTH sides here. A future edit that adds a realm to
// the server registry without its flag, or that quietly drops the `FLAGGED`
// lookup, turns one of these red.
//
// `resetModules` + a dynamic import is the mechanism: the flag is read once at
// module scope (which is what makes it cheap), so each case needs its own fresh
// copy of the module.
// ---------------------------------------------------------------------------

async function loadWithPapers(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) vi.stubEnv("NEXT_PUBLIC_REALM_PAPERS", "");
  else vi.stubEnv("NEXT_PUBLIC_REALM_PAPERS", value);
  return import("./index");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("serverRealm honours the realm flags", () => {
  it("does not serve papers when the flag is off", async () => {
    const { serverRealm } = await loadWithPapers("0");
    expect(serverRealm("papers")).toBeNull();
  });

  it("does not serve papers when the flag is absent", async () => {
    const { serverRealm } = await loadWithPapers(undefined);
    expect(serverRealm("papers")).toBeNull();
  });

  it("serves papers when the flag is exactly '1'", async () => {
    const { serverRealm } = await loadWithPapers("1");
    expect(serverRealm("papers")).not.toBeNull();
  });

  it("only '1' counts, matching the client registry's rule", async () => {
    // The client uses `=== "1"`. Anything looser here (a truthiness check, say)
    // would turn `NEXT_PUBLIC_REALM_PAPERS=0` into "on" on the server and "off"
    // in the browser, which is the exact split this test exists to prevent.
    for (const v of ["true", "yes", "on", "01", " 1"]) {
      const { serverRealm } = await loadWithPapers(v);
      expect(serverRealm("papers"), `NEXT_PUBLIC_REALM_PAPERS=${v}`).toBeNull();
    }
  });

  it("never gates the two realms that always ship", async () => {
    for (const v of ["0", "1", undefined]) {
      const { serverRealm } = await loadWithPapers(v);
      expect(serverRealm("encyclopedia")).not.toBeNull();
      expect(serverRealm("gallery")).not.toBeNull();
    }
  });

  it("an unknown realm is still null", async () => {
    const { serverRealm } = await loadWithPapers("1");
    expect(serverRealm("nonsense")).toBeNull();
    expect(serverRealm("")).toBeNull();
  });
});
