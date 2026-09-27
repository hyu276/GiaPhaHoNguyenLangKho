import { expect, test } from "@playwright/test";

test("admin login remains keyboard navigable", async ({ page }) => {
  await page.goto("/admin/login");

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Mật khẩu")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeFocused();
});
