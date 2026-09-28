import { describe, expect, it } from "vitest";

import {
  getAutoLayoutPositions,
  type LayoutPerson,
  type LayoutRelationship,
} from "@/features/tree/tree-layout";
import {
  filterPeople,
  getDescendantIds,
  type NavigablePerson,
} from "@/features/tree/tree-navigation";

function buildLargeGraph(size: number) {
  const people: Array<NavigablePerson & LayoutPerson> = Array.from(
    { length: size },
    (_, index) => ({
      id: "P" + index.toString().padStart(5, "0"),
      displayName: "Nguyễn synthetic " + index,
      deathYear: index % 4 === 0 ? 2000 + (index % 20) : null,
      visibility: index % 5 === 0 ? "private" : "public",
      archivedAt: null,
      position: { x: 0, y: index * 10 },
    }),
  );

  const relationships: LayoutRelationship[] = people
    .slice(1)
    .map((person, index) => ({
      kind: "parent_child",
      sourcePersonId: people[index]!.id,
      targetPersonId: person.id,
    }));

  return { people, relationships };
}

describe("large synthetic graph performance", () => {
  it("keeps navigation and branch layout inside the development budget", () => {
    const { people, relationships } = buildLargeGraph(2_000);
    const start = performance.now();

    const filtered = filterPeople(people, {
      query: "synthetic 19",
      life: "all",
      visibility: "all",
      archive: "active",
    });
    const descendants = getDescendantIds(relationships, people[0]!.id);
    const positions = getAutoLayoutPositions(
      people,
      relationships,
      people[0]!.id,
      new Map(people.map((person) => [person.id, person.position])),
      new Set(),
    );

    const elapsed = performance.now() - start;

    expect(filtered.length).toBeGreaterThan(0);
    expect(descendants.size).toBe(1_999);
    expect(positions.size).toBe(1_999);
    expect(elapsed).toBeLessThan(3_000);
  });
});
