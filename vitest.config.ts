import { defineConfig } from "vitest/config";

// Phase 1 only needs to unit-test the pure logic in src/lib (no DOM), so the
// default node environment is fine. Component/E2E testing comes in later phases.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
