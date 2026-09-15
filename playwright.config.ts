/**
 * PLAYWRIGHT_CONFIG
 *
 * Purpose: Configures browser-level smoke tests against a locally served Next.js application.
 * Connections: Playwright Test, the Next.js development server, and end-to-end specifications.
 * Risk: Medium because E2E configuration determines production-critical journey coverage.
 */
import { defineConfig, devices } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  ...(isCi ? { workers: 1 } : {}),
  reporter: isCi ? "github" : "list",
  use: {
    baseURL: baseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseUrl,
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
