export type RelationshipKind = "parent_child" | "partnership";

export type RelationshipRecord = {
  id: string;
  kind: RelationshipKind;
  sourcePersonId: string;
  targetPersonId: string;
};

export type RelationshipProposal = Omit<RelationshipRecord, "id">;

export type RelationshipIntent = "parent" | "child" | "partner";

export function buildRelationshipProposal(
  focalPersonId: string,
  otherPersonId: string,
  intent: RelationshipIntent,
): RelationshipProposal {
  if (intent === "parent") {
    return {
      kind: "parent_child",
      sourcePersonId: otherPersonId,
      targetPersonId: focalPersonId,
    };
  }

  if (intent === "partner") {
    return {
      kind: "partnership",
      sourcePersonId: focalPersonId,
      targetPersonId: otherPersonId,
    };
  }

  return {
    kind: "parent_child",
    sourcePersonId: focalPersonId,
    targetPersonId: otherPersonId,
  };
}

export function orderPartnershipEndpoints(
  firstPersonId: string,
  secondPersonId: string,
) {
  return firstPersonId < secondPersonId
    ? ([firstPersonId, secondPersonId] as const)
    : ([secondPersonId, firstPersonId] as const);
}

function partnershipKey(sourcePersonId: string, targetPersonId: string) {
  return orderPartnershipEndpoints(sourcePersonId, targetPersonId).join(":");
}

export function isDuplicateRelationship(
  relationships: RelationshipRecord[],
  proposal: RelationshipProposal,
) {
  return relationships.some((relationship) => {
    if (relationship.kind !== proposal.kind) return false;

    if (proposal.kind === "partnership") {
      return (
        partnershipKey(
          relationship.sourcePersonId,
          relationship.targetPersonId,
        ) === partnershipKey(proposal.sourcePersonId, proposal.targetPersonId)
      );
    }

    return (
      relationship.sourcePersonId === proposal.sourcePersonId &&
      relationship.targetPersonId === proposal.targetPersonId
    );
  });
}

function getChildrenByParent(relationships: RelationshipRecord[]) {
  const result = new Map<string, string[]>();

  relationships.forEach((relationship) => {
    if (relationship.kind !== "parent_child") return;

    const children = result.get(relationship.sourcePersonId) ?? [];
    children.push(relationship.targetPersonId);
    result.set(relationship.sourcePersonId, children);
  });

  return result;
}

export function wouldCreateParentChildCycle(
  relationships: RelationshipRecord[],
  parentPersonId: string,
  childPersonId: string,
) {
  if (parentPersonId === childPersonId) return true;

  const childrenByParent = getChildrenByParent(relationships);
  const pending = [childPersonId];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current)) continue;
    if (current === parentPersonId) return true;

    visited.add(current);
    pending.push(...(childrenByParent.get(current) ?? []));
  }

  return false;
}

export function validateRelationshipProposal(
  relationships: RelationshipRecord[],
  proposal: RelationshipProposal,
) {
  if (proposal.sourcePersonId === proposal.targetPersonId) {
    return "Không thể tạo quan hệ với chính người đó.";
  }

  if (isDuplicateRelationship(relationships, proposal)) {
    return "Quan hệ này đã tồn tại.";
  }

  if (
    proposal.kind === "parent_child" &&
    wouldCreateParentChildCycle(
      relationships,
      proposal.sourcePersonId,
      proposal.targetPersonId,
    )
  ) {
    return "Quan hệ này sẽ tạo vòng lặp tổ tiên.";
  }

  return null;
}
