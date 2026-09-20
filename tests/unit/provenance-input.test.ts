import { describe, expect, it } from "vitest";

import {
  createProvenanceCitationInputSchema,
  createProvenanceSourceInputSchema,
} from "@/features/tree/provenance-input";

const sourceId = "11111111-1111-4111-8111-111111111111";
const personId = "22222222-2222-4222-8222-222222222222";
const relationshipId = "33333333-3333-4333-8333-333333333333";

function citation(overrides: Record<string, unknown> = {}) {
  return {
    sourceId,
    personId,
    relationshipId: null,
    claimKind: "birth",
    claimText: "Sinh khoảng đầu thế kỷ XX.",
    citationLocator: "tr. 12",
    note: null,
    certainty: "possible",
    dateText: "khoảng 1900–1905",
    dateQualifier: "range",
    ...overrides,
  };
}

describe("provenance source input", () => {
  it("normalizes optional empty fields to null", () => {
    const result = createProvenanceSourceInputSchema.parse({
      title: "Gia phả chi họ",
      sourceType: "family_book",
      repositoryName: "",
      referenceCode: "  ",
      sourceUrl: null,
    });

    expect(result.repositoryName).toBeNull();
    expect(result.referenceCode).toBeNull();
  });

  it("rejects non-http source URLs", () => {
    const result = createProvenanceSourceInputSchema.safeParse({
      title: "Nguồn web",
      sourceType: "web",
      repositoryName: null,
      referenceCode: null,
      sourceUrl: "javascript:alert(1)",
    });

    expect(result.success).toBe(false);
  });
});

describe("provenance citation input", () => {
  it("requires exactly one person or relationship target", () => {
    expect(
      createProvenanceCitationInputSchema.safeParse(
        citation({ relationshipId }),
      ).success,
    ).toBe(false);

    expect(
      createProvenanceCitationInputSchema.safeParse(
        citation({ personId: null }),
      ).success,
    ).toBe(false);
  });

  it("keeps approximate dates as explicit text instead of exact years", () => {
    const result = createProvenanceCitationInputSchema.parse(citation());

    expect(result.dateText).toBe("khoảng 1900–1905");
    expect(result.dateQualifier).toBe("range");
    expect(result.certainty).toBe("possible");
  });

  it("requires date text and date qualifier together", () => {
    expect(
      createProvenanceCitationInputSchema.safeParse(
        citation({ dateQualifier: null }),
      ).success,
    ).toBe(false);

    expect(
      createProvenanceCitationInputSchema.safeParse(
        citation({ dateText: null }),
      ).success,
    ).toBe(false);
  });

  it("allows conflicting claims to coexist at the validation boundary", () => {
    const first = createProvenanceCitationInputSchema.safeParse(
      citation({ claimText: "Sinh khoảng năm 1902." }),
    );
    const second = createProvenanceCitationInputSchema.safeParse(
      citation({ claimText: "Một nguồn khác ghi năm 1904." }),
    );

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });
});
