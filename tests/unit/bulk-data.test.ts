import { describe, expect, it } from "vitest";

import {
  buildBatchVisibilityImpact,
  previewGenealogyImport,
  type GenealogyBackup,
} from "@/features/tree/bulk-data";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const R1 = "33333333-3333-4333-8333-333333333333";
const S1 = "44444444-4444-4444-8444-444444444444";
const C1 = "55555555-5555-4555-8555-555555555555";

function backup(): GenealogyBackup {
  return {
    format: "nguyen-lang-kho-genealogy",
    version: 1,
    exportedAt: "2026-09-27T00:00:00.000Z",
    people: [
      {
        id: P1,
        displayName: "Nguyễn Văn A",
        description: null,
        birthYear: 1900,
        deathYear: 1970,
        sex: "male",
        visibility: "private",
        archivedAt: null,
        mergedIntoPersonId: null,
        revision: 1,
      },
      {
        id: P2,
        displayName: "Nguyễn Văn B",
        description: null,
        birthYear: 1930,
        deathYear: null,
        sex: "male",
        visibility: "private",
        archivedAt: null,
        mergedIntoPersonId: null,
        revision: 2,
      },
    ],
    relationships: [
      {
        id: R1,
        relationshipKind: "parent_child",
        sourcePersonId: P1,
        targetPersonId: P2,
        revision: 1,
      },
    ],
    layouts: [
      { personId: P1, positionX: 10, positionY: 20, revision: 1 },
    ],
    sources: [
      {
        id: S1,
        title: "Gia phả",
        sourceType: "family_book",
        repositoryName: null,
        referenceCode: null,
        sourceUrl: null,
        revision: 1,
      },
    ],
    citations: [
      {
        id: C1,
        sourceId: S1,
        personId: null,
        relationshipId: R1,
        claimKind: "relationship",
        claimText: "A là cha của B",
        citationLocator: null,
        note: null,
        certainty: "certain",
        dateText: null,
        dateQualifier: null,
        revision: 1,
      },
    ],
  };
}

describe("structured import preview", () => {
  it("accepts a self-contained backup and reports existing people", () => {
    const result = previewGenealogyImport(backup(), new Set([P1]));

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.counts.existingPeople).toBe(1);
    expect(result.counts.newPeople).toBe(1);
  });

  it("blocks missing relationship references", () => {
    const value = backup();
    value.relationships[0]!.targetPersonId =
      "66666666-6666-4666-8666-666666666666";

    const result = previewGenealogyImport(value, new Set());

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((message) =>
        message.includes("target person không có"),
      ),
    ).toBe(true);
  });

  it("blocks duplicate entity ids", () => {
    const value = backup();
    value.people.push({ ...value.people[0]! });

    const result = previewGenealogyImport(value, new Set());

    expect(result.valid).toBe(false);
    expect(result.errors.some((message) => message.includes("ID trùng"))).toBe(
      true,
    );
  });

  it("warns on a parent-child cycle without mutating data", () => {
    const value = backup();
    value.relationships.push({
      id: "77777777-7777-4777-8777-777777777777",
      relationshipKind: "parent_child",
      sourcePersonId: P2,
      targetPersonId: P1,
      revision: 1,
    });

    const result = previewGenealogyImport(value, new Set());

    expect(result.valid).toBe(true);
    expect(result.warnings.some((message) => message.includes("vòng lặp"))).toBe(
      true,
    );
  });
});

describe("batch visibility impact", () => {
  it("reports changes and living-public exposure before execution", () => {
    const impact = buildBatchVisibilityImpact(
      [
        {
          id: P1,
          displayName: "A",
          deathYear: 1970,
          visibility: "private",
          revision: 3,
        },
        {
          id: P2,
          displayName: "B",
          deathYear: null,
          visibility: "private",
          revision: 4,
        },
      ],
      "public",
    );

    expect(impact.selectedCount).toBe(2);
    expect(impact.changingCount).toBe(2);
    expect(impact.privateToPublicCount).toBe(2);
    expect(impact.livingPublicAfterCount).toBe(1);
    expect(impact.changes[1]?.expectedRevision).toBe(4);
  });

  it("does not create writes for already-matching visibility", () => {
    const impact = buildBatchVisibilityImpact(
      [
        {
          id: P1,
          displayName: "A",
          deathYear: 1970,
          visibility: "public",
          revision: 3,
        },
      ],
      "public",
    );

    expect(impact.changingCount).toBe(0);
    expect(impact.unchangedCount).toBe(1);
    expect(impact.changes).toEqual([]);
  });
});
