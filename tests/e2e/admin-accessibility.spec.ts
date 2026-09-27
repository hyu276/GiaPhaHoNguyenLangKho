import { expect, test } from "@playwright/test";

test("admin login is keyboard accessible", async ({ page }) => {
  await page.goto("/admin/login");

  await expect(
    page.getByRole("heading", { name: "Đăng nhập để xem gia phả", level: 1 }),
  ).toBeVisible();

  const email = page.getByLabel("Email");
  const password = page.getByLabel("Mật khẩu");
  const submit = page.getByRole("button", { name: "Đăng nhập" });

  await page.keyboard.press("Tab");
  await expect(email).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();

  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(password).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
});
