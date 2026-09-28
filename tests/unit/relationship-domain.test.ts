import { describe, expect, it } from "vitest";

import {
  buildRelationshipProposal,
  isDuplicateRelationship,
  orderPartnershipEndpoints,
  type RelationshipRecord,
  validateRelationshipProposal,
  wouldCreateParentChildCycle,
} from "@/features/tree/relationship-domain";
import {
  createParentChildInputSchema,
  createPartnershipInputSchema,
  removeRelationshipInputSchema,
} from "@/features/tree/relationship-input";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const C = "10000000-0000-4000-8000-000000000003";
const D = "10000000-0000-4000-8000-000000000004";

const relationships: RelationshipRecord[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    kind: "parent_child",
    sourcePersonId: A,
    targetPersonId: B,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    kind: "parent_child",
    sourcePersonId: B,
    targetPersonId: C,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    kind: "partnership",
    sourcePersonId: A,
    targetPersonId: D,
  },
];

describe("relationship input validation", () => {
  it("rejects self parent-child links", () => {
    expect(
      createParentChildInputSchema.safeParse({
        firstPersonId: A,
        secondPersonId: A,
      }).success,
    ).toBe(false);
  });

  it("rejects self partnerships", () => {
    expect(
      createPartnershipInputSchema.safeParse({
        firstPersonId: A,
        secondPersonId: A,
      }).success,
    ).toBe(false);
  });

  it("requires a relationship UUID for removal", () => {
    expect(
      removeRelationshipInputSchema.safeParse({
        relationshipId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });
});

describe("relationship domain guards", () => {
  it("builds parent, child and partner proposals with canonical direction", () => {
    expect(buildRelationshipProposal(B, A, "parent")).toEqual({
      kind: "parent_child",
      sourcePersonId: A,
      targetPersonId: B,
    });

    expect(buildRelationshipProposal(B, C, "child")).toEqual({
      kind: "parent_child",
      sourcePersonId: B,
      targetPersonId: C,
    });

    expect(buildRelationshipProposal(A, D, "partner").kind).toBe("partnership");
  });

  it("normalizes partnership endpoint order", () => {
    expect(orderPartnershipEndpoints(D, A)).toEqual([A, D]);
  });

  it("detects directed parent-child duplicates only in the same direction", () => {
    expect(
      isDuplicateRelationship(relationships, {
        kind: "parent_child",
        sourcePersonId: A,
        targetPersonId: B,
      }),
    ).toBe(true);

    expect(
      isDuplicateRelationship(relationships, {
        kind: "parent_child",
        sourcePersonId: B,
        targetPersonId: A,
      }),
    ).toBe(false);
  });

  it("detects reverse-order partnership duplicates", () => {
    expect(
      isDuplicateRelationship(relationships, {
        kind: "partnership",
        sourcePersonId: D,
        targetPersonId: A,
      }),
    ).toBe(true);
  });

  it("detects direct and transitive ancestry cycles", () => {
    expect(wouldCreateParentChildCycle(relationships, B, A)).toBe(true);
    expect(wouldCreateParentChildCycle(relationships, C, A)).toBe(true);
    expect(wouldCreateParentChildCycle(relationships, D, C)).toBe(false);
  });

  it("returns a useful proposal validation message", () => {
    expect(
      validateRelationshipProposal(relationships, {
        kind: "parent_child",
        sourcePersonId: C,
        targetPersonId: A,
      }),
    ).toBe("Quan hệ này sẽ tạo vòng lặp tổ tiên.");
  });
});
