import fs from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const previewRoot = path.join(process.cwd(), "preview");

async function previewAsset(requestPath: string) {
  if (requestPath === "/" || requestPath === "/index.html") {
    return {
      body: await fs.readFile(path.join(previewRoot, "index.html"), "utf8"),
      contentType: "text/html",
    };
  }
  if (requestPath === "/app.js") {
    return {
      body: await fs.readFile(path.join(previewRoot, "app.js"), "utf8"),
      contentType: "text/javascript",
    };
  }
  if (requestPath === "/styles.css") {
    return {
      body: await fs.readFile(path.join(previewRoot, "styles.css"), "utf8"),
      contentType: "text/css",
    };
  }
  return null;
}

async function openSyntheticAdmin(page: Page) {
  await page.route("http://preview.local/**", async (route) => {
    const url = new URL(route.request().url());
    const asset = await previewAsset(url.pathname);
    if (!asset) {
      await route.fulfill({ status: 404, body: "Not found" });
      return;
    }
    await route.fulfill({
      status: 200,
      body: asset.body,
      contentType: asset.contentType,
    });
  });

  await page.goto("http://preview.local/index.html");
  await expect(
    page.getByRole("heading", { name: "Sơ đồ gia phả" }),
  ).toBeVisible();
}

test("synthetic admin CRUD relationship and archive journey", async ({
  page,
}) => {
  await openSyntheticAdmin(page);

  await page.getByRole("button", { name: "Thêm thành viên" }).click();
  await page.locator("#nameField").fill("Nguyễn Test Journey");
  await page.locator("#birthField").fill("1990");
  await page
    .locator("#personDialog")
    .getByRole("button", { name: "Lưu" })
    .click();

  const createdNode = page.locator("#nodes .person-node", {
    hasText: "Nguyễn Test Journey",
  });
  await expect(createdNode).toHaveCount(1);
  await expect(createdNode).toBeVisible();

  await page.locator('[data-person-id="P003"]').click();
  await page.getByRole("button", { name: "Thêm con" }).click();
  await page.locator("#relationshipTarget").selectOption("P006");
  await page
    .locator("#relationshipDialog")
    .getByRole("button", { name: "Tạo quan hệ" })
    .click();
  await expect(page.locator("#relationList")).toContainText("Nguyễn Thị Lan");

  await page.locator('[data-person-id="P005"]').click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Lưu trữ" }).click();
  await page.locator("details.filter-menu > summary").click();
  await page.locator("#archiveFilter").selectOption("all");
  await expect(page.locator('[data-person-id="P005"]')).toHaveClass(/archived/);
});

test("synthetic provenance review journey preserves explicit claims", async ({
  page,
}) => {
  await openSyntheticAdmin(page);

  await page.locator('[data-person-id="P003"]').click();
  await page.getByRole("button", { name: "Thêm nguồn" }).click();
  await page.locator("#sourceTitle").fill("Nguồn E2E synthetic");
  await page.locator("#sourceReference").fill("E2E-001");
  await page
    .locator("#sourceDialog")
    .getByRole("button", { name: "Lưu nguồn" })
    .click();

  await page.getByRole("button", { name: "Thêm dẫn chứng" }).click();
  await page
    .locator("#citationSource")
    .selectOption({ label: "Nguồn E2E synthetic" });
  await page.locator("#citationKind").selectOption("identity");
  await page
    .locator("#citationClaim")
    .fill("Dẫn chứng E2E không thay đổi hồ sơ chính.");
  await page
    .locator("#citationDialog")
    .getByRole("button", { name: "Lưu dẫn chứng" })
    .click();

  await expect(page.locator("#provenanceCitations")).toContainText(
    "Dẫn chứng E2E không thay đổi hồ sơ chính.",
  );
});

test("synthetic duplicate quality and bulk release journey", async ({
  page,
}) => {
  await openSyntheticAdmin(page);
  await page.locator("details.admin-menu > summary").click();

  await page.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }).click();
  await expect(page.locator("#duplicateCandidateList")).toContainText(
    "Nguyễn Văn Cường",
  );
  await page.locator("#duplicateDialog button[aria-label='Đóng']").click();

  await page.getByRole("button", { name: "Kiểm tra dữ liệu" }).click();
  await expect(page.locator("#qualityWarningCount")).not.toHaveText("0");
  await page.locator("#qualityDialog button[aria-label='Đóng']").click();

  await page.getByRole("button", { name: "Dữ liệu & sao lưu" }).click();
  await page.getByRole("button", { name: "Chọn tất cả" }).click();
  await page.locator("#bulkVisibility").selectOption("public");
  await expect(page.locator("#bulkLivingPublicCount")).not.toHaveText("0");

  await page.locator("#bulkConfirmation").fill("XÁC NHẬN");
  await expect(page.locator("#bulkExecuteVisibility")).toBeEnabled();
  await page.locator("#bulkExecuteVisibility").click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải bản sao lưu JSON" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const backupText = await fs.readFile(downloadPath!, "utf8");
  await page.locator("#bulkImportText").fill(backupText);
  await page.getByRole("button", { name: "Kiểm tra tệp" }).click();
  await expect(page.locator("#bulkImportResult")).toContainText("Tệp hợp lệ");
});

test("product shell stays usable on mobile and dismisses transient UI", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSyntheticAdmin(page);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.locator('[data-person-id="P003"]').click();
  await expect(page.locator(".inspector")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".inspector")).toBeHidden();

  await page.locator("details.admin-menu > summary").click();
  await page.getByRole("button", { name: "Kiểm tra dữ liệu" }).click();
  await expect(page.locator("details.admin-menu")).not.toHaveAttribute("open");
  await expect(page.locator("#qualityDialog")).toBeVisible();
  await page.locator("#qualityDialog button[aria-label='Đóng']").click();
});
