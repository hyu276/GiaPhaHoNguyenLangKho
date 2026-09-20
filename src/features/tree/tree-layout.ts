import { getDescendantIds } from "@/features/tree/tree-navigation";

export type LayoutPosition = {
  x: number;
  y: number;
};

export type LayoutPerson = {
  id: string;
  position: LayoutPosition;
};

export type LayoutRelationship = {
  kind: "parent_child" | "partnership";
  sourcePersonId: string;
  targetPersonId: string;
};

const COLUMN_GAP = 260;
const ROW_GAP = 180;

export function getFallbackPosition(index: number): LayoutPosition {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: 80 + column * COLUMN_GAP, y: 80 + row * ROW_GAP };
}

export function getBranchPersonIds(
  relationships: LayoutRelationship[],
  rootPersonId: string,
) {
  return new Set([
    rootPersonId,
    ...getDescendantIds(relationships, rootPersonId),
  ]);
}

export function getFallbackLayoutPositions(
  people: LayoutPerson[],
  targetPersonIds: ReadonlySet<string>,
  lockedPersonIds: ReadonlySet<string>,
) {
  const positions = new Map<string, LayoutPosition>();

  people.forEach((person, index) => {
    if (!targetPersonIds.has(person.id) || lockedPersonIds.has(person.id)) {
      return;
    }

    positions.set(person.id, getFallbackPosition(index));
  });

  return positions;
}

function buildChildAdjacency(relationships: LayoutRelationship[]) {
  const childrenByParent = new Map<string, string[]>();

  relationships.forEach((relationship) => {
    if (relationship.kind !== "parent_child") return;

    const children = childrenByParent.get(relationship.sourcePersonId) ?? [];
    if (!children.includes(relationship.targetPersonId)) {
      children.push(relationship.targetPersonId);
      childrenByParent.set(relationship.sourcePersonId, children);
    }
  });

  return childrenByParent;
}

function getBranchDepths(
  relationships: LayoutRelationship[],
  rootPersonId: string,
) {
  const childrenByParent = buildChildAdjacency(relationships);
  const depths = new Map<string, number>([[rootPersonId, 0]]);
  const queue = [rootPersonId];

  while (queue.length > 0) {
    const personId = queue.shift();
    if (!personId) continue;

    const nextDepth = (depths.get(personId) ?? 0) + 1;
    for (const childId of childrenByParent.get(personId) ?? []) {
      if (depths.has(childId)) continue;
      depths.set(childId, nextDepth);
      queue.push(childId);
    }
  }

  return depths;
}

export function getAutoLayoutPositions(
  people: LayoutPerson[],
  relationships: LayoutRelationship[],
  rootPersonId: string,
  currentPositions: ReadonlyMap<string, LayoutPosition>,
  lockedPersonIds: ReadonlySet<string>,
) {
  const rootPerson = people.find((person) => person.id === rootPersonId);
  if (!rootPerson) return new Map<string, LayoutPosition>();

  const rootPosition = currentPositions.get(rootPersonId) ?? rootPerson.position;
  const branchIds = getBranchPersonIds(relationships, rootPersonId);
  const depths = getBranchDepths(relationships, rootPersonId);
  const idsByDepth = new Map<number, string[]>();

  people.forEach((person) => {
    if (
      person.id === rootPersonId ||
      !branchIds.has(person.id) ||
      lockedPersonIds.has(person.id)
    ) {
      return;
    }

    const depth = depths.get(person.id);
    if (depth === undefined) return;

    const ids = idsByDepth.get(depth) ?? [];
    ids.push(person.id);
    idsByDepth.set(depth, ids);
  });

  const positions = new Map<string, LayoutPosition>();

  idsByDepth.forEach((personIds, depth) => {
    const centerOffset = (personIds.length - 1) / 2;

    personIds.forEach((personId, index) => {
      positions.set(personId, {
        x: rootPosition.x + (index - centerOffset) * COLUMN_GAP,
        y: rootPosition.y + depth * ROW_GAP,
      });
    });
  });

  return positions;
}
