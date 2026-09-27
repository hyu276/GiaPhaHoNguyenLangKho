import { describe, expect, it } from "vitest";

import {
  buildVisibilityImpact,
  type BulkPersonSummary,
  previewStructuredImport,
} from "@/features/tree/bulk-utils";

const PERSON_A = "11111111-1111-4111-8111-111111111111";
const PERSON_B = "22222222-2222-4222-8222-222222222222";
const RELATIONSHIP = "33333333-3333-4333-8333-333333333333";
const SOURCE = "44444444-4444-4444-8444-444444444444";
const CITATION = "55555555-5555-4555-8555-555555555555";

function validBackup() {
  return {
    version: 1,
    people: [
      {
        id: PERSON_A,
        display_name: "Nguyễn Văn A",
        birth_year: 1900,
        death_year: 1970,
        visibility: "private",
      },
      {
        id: PERSON_B,
        display_name: "Nguyễn Văn B",
        birth_year: 1930,
        death_year: null,
        visibility: "private",
      },
    ],
    relationships: [
      {
        id: RELATIONSHIP,
        relationship_kind: "parent_child",
        source_person_id: PERSON_A,
        target_person_id: PERSON_B,
      },
    ],
    person_layouts: [{ person_id: PERSON_A, position_x: 10, position_y: 20 }],
    genealogy_sources: [{ id: SOURCE, title: "Gia phả" }],
    genealogy_citations: [
      {
        id: CITATION,
        source_id: SOURCE,
        person_id: null,
        relationship_id: RELATIONSHIP,
      },
    ],
  };
}

describe("structured import preview", () => {
  it("accepts a structurally consistent backup without writing data", () => {
    const preview = previewStructuredImport(JSON.stringify(validBackup()));

    expect(preview.ok).toBe(true);
    expect(preview.counts.people).toBe(2);
    expect(preview.counts.relationships).toBe(1);
    expect(preview.errors).toEqual([]);
  });

  it("rejects invalid JSON", () => {
    const preview = previewStructuredImport("{");

    expect(preview.ok).toBe(false);
    expect(preview.errors[0]).toContain("valid JSON");
  });

  it("blocks relationships that reference missing people", () => {
    const backup = validBackup();
    backup.people = backup.people.slice(0, 1);
    const preview = previewStructuredImport(JSON.stringify(backup));

    expect(preview.ok).toBe(false);
    expect(
      preview.errors.some((error) => error.includes("missing target person")),
    ).toBe(true);
  });

  it("blocks citations with invalid target cardinality", () => {
    const backup = validBackup();
    backup.genealogy_citations[0] = {
      ...backup.genealogy_citations[0],
      person_id: PERSON_A,
    };
    const preview = previewStructuredImport(JSON.stringify(backup));

    expect(preview.ok).toBe(false);
    expect(
      preview.errors.some((error) =>
        error.includes("exactly one person or relationship"),
      ),
    ).toBe(true);
  });
});

describe("batch visibility impact", () => {
  const people: BulkPersonSummary[] = [
    {
      id: PERSON_A,
      displayName: "Nguyễn Văn A",
      visibility: "private",
      deathYear: 1970,
      revision: 2,
    },
    {
      id: PERSON_B,
      displayName: "Nguyễn Văn B",
      visibility: "private",
      deathYear: null,
      revision: 5,
    },
  ];

  it("separates changed and unchanged rows", () => {
    const impact = buildVisibilityImpact(
      people,
      new Set([PERSON_A, PERSON_B]),
      "private",
    );

    expect(impact.selectedCount).toBe(2);
    expect(impact.changingCount).toBe(0);
    expect(impact.unchangedCount).toBe(2);
  });

  it("surfaces living-public exposure before execution", () => {
    const impact = buildVisibilityImpact(
      people,
      new Set([PERSON_A, PERSON_B]),
      "public",
    );

    expect(impact.changingCount).toBe(2);
    expect(impact.livingPublicAfterCount).toBe(1);
  });
});
