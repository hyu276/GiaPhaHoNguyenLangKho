import { expect, test } from "@playwright/test";

const name = "Thành viên kiểm thử A";

test.beforeEach(async ({ page }) => {
  await page.goto("/editor-test-harness");
});

test("drawer preserves a visible selected node and bounded canvas", async ({
  page,
}) => {
  const node = page.getByRole("group", {
    name: `${name}, 1950 – nay, Riêng tư`,
    exact: true,
  });
  await node.click();
  await expect(
    page.getByRole("heading", { name: "Thông tin thành viên" }),
  ).toBeVisible();
  await expect(node).toBeInViewport({ ratio: 1 });
  await page.getByRole("button", { name: "Sửa hồ sơ", exact: true }).click();
  await expect(node).toBeInViewport({ ratio: 1 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollHeight > innerHeight + 1,
  );
  expect(overflow).toBe(false);
  await expect(page.getByText("PERSON CRUD")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Quyền hiển thị", exact: true }),
  ).toBeVisible();
});

test("empty search has a recovery action", async ({ page }) => {
  await page.getByRole("searchbox").fill("NoMatchingMember");
  await expect(page.getByText("Không tìm thấy thành viên")).toBeVisible();
  await page.getByRole("button", { name: "Hiện tất cả thành viên" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});

test("keyboard selection opens inspector; rejected discard preserves draft", async ({
  page,
}) => {
  const node = page.getByRole("group", {
    name: `${name}, 1950 – nay, Riêng tư`,
    exact: true,
  });
  await node.focus();
  await node.press("Enter");
  await page.getByRole("button", { name: "Sửa hồ sơ", exact: true }).click();
  await page.getByLabel("Họ tên", { exact: true }).fill("Bản nháp chưa lưu");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Đóng bảng thông tin" }).click();
  await expect(page.getByLabel("Họ tên", { exact: true })).toHaveValue(
    "Bản nháp chưa lưu",
  );
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await expect(
    page.getByText(
      "Không thể kết nối để lưu hồ sơ. Nội dung vẫn được giữ, hãy thử lại.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lưu hồ sơ", exact: true }),
  ).toBeEnabled();
});

test("mobile form scrolls without overflowing the workspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Thêm thành viên" }).click();
  await expect(page.getByLabel("Họ tên", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lưu hồ sơ", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Thêm thành viên", exact: true }),
  ).toHaveCount(0);
});
