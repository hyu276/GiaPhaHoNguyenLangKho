import { describe, expect, it } from "vitest";

import {
  buildDataQualityReport,
  type DataQualityIssueKind,
} from "@/features/tree/data-quality";
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
  return { id, sourcePersonId, targetPersonId, relationshipKind };
}

function issueKinds(
  people: DuplicatePerson[],
  relationships: DuplicateRelationship[],
  citedRelationshipIds: ReadonlySet<string> = new Set(),
) {
  return buildDataQualityReport({
    people,
    relationships,
    citedRelationshipIds,
  }).issues.map((issue) => issue.kind);
}

function countKind(kinds: DataQualityIssueKind[], kind: DataQualityIssueKind) {
  return kinds.filter((value) => value === kind).length;
}

describe("data quality report", () => {
  it("flags an isolated active person", () => {
    const kinds = issueKinds([person("P1")], []);

    expect(kinds).toContain("isolated_person");
  });

  it("ignores archived and merged people", () => {
    const kinds = issueKinds(
      [
        person("P1", { archivedAt: "2026-01-01T00:00:00Z" }),
        person("P2", { mergedIntoPersonId: "P3" }),
      ],
      [],
    );

    expect(kinds).toEqual([]);
  });

  it("flags missing parents and missing birth year only when a person participates in the tree", () => {
    const people = [
      person("P1", { birthYear: null }),
      person("P2", { birthYear: 1930 }),
    ];
    const relationships = [relationship("R1", "P1", "P2", "partnership")];
    const kinds = issueKinds(people, relationships, new Set(["R1"]));

    expect(countKind(kinds, "missing_parents")).toBe(2);
    expect(countKind(kinds, "missing_birth_year")).toBe(1);
  });

  it("flags impossible person chronology", () => {
    const report = buildDataQualityReport({
      people: [person("P1", { birthYear: 1950, deathYear: 1940 })],
      relationships: [],
      citedRelationshipIds: new Set(),
    });

    expect(
      report.issues.some(
        (issue) => issue.kind === "chronology" && issue.severity === "error",
      ),
    ).toBe(true);
  });

  it("flags suspicious parent-child age gaps", () => {
    const people = [
      person("P1", { birthYear: 1920 }),
      person("P2", { birthYear: 1928 }),
    ];
    const relationships = [relationship("R1", "P1", "P2")];
    const report = buildDataQualityReport({
      people,
      relationships,
      citedRelationshipIds: new Set(["R1"]),
    });

    expect(
      report.issues.some(
        (issue) => issue.kind === "chronology" && issue.relationshipId === "R1",
      ),
    ).toBe(true);
  });

  it("reuses conservative duplicate suggestions without auto-merging", () => {
    const people = [
      person("P1", {
        displayName: "Nguyễn Văn An",
        birthYear: 1901,
      }),
      person("P2", {
        displayName: "Nguyen Van An",
        birthYear: 1901,
      }),
    ];
    const kinds = issueKinds(people, []);

    expect(kinds).toContain("duplicate_candidate");
  });

  it("flags public records treated as living by the current editor heuristic", () => {
    const kinds = issueKinds(
      [person("P1", { deathYear: null, visibility: "public" })],
      [],
    );

    expect(kinds).toContain("living_public_exposure");
  });

  it("flags only relationships without direct citation coverage", () => {
    const people = [person("P1"), person("P2"), person("P3")];
    const relationships = [
      relationship("R1", "P1", "P2"),
      relationship("R2", "P1", "P3"),
    ];
    const report = buildDataQualityReport({
      people,
      relationships,
      citedRelationshipIds: new Set(["R1"]),
    });
    const relationshipIssues = report.issues.filter(
      (issue) => issue.kind === "relationship_missing_provenance",
    );

    expect(relationshipIssues).toHaveLength(1);
    expect(relationshipIssues[0]?.relationshipId).toBe("R2");
  });
});
