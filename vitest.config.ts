import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Phase 1 only needs to unit-test the pure logic in src/lib (no DOM), so the
// default node environment is fine. Component/E2E testing comes in later phases.
//
// The `@/` alias is resolved here because the SERVER adapters use it
// (`@/lib/upstream`, `@/lib/wiki-server`) while the pure lib modules use relative
// paths. Without it those adapters could not be imported by a test at all, which
// is why nothing in `realms/server/*` had unit tests: the request-shaping there —
// how many records a doorway fetches, whether a search is de-duplicated — is
// exactly the logic that turned out to matter under load.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
