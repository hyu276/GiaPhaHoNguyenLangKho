/**
 * HOME_PAGE_E2E
 *
 * Purpose: Confirms the public application shell renders its primary identity successfully.
 * Connections: Playwright, the root App Router page, and the local Next.js server.
 * Risk: Low because this is a read-only smoke test without persistent data.
 */
import { expect, test } from "@playwright/test";

test("renders the public genealogy foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Gia phả họ Nguyễn Làng Khô",
      level: 1,
    }),
  ).toBeVisible();

  await expect(page.getByText("Foundation v0.1")).toBeVisible();
});
