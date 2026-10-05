import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/editor-e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3100", ...devices["Desktop Chrome"] },
  webServer: {
    command: "node scripts/editor-harness.mjs",
    url: "http://127.0.0.1:3100/editor-test-harness",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
