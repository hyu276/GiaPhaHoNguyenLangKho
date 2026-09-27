import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test("admin release journey exposes review-only Step 10 tools", async ({
  page,
}) => {
  test.skip(
    !adminEmail || !adminPassword,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD at the release gate.",
  );

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(adminEmail as string);
  await page.getByLabel("Mật khẩu").fill(adminPassword as string);
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  await expect(
    page.getByRole("heading", { name: "Sơ đồ gia phả", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Import / Backup" }).click();
  await expect(
    page.getByRole("dialog", { name: "Import preview and backup" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng" }).click();

  await page.getByRole("button", { name: "Batch visibility" }).click();
  await expect(
    page.getByRole("dialog", { name: "Batch visibility" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng" }).click();

  await page.getByRole("button", { name: "Data quality" }).click();
  await expect(
    page.getByRole("dialog", { name: "Data-quality dashboard" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng" }).click();

  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
});
