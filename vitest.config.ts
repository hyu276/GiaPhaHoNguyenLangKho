/**
 * VITEST_CONFIG
 *
 * Purpose: Configures fast deterministic unit tests and code coverage for repository modules.
 * Connections: Vitest CLI, source aliases, and tests under the unit test directory.
 * Risk: Medium because incorrect test configuration can create false confidence.
 */
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
