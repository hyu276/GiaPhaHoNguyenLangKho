import type { PersonSex, PersonVisibility } from "@/features/tree/person-input";

export type DuplicatePerson = {
  id: string;
  displayName: string;
  description: string | null;
  birthYear: number | null;
  deathYear: number | null;
  sex: PersonSex | null;
  visibility: PersonVisibility;
  archivedAt: string | null;
  mergedIntoPersonId: string | null;
};

export type DuplicateRelationship = {
  id: string;
  relationshipKind: "parent_child" | "partnership";
  sourcePersonId: string;
  targetPersonId: string;
};

export type DuplicateSuggestion = {
  firstPersonId: string;
  secondPersonId: string;
  score: number;
  reasons: string[];
};

export type MergeRelationshipChange = {
  relationshipId: string;
  relationshipKind: DuplicateRelationship["relationshipKind"];
  fromSourcePersonId: string;
  fromTargetPersonId: string;
  toSourcePersonId: string;
  toTargetPersonId: string;
  action: "migrate" | "deduplicate";
  existingRelationshipId: string | null;
};

export type PersonMergePreview = {
  targetPersonId: string;
  sourcePersonId: string;
  relationshipChanges: MergeRelationshipChange[];
  blockers: string[];
};

function normalizeDuplicateName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreYearMatch(
  first: number | null,
  second: number | null,
  exactPoints: number,
  mismatchPenalty: number,
  label: string,
) {
  if (first === null || second === null) {
    return { score: 0, strong: false, reason: null };
  }

  if (first === second) {
    return {
      score: exactPoints,
      strong: true,
      reason: `${label} trùng ${first}`,
    };
  }

  return {
    score: -mismatchPenalty,
    strong: false,
    reason: `${label} mâu thuẫn ${first}/${second}`,
  };
}

function scoreSexMatch(first: PersonSex | null, second: PersonSex | null) {
  if (first === null || second === null) {
    return { score: 0, reason: null };
  }

  return first === second
    ? { score: 5, reason: "giới tính trùng" }
    : { score: -20, reason: "giới tính mâu thuẫn" };
}

function isMergeCandidatePerson(person: DuplicatePerson) {
  return person.archivedAt === null && person.mergedIntoPersonId === null;
}

function hasMatchingNormalizedName(
  first: DuplicatePerson,
  second: DuplicatePerson,
) {
  const firstName = normalizeDuplicateName(first.displayName);
  const secondName = normalizeDuplicateName(second.displayName);
  return firstName.length > 0 && firstName === secondName;
}

function collectDuplicateReasons(
  birthReason: string | null,
  deathReason: string | null,
  sexReason: string | null,
) {
  return ["tên chuẩn hóa trùng", birthReason, deathReason, sexReason].filter(
    (reason): reason is string => reason !== null,
  );
}

export function scoreDuplicatePair(
  first: DuplicatePerson,
  second: DuplicatePerson,
): DuplicateSuggestion | null {
  if (first.id === second.id) return null;
  if (!isMergeCandidatePerson(first) || !isMergeCandidatePerson(second)) {
    return null;
  }
  if (!hasMatchingNormalizedName(first, second)) return null;

  const birth = scoreYearMatch(
    first.birthYear,
    second.birthYear,
    25,
    40,
    "năm sinh",
  );
  const death = scoreYearMatch(
    first.deathYear,
    second.deathYear,
    20,
    30,
    "năm mất",
  );
  const sex = scoreSexMatch(first.sex, second.sex);
  const score = 50 + birth.score + death.score + sex.score;
  const hasStrongDateMatch = birth.strong || death.strong;

  if (!hasStrongDateMatch) return null;
  if (score < 70) return null;

  return {
    firstPersonId: first.id,
    secondPersonId: second.id,
    score,
    reasons: collectDuplicateReasons(birth.reason, death.reason, sex.reason),
  };
}

export function findDuplicateSuggestions(people: DuplicatePerson[]) {
  const suggestions: DuplicateSuggestion[] = [];

  for (let firstIndex = 0; firstIndex < people.length; firstIndex += 1) {
    const first = people[firstIndex];
    if (!first) continue;

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < people.length;
      secondIndex += 1
    ) {
      const second = people[secondIndex];
      if (!second) continue;
      const suggestion = scoreDuplicatePair(first, second);
      if (suggestion) suggestions.push(suggestion);
    }
  }

  return suggestions.sort(
    (first, second) =>
      second.score - first.score ||
      first.firstPersonId.localeCompare(second.firstPersonId),
  );
}

function canonicalRelationshipEndpoints(
  relationshipKind: DuplicateRelationship["relationshipKind"],
  sourcePersonId: string,
  targetPersonId: string,
) {
  if (
    relationshipKind === "partnership" &&
    sourcePersonId.localeCompare(targetPersonId) > 0
  ) {
    return [targetPersonId, sourcePersonId] as const;
  }

  return [sourcePersonId, targetPersonId] as const;
}

function relationshipKey(
  relationshipKind: DuplicateRelationship["relationshipKind"],
  sourcePersonId: string,
  targetPersonId: string,
) {
  const [source, target] = canonicalRelationshipEndpoints(
    relationshipKind,
    sourcePersonId,
    targetPersonId,
  );
  return `${relationshipKind}:${source}:${target}`;
}

function remapRelationship(
  relationship: DuplicateRelationship,
  targetPersonId: string,
  sourcePersonId: string,
) {
  const remappedSource =
    relationship.sourcePersonId === sourcePersonId
      ? targetPersonId
      : relationship.sourcePersonId;
  const remappedTarget =
    relationship.targetPersonId === sourcePersonId
      ? targetPersonId
      : relationship.targetPersonId;
  const [source, target] = canonicalRelationshipEndpoints(
    relationship.relationshipKind,
    remappedSource,
    remappedTarget,
  );

  return { sourcePersonId: source, targetPersonId: target };
}

function indexExistingRelationships(
  relationships: DuplicateRelationship[],
  excludedRelationshipIds: Set<string>,
) {
  const relationshipByKey = new Map<string, string>();

  for (const relationship of relationships) {
    if (excludedRelationshipIds.has(relationship.id)) continue;
    relationshipByKey.set(
      relationshipKey(
        relationship.relationshipKind,
        relationship.sourcePersonId,
        relationship.targetPersonId,
      ),
      relationship.id,
    );
  }

  return relationshipByKey;
}

function buildRelationshipChange(
  relationship: DuplicateRelationship,
  targetPersonId: string,
  sourcePersonId: string,
  relationshipByKey: Map<string, string>,
) {
  const remapped = remapRelationship(
    relationship,
    targetPersonId,
    sourcePersonId,
  );
  if (remapped.sourcePersonId === remapped.targetPersonId) {
    return {
      change: null,
      blocker: `Quan hệ ${relationship.id} sẽ trở thành self-link sau merge.`,
    };
  }

  const key = relationshipKey(
    relationship.relationshipKind,
    remapped.sourcePersonId,
    remapped.targetPersonId,
  );
  const existingRelationshipId = relationshipByKey.get(key) ?? null;
  const change: MergeRelationshipChange = {
    relationshipId: relationship.id,
    relationshipKind: relationship.relationshipKind,
    fromSourcePersonId: relationship.sourcePersonId,
    fromTargetPersonId: relationship.targetPersonId,
    toSourcePersonId: remapped.sourcePersonId,
    toTargetPersonId: remapped.targetPersonId,
    action: existingRelationshipId ? "deduplicate" : "migrate",
    existingRelationshipId,
  };

  if (!existingRelationshipId) {
    relationshipByKey.set(key, relationship.id);
  }

  return { change, blocker: null };
}

function buildRelationshipChanges(
  relationships: DuplicateRelationship[],
  targetPersonId: string,
  sourcePersonId: string,
) {
  const sourceRelationships = relationships.filter(
    (relationship) =>
      relationship.sourcePersonId === sourcePersonId ||
      relationship.targetPersonId === sourcePersonId,
  );
  const sourceIds = new Set(
    sourceRelationships.map((relationship) => relationship.id),
  );
  const relationshipByKey = indexExistingRelationships(
    relationships,
    sourceIds,
  );
  const changes: MergeRelationshipChange[] = [];
  const blockers: string[] = [];

  for (const relationship of sourceRelationships) {
    const result = buildRelationshipChange(
      relationship,
      targetPersonId,
      sourcePersonId,
      relationshipByKey,
    );
    if (result.blocker) blockers.push(result.blocker);
    if (result.change) changes.push(result.change);
  }

  return { changes, blockers };
}

function buildEffectiveRelationships(
  relationships: DuplicateRelationship[],
  changes: MergeRelationshipChange[],
  sourcePersonId: string,
) {
  const effective = relationships.filter(
    (relationship) =>
      relationship.sourcePersonId !== sourcePersonId &&
      relationship.targetPersonId !== sourcePersonId,
  );

  for (const change of changes) {
    if (change.action !== "migrate") continue;
    effective.push({
      id: change.relationshipId,
      relationshipKind: change.relationshipKind,
      sourcePersonId: change.toSourcePersonId,
      targetPersonId: change.toTargetPersonId,
    });
  }

  return effective;
}

function addParentChildEdge(
  childrenByParent: Map<string, string[]>,
  indegree: Map<string, number>,
  relationship: DuplicateRelationship,
) {
  const children = childrenByParent.get(relationship.sourcePersonId) ?? [];
  children.push(relationship.targetPersonId);
  childrenByParent.set(relationship.sourcePersonId, children);
  indegree.set(
    relationship.targetPersonId,
    (indegree.get(relationship.targetPersonId) ?? 0) + 1,
  );
  if (!indegree.has(relationship.sourcePersonId)) {
    indegree.set(relationship.sourcePersonId, 0);
  }
}

function buildParentChildGraph(relationships: DuplicateRelationship[]) {
  const childrenByParent = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const relationship of relationships) {
    if (relationship.relationshipKind !== "parent_child") continue;
    addParentChildEdge(childrenByParent, indegree, relationship);
  }

  return { childrenByParent, indegree };
}

function visitAcyclicNodes(
  childrenByParent: Map<string, string[]>,
  indegree: Map<string, number>,
) {
  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([personId]) => personId);
  let visited = 0;

  while (queue.length > 0) {
    const personId = queue.shift();
    if (!personId) continue;
    visited += 1;

    const children = childrenByParent.get(personId) ?? [];
    for (const childId of children) {
      const nextDegree = (indegree.get(childId) ?? 0) - 1;
      indegree.set(childId, nextDegree);
      if (nextDegree === 0) queue.push(childId);
    }
  }

  return visited;
}

function hasParentChildCycle(relationships: DuplicateRelationship[]) {
  const { childrenByParent, indegree } = buildParentChildGraph(relationships);
  const visited = visitAcyclicNodes(childrenByParent, indegree);
  return visited !== indegree.size;
}

export function buildPersonMergePreview(
  relationships: DuplicateRelationship[],
  targetPersonId: string,
  sourcePersonId: string,
): PersonMergePreview {
  const { changes, blockers } = buildRelationshipChanges(
    relationships,
    targetPersonId,
    sourcePersonId,
  );
  const effectiveRelationships = buildEffectiveRelationships(
    relationships,
    changes,
    sourcePersonId,
  );

  if (hasParentChildCycle(effectiveRelationships)) {
    blockers.push("Merge sẽ tạo vòng lặp tổ tiên trong quan hệ cha/mẹ – con.");
  }

  return {
    targetPersonId,
    sourcePersonId,
    relationshipChanges: changes,
    blockers,
  };
}
