import { describe, expect, it } from "vitest";
import { loadAllPages } from "@/lib/supabase/pagination";

function source(total: number) {
  const data = Array.from({ length: total }, (_, id) => ({ id }));
  return (start: number, end: number) =>
    Promise.resolve({
      data: data.slice(start, end + 1),
      count: total,
      error: null,
    });
}

describe("complete Supabase pagination", () => {
  it("returns every record across the 1000-row API ceiling", async () => {
    const records = await loadAllPages(source(1201));
    expect(records).toHaveLength(1201);
    expect(records[1200]).toEqual({ id: 1200 });
  });

  it("supports an empty table", async () => {
    expect(await loadAllPages(source(0))).toEqual([]);
  });

  it("rejects incomplete pages instead of exporting a partial backup", async () => {
    await expect(
      loadAllPages((start) =>
        Promise.resolve({
          data: Array.from({ length: start === 0 ? 499 : 0 }, (_, id) => ({
            id,
          })),
          count: 1200,
          error: null,
        }),
      ),
    ).rejects.toThrow("truncated");
  });

  it("rejects count changes between pages", async () => {
    await expect(
      loadAllPages((start) =>
        Promise.resolve({
          data: Array.from({ length: 500 }, (_, id) => ({ id: start + id })),
          count: start === 0 ? 1200 : 1201,
          error: null,
        }),
      ),
    ).rejects.toThrow("count changed");
  });
});
