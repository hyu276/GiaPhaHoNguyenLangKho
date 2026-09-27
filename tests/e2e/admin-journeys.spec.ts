import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const spectatorEmail = process.env.E2E_SPECTATOR_EMAIL;
const spectatorPassword = process.env.E2E_SPECTATOR_PASSWORD;
const hasSupabaseEnvironment = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
const hasAdminCredentials = Boolean(
  hasSupabaseEnvironment && adminEmail && adminPassword,
);
const hasSpectatorCredentials = Boolean(
  hasSupabaseEnvironment && spectatorEmail && spectatorPassword,
);

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/admin\/tree$/);
  await expect(
    page.getByRole("heading", { name: "Sơ đồ gia phả", level: 1 }),
  ).toBeVisible();
}

test("admin login form has a keyboard-accessible focus order", async ({
  page,
}) => {
  await page.goto("/admin/login");

  const email = page.getByLabel("Email");
  const password = page.getByLabel("Mật khẩu");
  const submit = page.getByRole("button", { name: "Đăng nhập" });

  await page.keyboard.press("Tab");
  await expect(email).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
});

test.describe("credentialed admin journey", () => {
  test.skip(
    !hasAdminCredentials,
    "Requires Supabase public env plus E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.",
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page, adminEmail!, adminPassword!);
  });

  test("opens release-review workspaces and closes them from the keyboard", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Bulk & backup" }).click();
    const bulkDialog = page.getByRole("dialog", {
      name: "Bulk utilities and backup",
    });
    await expect(bulkDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(bulkDialog).toBeHidden();

    await page.getByRole("button", { name: "Data quality" }).click();
    const qualityDialog = page.getByRole("dialog", {
      name: "Data-quality dashboard",
    });
    await expect(qualityDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(qualityDialog).toBeHidden();

    await page.getByRole("button", { name: "Review duplicates" }).click();
    const duplicateDialog = page.getByRole("dialog", {
      name: "Duplicate Detection & Merge Review",
    });
    await expect(duplicateDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(duplicateDialog).toBeHidden();
  });

  test("keeps destructive bulk actions behind preview and typed confirmation", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Bulk & backup" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Bulk utilities and backup",
    });

    await expect(
      dialog.getByRole("button", { name: /Preview impact/ }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Thực thi batch visibility" }),
    ).toHaveCount(0);
  });
});

test.describe("credentialed spectator journey", () => {
  test.skip(
    !hasSpectatorCredentials,
    "Requires Supabase public env plus spectator E2E credentials.",
  );

  test("keeps mutation and review tooling hidden", async ({ page }) => {
    await signIn(page, spectatorEmail!, spectatorPassword!);

    await expect(
      page.getByRole("button", { name: "Bulk & backup" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Data quality" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Review duplicates" }),
    ).toHaveCount(0);
    await expect(page.getByText("Spectator · chỉ xem")).toBeVisible();
  });
});
