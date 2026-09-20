import type { PersonVisibility } from "@/features/tree/person-input";

export type LifeFilter = "all" | "living" | "deceased";
export type VisibilityFilter = "all" | PersonVisibility;
export type ArchiveFilter = "active" | "all" | "archived";

export type NavigablePerson = {
  id: string;
  displayName: string;
  deathYear: number | null;
  visibility: PersonVisibility;
  archivedAt: string | null;
};

export type NavigableRelationship = {
  kind: "parent_child" | "partnership";
  sourcePersonId: string;
  targetPersonId: string;
};

export type TreePersonFilters = {
  query: string;
  life: LifeFilter;
  visibility: VisibilityFilter;
  archive: ArchiveFilter;
};

export type DirectRelativeIds = {
  parents: string[];
  children: string[];
  partners: string[];
};

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("vi-VN");
}

function matchesLifeFilter(person: NavigablePerson, lifeFilter: LifeFilter) {
  if (lifeFilter === "all") return true;
  const isLiving = person.deathYear === null;
  return lifeFilter === "living" ? isLiving : !isLiving;
}

function matchesArchiveFilter(
  person: NavigablePerson,
  archiveFilter: ArchiveFilter,
) {
  if (archiveFilter === "all") return true;
  const isArchived = person.archivedAt !== null;
  return archiveFilter === "archived" ? isArchived : !isArchived;
}

export function filterPeople<T extends NavigablePerson>(
  people: T[],
  filters: TreePersonFilters,
) {
  const query = normalizeName(filters.query);

  return people.filter((person) => {
    if (query && !normalizeName(person.displayName).includes(query))
      return false;
    if (!matchesLifeFilter(person, filters.life)) return false;
    if (
      filters.visibility !== "all" &&
      person.visibility !== filters.visibility
    ) {
      return false;
    }
    return matchesArchiveFilter(person, filters.archive);
  });
}

function pushUnique(target: string[], personId: string) {
  if (!target.includes(personId)) target.push(personId);
}

export function getDirectRelativeIds(
  relationships: NavigableRelationship[],
  personId: string,
): DirectRelativeIds {
  const result: DirectRelativeIds = {
    parents: [],
    children: [],
    partners: [],
  };

  relationships.forEach((relationship) => {
    if (relationship.kind === "partnership") {
      if (relationship.sourcePersonId === personId) {
        pushUnique(result.partners, relationship.targetPersonId);
      } else if (relationship.targetPersonId === personId) {
        pushUnique(result.partners, relationship.sourcePersonId);
      }
      return;
    }

    if (relationship.sourcePersonId === personId) {
      pushUnique(result.children, relationship.targetPersonId);
    } else if (relationship.targetPersonId === personId) {
      pushUnique(result.parents, relationship.sourcePersonId);
    }
  });

  return result;
}

function buildChildAdjacency(relationships: NavigableRelationship[]) {
  const childrenByParent = new Map<string, string[]>();

  relationships.forEach((relationship) => {
    if (relationship.kind !== "parent_child") return;
    const children = childrenByParent.get(relationship.sourcePersonId) ?? [];
    pushUnique(children, relationship.targetPersonId);
    childrenByParent.set(relationship.sourcePersonId, children);
  });

  return childrenByParent;
}

export function getDescendantIds(
  relationships: NavigableRelationship[],
  rootPersonId: string,
) {
  const childrenByParent = buildChildAdjacency(relationships);
  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(rootPersonId) ?? [])];

  while (queue.length > 0) {
    const personId = queue.shift();
    if (!personId || personId === rootPersonId || descendants.has(personId)) {
      continue;
    }

    descendants.add(personId);
    queue.push(...(childrenByParent.get(personId) ?? []));
  }

  return descendants;
}

export function getHiddenBranchIds(
  relationships: NavigableRelationship[],
  collapsedRootIds: ReadonlySet<string>,
) {
  const hidden = new Set<string>();

  collapsedRootIds.forEach((rootPersonId) => {
    getDescendantIds(relationships, rootPersonId).forEach((personId) => {
      hidden.add(personId);
    });
  });

  return hidden;
}
