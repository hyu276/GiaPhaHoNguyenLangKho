import { describe, expect, it } from "vitest";

import { previewStructuredImport } from "@/features/tree/bulk-utils";

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    people: [
      {
        externalId: "P1",
        displayName: "Nguyễn Văn A",
        description: null,
        birthYear: 1900,
        deathYear: 1970,
        sex: "male",
        visibility: "public",
      },
      {
        externalId: "P2",
        displayName: "Nguyễn Văn B",
        description: null,
        birthYear: 1930,
        deathYear: null,
        sex: "male",
        visibility: "private",
      },
    ],
    relationships: [
      {
        kind: "parent_child",
        sourceExternalId: "P1",
        targetExternalId: "P2",
      },
    ],
    ...overrides,
  });
}

describe("structured import preview", () => {
  it("summarizes a valid payload without mutating anything", () => {
    const result = previewStructuredImport(payload());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.personCount).toBe(2);
    expect(result.preview.relationshipCount).toBe(1);
    expect(result.preview.publicCount).toBe(1);
    expect(result.preview.privateCount).toBe(1);
    expect(result.preview.issues).toEqual([]);
    expect(result.preview.canProceedToFutureImport).toBe(true);
  });

  it("rejects invalid JSON", () => {
    const result = previewStructuredImport("{");

    expect(result).toEqual({ ok: false, message: "JSON không hợp lệ." });
  });

  it("flags duplicate external IDs and impossible year order", () => {
    const text = payload({
      people: [
        {
          externalId: "P1",
          displayName: "A",
          birthYear: 2000,
          deathYear: 1990,
          sex: null,
          visibility: "private",
        },
        {
          externalId: "P1",
          displayName: "B",
          birthYear: null,
          deathYear: null,
          sex: null,
          visibility: "private",
        },
      ],
    });
    const result = previewStructuredImport(text);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.canProceedToFutureImport).toBe(false);
    expect(result.preview.issues.map((issue) => issue.code)).toContain(
      "duplicate_external_id",
    );
    expect(result.preview.issues.map((issue) => issue.code)).toContain(
      "invalid_year_order",
    );
  });

  it("flags missing references and self links", () => {
    const text = payload({
      relationships: [
        {
          kind: "parent_child",
          sourceExternalId: "P1",
          targetExternalId: "P1",
        },
        {
          kind: "partnership",
          sourceExternalId: "P1",
          targetExternalId: "MISSING",
        },
      ],
    });
    const result = previewStructuredImport(text);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const codes = result.preview.issues.map((issue) => issue.code);
    expect(codes).toContain("self_relationship");
    expect(codes).toContain("missing_person_reference");
  });

  it("normalizes reverse partnership duplicates", () => {
    const text = payload({
      relationships: [
        {
          kind: "partnership",
          sourceExternalId: "P1",
          targetExternalId: "P2",
        },
        {
          kind: "partnership",
          sourceExternalId: "P2",
          targetExternalId: "P1",
        },
      ],
    });
    const result = previewStructuredImport(text);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.issues).toContainEqual(
      expect.objectContaining({
        code: "duplicate_relationship",
        severity: "warning",
      }),
    );
  });
});
