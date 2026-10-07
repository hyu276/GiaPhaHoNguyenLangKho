import { expect, test, type Page } from "@playwright/test";

const person = '[data-id="11111111-1111-4111-8111-111111111111"]';

async function viewport(page: Page) {
  return page.locator(".react-flow__viewport").evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });
}

async function movePerson(page: Page, dx: number, dy: number) {
  const box = await page.locator(`.react-flow__node${person}`).boundingBox();
  if (!box) throw new Error("Missing synthetic person node");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

async function savedMoves(page: Page) {
  return JSON.parse(
    (await page.getByLabel("Các lần lưu bố cục").textContent()) ?? "[]",
  ) as Array<
    Array<{ positionX: number; positionY: number; expectedRevision: number }>
  >;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/editor-test-harness");
  await expect(page.locator(`.react-flow__node${person}`)).toBeVisible();
  await expect(
    page.locator(
      '.react-flow__edge[data-id="parent-child"] path.react-flow__edge-path',
    ),
  ).toBeVisible();
});

test("wheel pans vertically and horizontally without changing zoom", async ({
  page,
}) => {
  const before = await viewport(page);
  const canvas = await page
    .getByRole("region", { name: "Sơ đồ gia phả tương tác" })
    .boundingBox();
  if (!canvas) throw new Error("Missing canvas");
  await page.mouse.move(canvas.x + 40, canvas.y + canvas.height / 2);
  await page.mouse.wheel(0, 140);
  await expect
    .poll(async () => (await viewport(page)).y)
    .toBeLessThan(before.y - 50);
  expect((await viewport(page)).zoom).toBe(before.zoom);
  const down = await viewport(page);
  await page.mouse.wheel(0, -140);
  await expect
    .poll(async () => (await viewport(page)).y)
    .toBeGreaterThan(down.y + 50);
  await page.mouse.wheel(140, 0);
  await expect
    .poll(async () => (await viewport(page)).x)
    .toBeLessThan(before.x - 50);
  expect((await viewport(page)).zoom).toBe(before.zoom);
});

test("consecutive drags persist in order without opening drawer or moving viewport", async ({
  page,
}) => {
  const before = await viewport(page);
  const node = page.locator(`.react-flow__node${person}`);
  const initial = await node.boundingBox();
  await movePerson(page, -65, 35);
  await movePerson(page, -65, 35);
  const dropped = await node.getAttribute("style");
  await expect.poll(async () => (await savedMoves(page)).length).toBe(2);
  await expect(page.getByText("Đã lưu bố cục", { exact: true })).toBeVisible();
  expect(await viewport(page)).toEqual(before);
  expect(await node.getAttribute("style")).toBe(dropped);
  expect((await savedMoves(page))[1]?.[0]?.expectedRevision).toBe(2);
  // React Flow activates dragging after its pointer threshold. Assert both
  // gestures moved and the final persisted coordinate matches the rendered node.
  const finalX = (await node.boundingBox())!.x;
  expect(finalX).toBeLessThan(initial!.x - 100);
  const savedX = (await savedMoves(page))[1]![0]!.positionX;
  expect(finalX).toBeCloseTo(initial!.x + (savedX - 800) * before.zoom, 2);
  await expect(
    page.getByRole("heading", { name: "Thông tin thành viên" }),
  ).toHaveCount(0);
  // Opening and closing the inspector must preserve the user's zoom level.
  await node.click();
  await expect(
    page.getByRole("heading", { name: "Thông tin thành viên" }),
  ).toBeVisible();
  expect((await viewport(page)).zoom).toBe(before.zoom);
  await page.getByRole("button", { name: "Đóng bảng thông tin" }).click();
  expect((await viewport(page)).zoom).toBe(before.zoom);
});

test("failed layout save rolls back and a subsequent gesture can save", async ({
  page,
}) => {
  await page.goto("/editor-test-harness?fail-layout");
  const node = page.locator(`.react-flow__node${person}`);
  await expect(node).toBeVisible();
  const before = await node.getAttribute("style");
  const view = await viewport(page);
  await movePerson(page, -50, 40);
  await expect(page.getByText(/Không thể lưu bố cục/)).toBeVisible();
  await expect(node).toHaveAttribute("style", before!);
  expect(await viewport(page)).toEqual(view);
  await page.evaluate(() =>
    history.replaceState(null, "", "/editor-test-harness"),
  );
  await movePerson(page, -50, 40);
  await expect.poll(async () => (await savedMoves(page)).length).toBe(1);
  await expect(page.getByText("Đã lưu bố cục", { exact: true })).toBeVisible();
});

test("parent arrows use vertical handles while partnerships use facing side handles", async ({
  page,
}) => {
  const parent = page.locator(
    '.react-flow__edge[data-id="parent-child"] .react-flow__edge-path',
  );
  const partnership = page.locator(
    '.react-flow__edge[data-id="partnership"] .react-flow__edge-path',
  );
  await expect(parent).toHaveAttribute("marker-end", /url/);
  await expect(partnership).not.toHaveAttribute("marker-end", /url/);
  const stroke = await partnership.evaluate(
    (element) => getComputedStyle(element).strokeDasharray,
  );
  expect(stroke).not.toBe("none");
  const parentPath = await parent.getAttribute("d");
  const partnerPath = await partnership.getAttribute("d");
  expect(parentPath).toMatch(/^M[\d. -]+L/);
  expect(partnerPath).not.toBe(parentPath);
  const oldPartnerPath = partnerPath;
  await movePerson(page, -80, 30);
  await expect(partnership).not.toHaveAttribute("d", oldPartnerPath!);
  await expect(parent).toHaveAttribute("marker-end", /url/);
});

test("undo and redo remain available directly on the canvas", async ({
  page,
}) => {
  const node = page.locator(`.react-flow__node${person}`);
  const original = await node.getAttribute("style");
  const before = await viewport(page);
  await movePerson(page, -60, 40);
  await expect(
    page.getByRole("button", { name: "Hoàn tác", exact: true }),
  ).toBeEnabled();
  const moved = await node.getAttribute("style");
  await page.getByRole("button", { name: "Hoàn tác", exact: true }).click();
  await expect(node).toHaveAttribute("style", original!);
  await expect(
    page.getByRole("button", { name: "Làm lại", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Làm lại", exact: true }).click();
  await expect(node).toHaveAttribute("style", moved!);
  await expect.poll(async () => (await savedMoves(page)).length).toBe(3);
  expect(await viewport(page)).toEqual(before);
});

test("a larger synthetic tree retains stable navigation and drag persistence", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Nạp 150 thành viên giả lập" })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(150);
  await expect(page.locator(".react-flow__edge")).toHaveCount(149);
  const before = await viewport(page);
  await movePerson(page, -45, 30);
  await expect.poll(async () => (await savedMoves(page)).length).toBe(1);
  await expect(page.getByText("Đã lưu bố cục", { exact: true })).toBeVisible();
  expect(await viewport(page)).toEqual(before);
});

test("keyboard movement saves without shifting the viewport", async ({
  page,
}) => {
  const node = page.locator(`.react-flow__node${person}`);
  await node.click();
  await expect(
    page.getByRole("heading", { name: "Thông tin thành viên" }),
  ).toBeVisible();
  await node.focus();
  const before = await viewport(page);
  const position = await node.boundingBox();
  await node.press("ArrowRight");
  await expect.poll(async () => (await savedMoves(page)).length).toBe(1);
  await expect(page.getByText("Đã lưu bố cục", { exact: true })).toBeVisible();
  expect((await node.boundingBox())!.x).toBeGreaterThan(position!.x);
  expect(await viewport(page)).toEqual(before);
});
