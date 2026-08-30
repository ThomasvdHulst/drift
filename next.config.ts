import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ---------------------------------------------------------------------------
  // The baked doorway index has to travel with the function that reads it.
  //
  // `src/lib/realms/server/met.ts` loads `met.doorway.*` with `fs` rather than
  // importing them, because a ~12 MB JSON module would be parsed by the bundler
  // and inflated into the JS heap when what is wanted is a flat string and two
  // typed arrays. The cost of that choice is that Next's dependency tracing
  // cannot see the files — nothing imports them — so they must be named here or
  // the deployed function finds nothing and the doorway goes quiet in
  // production while working perfectly on the developer's machine.
  //
  // Phase 35 added two more (`met.facets.*`, `met.artists.*`) behind the Gallery's
  // own threads and its artist lookups, so the glob covers every baked table
  // rather than naming them one at a time. Three routes reach the adapter:
  // `/api/doorway`, `/api/realm/[realm]/*`, and the artist search.
  // ---------------------------------------------------------------------------
  outputFileTracingIncludes: {
    "/api/doorway": ["./src/lib/realms/met.*.gz"],
    "/api/realm/[realm]/**": ["./src/lib/realms/met.*.gz"],
    "/api/realm/gallery/artists": ["./src/lib/realms/met.*.gz"],
  },
};

export default nextConfig;
