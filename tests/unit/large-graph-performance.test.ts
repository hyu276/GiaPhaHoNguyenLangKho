import { describe, expect, it } from "vitest";

import {
  getAutoLayoutPositions,
  type LayoutPerson,
  type LayoutRelationship,
} from "@/features/tree/tree-layout";
import { filterPeople } from "@/features/tree/tree-navigation";

function buildPeople(count: number): LayoutPerson[] {
  return Array.from({ length: count }, (_, index) => ({
    id: "P" + index,
    position: { x: 0, y: 0 },
  }));
}

function buildRelationships(count: number): LayoutRelationship[] {
  const relationships: LayoutRelationship[] = [];

  for (let index = 1; index < count; index += 1) {
    relationships.push({
      kind: "parent_child",
      sourcePersonId: "P" + Math.floor((index - 1) / 4),
      targetPersonId: "P" + index,
    });
  }

  return relationships;
}

describe("large synthetic graph performance", () => {
  it("lays out and filters 2,000 people within the release budget", () => {
    const people = buildPeople(2000);
    const relationships = buildRelationships(2000);
    const currentPositions = new Map(
      people.map((person) => [person.id, person.position]),
    );

    const startedAt = performance.now();
    const positions = getAutoLayoutPositions(
      people,
      relationships,
      "P0",
      currentPositions,
      new Set(),
    );

    const navigable = people.map((person, index) => ({
      id: person.id,
      displayName: "Nguyễn synthetic " + index,
      deathYear: index % 3 === 0 ? 2000 : null,
      visibility: index % 2 === 0 ? ("public" as const) : ("private" as const),
      archivedAt: null,
    }));
    const filtered = filterPeople(navigable, {
      query: "synthetic 19",
      life: "all",
      visibility: "all",
      archive: "active",
    });
    const elapsedMs = performance.now() - startedAt;

    expect(positions.size).toBe(1999);
    expect(filtered.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(1500);
  });
});
