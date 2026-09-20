import { describe, expect, it } from "vitest";

import {
  filterPeople,
  getDescendantIds,
  getDirectRelativeIds,
  getHiddenBranchIds,
} from "@/features/tree/tree-navigation";

const people = [
  {
    id: "P1",
    displayName: "Nguyễn Văn An",
    deathYear: null,
    visibility: "public" as const,
    archivedAt: null,
  },
  {
    id: "P2",
    displayName: "Nguyễn Thị Bình",
    deathYear: 1998,
    visibility: "private" as const,
    archivedAt: null,
  },
  {
    id: "P3",
    displayName: "Trần Văn Cường",
    deathYear: null,
    visibility: "public" as const,
    archivedAt: "2026-09-20T00:00:00Z",
  },
];

const relationships = [
  {
    kind: "parent_child" as const,
    sourcePersonId: "P1",
    targetPersonId: "P2",
  },
  {
    kind: "parent_child" as const,
    sourcePersonId: "P2",
    targetPersonId: "P3",
  },
  {
    kind: "partnership" as const,
    sourcePersonId: "P1",
    targetPersonId: "P4",
  },
];

describe("filterPeople", () => {
  it("combines name, life, visibility, and archive filters", () => {
    expect(
      filterPeople(people, {
        query: "bình",
        life: "deceased",
        visibility: "private",
        archive: "active",
      }).map((person) => person.id),
    ).toEqual(["P2"]);
  });

  it("treats a missing death year as living in the current editor model", () => {
    expect(
      filterPeople(people, {
        query: "",
        life: "living",
        visibility: "all",
        archive: "all",
      }).map((person) => person.id),
    ).toEqual(["P1", "P3"]);
  });

  it("can isolate archived records", () => {
    expect(
      filterPeople(people, {
        query: "",
        life: "all",
        visibility: "all",
        archive: "archived",
      }).map((person) => person.id),
    ).toEqual(["P3"]);
  });
});

describe("tree navigation", () => {
  it("returns direct parents, children, and partners", () => {
    expect(getDirectRelativeIds(relationships, "P2")).toEqual({
      parents: ["P1"],
      children: ["P3"],
      partners: [],
    });

    expect(getDirectRelativeIds(relationships, "P1").partners).toEqual(["P4"]);
  });

  it("collects descendants without including the root when malformed cycles exist", () => {
    const cyclicRelationships = [
      ...relationships,
      {
        kind: "parent_child" as const,
        sourcePersonId: "P3",
        targetPersonId: "P1",
      },
    ];

    expect([...getDescendantIds(cyclicRelationships, "P1")].sort()).toEqual([
      "P2",
      "P3",
    ]);
  });

  it("hides descendants of every collapsed branch root", () => {
    expect(
      [...getHiddenBranchIds(relationships, new Set(["P1", "P2"]))].sort(),
    ).toEqual(["P2", "P3"]);
  });
});
