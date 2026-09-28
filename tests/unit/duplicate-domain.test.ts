import { describe, expect, it } from "vitest";

import {
  buildPersonMergePreview,
  type DuplicatePerson,
  type DuplicateRelationship,
  findDuplicateSuggestions,
  scoreDuplicatePair,
} from "@/features/tree/duplicate-domain";

const TARGET = "11111111-1111-4111-8111-111111111111";
const SOURCE = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const CHILD = "44444444-4444-4444-8444-444444444444";

function person(
  id: string,
  overrides: Partial<DuplicatePerson> = {},
): DuplicatePerson {
  return {
    id,
    displayName: "Nguyễn Văn An",
    description: null,
    birthYear: 1900,
    deathYear: null,
    sex: "male",
    visibility: "public",
    archivedAt: null,
    mergedIntoPersonId: null,
    ...overrides,
  };
}

function relationship(
  id: string,
  relationshipKind: DuplicateRelationship["relationshipKind"],
  sourcePersonId: string,
  targetPersonId: string,
): DuplicateRelationship {
  return {
    id,
    relationshipKind,
    sourcePersonId,
    targetPersonId,
  };
}

describe("duplicate detection", () => {
  it("suggests same normalized name with a corroborating birth year", () => {
    const suggestion = scoreDuplicatePair(
      person(TARGET, { displayName: "Nguyễn Văn An" }),
      person(SOURCE, { displayName: "nguyen   van an" }),
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion?.score).toBeGreaterThanOrEqual(70);
  });

  it("does not suggest a same-name pair without a strong date match", () => {
    const suggestion = scoreDuplicatePair(
      person(TARGET, { birthYear: null, deathYear: null }),
      person(SOURCE, { birthYear: null, deathYear: null }),
    );

    expect(suggestion).toBeNull();
  });

  it("suppresses a pair with a conflicting known birth year", () => {
    const suggestion = scoreDuplicatePair(
      person(TARGET, { birthYear: 1900 }),
      person(SOURCE, { birthYear: 1910 }),
    );

    expect(suggestion).toBeNull();
  });

  it("ranks stronger duplicate signals first", () => {
    const suggestions = findDuplicateSuggestions([
      person(TARGET, { deathYear: 1970 }),
      person(SOURCE, { deathYear: 1970 }),
      person(OTHER, { deathYear: null }),
    ]);

    expect(suggestions[0]?.score).toBeGreaterThan(suggestions[1]?.score ?? 0);
  });
});

describe("merge preview", () => {
  it("deduplicates an edge that already exists on the target", () => {
    const preview = buildPersonMergePreview(
      [
        relationship(
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "parent_child",
          SOURCE,
          CHILD,
        ),
        relationship(
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "parent_child",
          TARGET,
          CHILD,
        ),
      ],
      TARGET,
      SOURCE,
    );

    expect(preview.blockers).toEqual([]);
    expect(preview.relationshipChanges).toEqual([
      expect.objectContaining({
        action: "deduplicate",
        existingRelationshipId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        toSourcePersonId: TARGET,
        toTargetPersonId: CHILD,
      }),
    ]);
  });

  it("blocks a direct relationship between target and source", () => {
    const preview = buildPersonMergePreview(
      [
        relationship(
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "partnership",
          TARGET,
          SOURCE,
        ),
      ],
      TARGET,
      SOURCE,
    );

    expect(preview.blockers).toHaveLength(1);
    expect(preview.blockers[0]).toContain("self-link");
  });

  it("blocks a merge whose remapped parent-child edge would create a cycle", () => {
    const preview = buildPersonMergePreview(
      [
        relationship(
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "parent_child",
          OTHER,
          TARGET,
        ),
        relationship(
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "parent_child",
          SOURCE,
          OTHER,
        ),
      ],
      TARGET,
      SOURCE,
    );

    expect(preview.blockers).toContain(
      "Merge sẽ tạo vòng lặp tổ tiên trong quan hệ cha/mẹ – con.",
    );
  });

  it("migrates a safe relationship without changing its identity", () => {
    const preview = buildPersonMergePreview(
      [
        relationship(
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          "parent_child",
          SOURCE,
          CHILD,
        ),
      ],
      TARGET,
      SOURCE,
    );

    expect(preview.blockers).toEqual([]);
    expect(preview.relationshipChanges[0]).toEqual(
      expect.objectContaining({
        relationshipId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        action: "migrate",
        toSourcePersonId: TARGET,
        toTargetPersonId: CHILD,
      }),
    );
  });
});
