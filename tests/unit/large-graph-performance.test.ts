import { describe, expect, it } from "vitest";

import { buildDataQualityReport } from "@/features/tree/data-quality";
import type {
  DuplicatePerson,
  DuplicateRelationship,
} from "@/features/tree/duplicate-domain";

const PERSON_COUNT = 1_500;
const MAX_DURATION_MS = 6_000;

function makePeople(): DuplicatePerson[] {
  return Array.from({ length: PERSON_COUNT }, (_, index) => ({
    id: `P-${index}`,
    displayName: `Nguyễn Synthetic ${index}`,
    description: null,
    birthYear: 1800 + Math.floor(index / 3),
    deathYear: 1870 + Math.floor(index / 3),
    sex: index % 2 === 0 ? "male" : "female",
    visibility: "private",
    archivedAt: null,
    mergedIntoPersonId: null,
  }));
}

function makeRelationships(): DuplicateRelationship[] {
  return Array.from({ length: PERSON_COUNT - 1 }, (_, index) => ({
    id: `R-${index}`,
    relationshipKind: "parent_child",
    sourcePersonId: `P-${index}`,
    targetPersonId: `P-${index + 1}`,
  }));
}

describe("large synthetic graph performance", () => {
  it(
    "builds the Step 9 quality report for 1,500 people within the release budget",
    () => {
      const people = makePeople();
      const relationships = makeRelationships();
      const citedRelationshipIds = new Set(
        relationships
          .filter((_, index) => index % 3 === 0)
          .map((relationship) => relationship.id),
      );

      const startedAt = performance.now();
      const report = buildDataQualityReport({
        people,
        relationships,
        citedRelationshipIds,
      });
      const durationMs = performance.now() - startedAt;

      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.counts.info).toBeGreaterThan(0);
      expect(durationMs).toBeLessThan(MAX_DURATION_MS);
    },
    10_000,
  );
});
