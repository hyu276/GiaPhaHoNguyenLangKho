import { describe, expect, it } from "vitest";

import { buildDataQualityReport } from "@/features/tree/data-quality";
import type {
  DuplicatePerson,
  DuplicateRelationship,
} from "@/features/tree/duplicate-domain";

function person(
  id: string,
  overrides: Partial<DuplicatePerson> = {},
): DuplicatePerson {
  return {
    id,
    displayName: `Nguyễn Văn ${id}`,
    description: null,
    birthYear: 1900,
    deathYear: 1970,
    sex: "male",
    visibility: "private",
    archivedAt: null,
    mergedIntoPersonId: null,
    ...overrides,
  };
}

function relationship(
  id: string,
  sourcePersonId: string,
  targetPersonId: string,
  relationshipKind: DuplicateRelationship["relationshipKind"] = "parent_child",
): DuplicateRelationship {
  return {
    id,
    relationshipKind,
    sourcePersonId,
    targetPersonId,
  };
}

describe("data quality regression coverage", () => {
  it("excludes relationships that touch archived people from active provenance checks", () => {
    const report = buildDataQualityReport({
      people: [
        person("P1"),
        person("P2", { archivedAt: "2026-09-01T00:00:00Z" }),
      ],
      relationships: [relationship("R1", "P1", "P2")],
      citedRelationshipIds: new Set(),
    });

    expect(
      report.issues.some(
        (issue) =>
          issue.kind === "relationship_missing_provenance" &&
          issue.relationshipId === "R1",
      ),
    ).toBe(false);
  });

  it("keeps severity counts and ordering deterministic", () => {
    const report = buildDataQualityReport({
      people: [
        person("P1", { birthYear: 1950, deathYear: 1940 }),
        person("P2", {
          birthYear: 1980,
          deathYear: null,
          visibility: "public",
        }),
      ],
      relationships: [],
      citedRelationshipIds: new Set(),
    });

    expect(report.counts).toEqual({
      error: 1,
      warning: 1,
      info: 2,
    });
    expect(report.issues.map((issue) => issue.severity)).toEqual([
      "error",
      "warning",
      "info",
      "info",
    ]);
  });

  it("still reports post-death parent-child chronology when the relationship is cited", () => {
    const report = buildDataQualityReport({
      people: [
        person("P1", { birthYear: 1900, deathYear: 1920 }),
        person("P2", { birthYear: 1930, deathYear: 1990 }),
      ],
      relationships: [relationship("R1", "P1", "P2")],
      citedRelationshipIds: new Set(["R1"]),
    });

    expect(
      report.issues.some(
        (issue) =>
          issue.kind === "chronology" &&
          issue.relationshipId === "R1" &&
          issue.severity === "warning" &&
          issue.title === "Con sinh sau năm mất của cha/mẹ",
      ),
    ).toBe(true);
    expect(
      report.issues.some(
        (issue) =>
          issue.kind === "relationship_missing_provenance" &&
          issue.relationshipId === "R1",
      ),
    ).toBe(false);
  });
});
