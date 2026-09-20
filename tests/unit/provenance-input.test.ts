import { describe, expect, it } from "vitest";

import {
  createCitationInputSchema,
  createNoteInputSchema,
  updateCitationInputSchema,
} from "@/features/tree/provenance-input";

const personId = "11111111-1111-4111-8111-111111111111";
const relationshipId = "22222222-2222-4222-8222-222222222222";
const citationId = "33333333-3333-4333-8333-333333333333";
const sourceId = "44444444-4444-4444-8444-444444444444";

function validCitation() {
  return {
    personId,
    relationshipId: null,
    sourceTitle: "Gia phả bản giấy",
    sourceType: "document" as const,
    sourceAuthor: "Nguyễn Văn A",
    sourceRepository: "Từ đường",
    sourceReferenceCode: "GP-01",
    sourcePublicationText: "khoảng 1930",
    sourceUrl: null,
    sourceNotes: null,
    fieldKey: "birth_year" as const,
    claimText: "Sinh khoảng năm 1902",
    locator: "trang 12",
    certainty: "probable" as const,
    dateQualifier: "about" as const,
  };
}

describe("provenance input", () => {
  it("accepts a citation attached to exactly one person", () => {
    const parsed = createCitationInputSchema.safeParse(validCitation());

    expect(parsed.success).toBe(true);
  });

  it("accepts a citation attached to exactly one relationship", () => {
    const parsed = createCitationInputSchema.safeParse({
      ...validCitation(),
      personId: null,
      relationshipId,
      fieldKey: "relationship",
      claimText: "Quan hệ hôn phối được ghi trong bản gia phả.",
      dateQualifier: "not_applicable",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a provenance subject with both person and relationship", () => {
    const parsed = createCitationInputSchema.safeParse({
      ...validCitation(),
      relationshipId,
    });

    expect(parsed.success).toBe(false);
  });

  it("preserves approximate and unknown date qualifiers without exact dates", () => {
    const about = createCitationInputSchema.parse(validCitation());
    const unknown = createCitationInputSchema.parse({
      ...validCitation(),
      claimText: "Không rõ năm sinh.",
      dateQualifier: "unknown",
    });

    expect(about.dateQualifier).toBe("about");
    expect(unknown.dateQualifier).toBe("unknown");
  });

  it("normalizes blank optional source metadata to null", () => {
    const parsed = createCitationInputSchema.parse({
      ...validCitation(),
      sourceAuthor: "   ",
      sourceRepository: "",
      locator: " ",
    });

    expect(parsed.sourceAuthor).toBeNull();
    expect(parsed.sourceRepository).toBeNull();
    expect(parsed.locator).toBeNull();
  });

  it("allows conflicting claims to coexist as separate valid citations", () => {
    const first = createCitationInputSchema.parse(validCitation());
    const second = createCitationInputSchema.parse({
      ...validCitation(),
      sourceTitle: "Lời kể gia đình",
      sourceType: "oral_history",
      claimText: "Sinh khoảng năm 1905",
      certainty: "possible",
    });

    expect(first.claimText).not.toBe(second.claimText);
  });

  it("validates citation updates with stable entry and source identifiers", () => {
    const parsed = updateCitationInputSchema.safeParse({
      ...validCitation(),
      citationId,
      sourceId,
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts uncertain free-form notes without a source", () => {
    const parsed = createNoteInputSchema.safeParse({
      personId,
      relationshipId: null,
      noteText: "Chưa xác minh được tên húy trong bản sao hiện có.",
      certainty: "uncertain",
    });

    expect(parsed.success).toBe(true);
  });
});
