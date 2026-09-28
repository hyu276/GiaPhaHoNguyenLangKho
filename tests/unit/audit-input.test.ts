import { describe, expect, it } from "vitest";

import {
  conflictMessage,
  recentAuditQuerySchema,
  revisionSchema,
  undoMutationInputSchema,
} from "@/features/tree/audit-input";

describe("audit and concurrency input", () => {
  it("accepts positive integer revisions", () => {
    expect(revisionSchema.parse(1)).toBe(1);
    expect(revisionSchema.parse(42)).toBe(42);
  });

  it("rejects zero and fractional revisions", () => {
    expect(revisionSchema.safeParse(0).success).toBe(false);
    expect(revisionSchema.safeParse(1.5).success).toBe(false);
  });

  it("validates undo audit identifiers", () => {
    expect(
      undoMutationInputSchema.safeParse({
        auditId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true);
    expect(undoMutationInputSchema.safeParse({ auditId: "nope" }).success).toBe(
      false,
    );
  });

  it("caps recent audit queries at 100 entries", () => {
    expect(recentAuditQuerySchema.parse({ limit: 30 }).limit).toBe(30);
    expect(recentAuditQuerySchema.safeParse({ limit: 101 }).success).toBe(
      false,
    );
  });

  it("produces a recoverable stale-write message", () => {
    expect(conflictMessage("Hồ sơ")).toContain("tải lại dữ liệu mới");
  });
});
