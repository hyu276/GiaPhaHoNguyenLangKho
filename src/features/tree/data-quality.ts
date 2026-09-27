import {
  findDuplicateSuggestions,
  type DuplicatePerson,
  type DuplicateRelationship,
} from "@/features/tree/duplicate-domain";

export type DataQualitySeverity = "error" | "warning" | "info";

export type DataQualityIssueKind =
  | "missing_parents"
  | "missing_birth_year"
  | "chronology"
  | "duplicate_candidate"
  | "isolated_person"
  | "living_public_exposure"
  | "relationship_missing_provenance";

export type DataQualityIssue = {
  id: string;
  kind: DataQualityIssueKind;
  severity: DataQualitySeverity;
  personId: string | null;
  relationshipId: string | null;
  relatedPersonId: string | null;
  title: string;
  detail: string;
};

export type DataQualityInput = {
  people: DuplicatePerson[];
  relationships: DuplicateRelationship[];
  citedRelationshipIds: ReadonlySet<string>;
};

export type DataQualityReport = {
  issues: DataQualityIssue[];
  counts: Record<DataQualitySeverity, number>;
};

const severityOrder: Record<DataQualitySeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

function activePeople(people: DuplicatePerson[]) {
  return people.filter(
    (person) =>
      person.archivedAt === null && person.mergedIntoPersonId === null,
  );
}

function activePersonIds(people: DuplicatePerson[]) {
  return new Set(activePeople(people).map((person) => person.id));
}

function activeRelationships(
  relationships: DuplicateRelationship[],
  personIds: ReadonlySet<string>,
) {
  return relationships.filter(
    (relationship) =>
      personIds.has(relationship.sourcePersonId) &&
      personIds.has(relationship.targetPersonId),
  );
}

function relationshipDegree(
  relationships: DuplicateRelationship[],
  personId: string,
) {
  return relationships.filter(
    (relationship) =>
      relationship.sourcePersonId === personId ||
      relationship.targetPersonId === personId,
  ).length;
}

function recordedParentCount(
  relationships: DuplicateRelationship[],
  personId: string,
) {
  return relationships.filter(
    (relationship) =>
      relationship.relationshipKind === "parent_child" &&
      relationship.targetPersonId === personId,
  ).length;
}

function missingParentIssues(
  people: DuplicatePerson[],
  relationships: DuplicateRelationship[],
) {
  return people.flatMap((person) => {
    const degree = relationshipDegree(relationships, person.id);
    const parentCount = recordedParentCount(relationships, person.id);
    if (degree === 0 || parentCount > 0) return [];

    return [
      {
        id: `missing-parents:${person.id}`,
        kind: "missing_parents" as const,
        severity: "info" as const,
        personId: person.id,
        relationshipId: null,
        relatedPersonId: null,
        title: "Chưa ghi nhận cha/mẹ",
        detail:
          "Hồ sơ có quan hệ gia phả nhưng chưa có cha/mẹ canonical. Đây có thể là root hợp lệ và chỉ cần review.",
      },
    ];
  });
}

function missingBirthYearIssues(
  people: DuplicatePerson[],
  relationships: DuplicateRelationship[],
) {
  return people.flatMap((person) => {
    const hasRelationship = relationshipDegree(relationships, person.id) > 0;
    if (!hasRelationship || person.birthYear !== null) return [];

    return [
      {
        id: `missing-birth-year:${person.id}`,
        kind: "missing_birth_year" as const,
        severity: "info" as const,
        personId: person.id,
        relationshipId: null,
        relatedPersonId: null,
        title: "Thiếu năm sinh canonical",
        detail:
          "Hồ sơ đang tham gia cây nhưng chưa có năm sinh canonical. Claim ngày chưa chắc chắn trong provenance không bị ép thành năm chính xác.",
      },
    ];
  });
}

function personChronologyIssues(people: DuplicatePerson[]) {
  return people.flatMap((person) => {
    if (
      person.birthYear === null ||
      person.deathYear === null ||
      person.birthYear <= person.deathYear
    ) {
      return [];
    }

    return [
      {
        id: `chronology:person:${person.id}`,
        kind: "chronology" as const,
        severity: "error" as const,
        personId: person.id,
        relationshipId: null,
        relatedPersonId: null,
        title: "Năm sinh sau năm mất",
        detail: `Năm sinh ${person.birthYear} lớn hơn năm mất ${person.deathYear}.`,
      },
    ];
  });
}

function parentChildChronologyIssue(
  relationship: DuplicateRelationship,
  personById: ReadonlyMap<string, DuplicatePerson>,
) {
  if (relationship.relationshipKind !== "parent_child") return null;

  const parent = personById.get(relationship.sourcePersonId);
  const child = personById.get(relationship.targetPersonId);
  if (!parent || !child) return null;
  if (parent.birthYear === null || child.birthYear === null) return null;

  const parentAge = child.birthYear - parent.birthYear;
  if (parentAge < 12) {
    return {
      id: `chronology:young-parent:${relationship.id}`,
      kind: "chronology" as const,
      severity: "warning" as const,
      personId: parent.id,
      relationshipId: relationship.id,
      relatedPersonId: child.id,
      title: "Tuổi cha/mẹ khi sinh con bất thường",
      detail: `Chênh lệch năm sinh chỉ ${parentAge} năm. Cần kiểm tra lại hồ sơ và nguồn.`,
    };
  }

  if (parentAge > 80) {
    return {
      id: `chronology:old-parent:${relationship.id}`,
      kind: "chronology" as const,
      severity: "warning" as const,
      personId: parent.id,
      relationshipId: relationship.id,
      relatedPersonId: child.id,
      title: "Khoảng cách thế hệ bất thường",
      detail: `Chênh lệch năm sinh là ${parentAge} năm. Đây là tín hiệu review, không phải kết luận sai dữ liệu.`,
    };
  }

  if (parent.deathYear !== null && parent.deathYear < child.birthYear - 1) {
    return {
      id: `chronology:post-death-child:${relationship.id}`,
      kind: "chronology" as const,
      severity: "warning" as const,
      personId: parent.id,
      relationshipId: relationship.id,
      relatedPersonId: child.id,
      title: "Con sinh sau năm mất của cha/mẹ",
      detail: `Năm mất ${parent.deathYear} sớm hơn năm sinh của con ${child.birthYear} quá một năm.`,
    };
  }

  return null;
}

function relationshipChronologyIssues(
  people: DuplicatePerson[],
  relationships: DuplicateRelationship[],
) {
  const personById = new Map(people.map((person) => [person.id, person]));
  return relationships.flatMap((relationship) => {
    const issue = parentChildChronologyIssue(relationship, personById);
    return issue ? [issue] : [];
  });
}

function duplicateIssues(people: DuplicatePerson[]) {
  return findDuplicateSuggestions(people).map((suggestion) => ({
    id: `duplicate:${suggestion.firstPersonId}:${suggestion.secondPersonId}`,
    kind: "duplicate_candidate" as const,
    severity: "warning" as const,
    personId: suggestion.firstPersonId,
    relationshipId: null,
    relatedPersonId: suggestion.secondPersonId,
    title: "Ứng viên hồ sơ trùng",
    detail: `Điểm ${suggestion.score}: ${suggestion.reasons.join(", ")}. Chỉ review; không tự merge.`,
  }));
}

function isolatedPersonIssues(
  people: DuplicatePerson[],
  relationships: DuplicateRelationship[],
) {
  return people.flatMap((person) => {
    if (relationshipDegree(relationships, person.id) > 0) return [];

    return [
      {
        id: `isolated:${person.id}`,
        kind: "isolated_person" as const,
        severity: "info" as const,
        personId: person.id,
        relationshipId: null,
        relatedPersonId: null,
        title: "Hồ sơ đang cô lập",
        detail:
          "Hồ sơ active chưa có quan hệ canonical với người khác trong cây.",
      },
    ];
  });
}

function livingExposureIssues(people: DuplicatePerson[]) {
  return people.flatMap((person) => {
    const consideredLiving = person.deathYear === null;
    if (!consideredLiving || person.visibility !== "public") return [];

    return [
      {
        id: `living-public:${person.id}`,
        kind: "living_public_exposure" as const,
        severity: "warning" as const,
        personId: person.id,
        relationshipId: null,
        relatedPersonId: null,
        title: "Người được xem là còn sống đang public",
        detail:
          "Theo heuristic hiện tại của editor, chưa có năm mất được xem là còn sống. Hãy review visibility trước khi xuất bản.",
      },
    ];
  });
}

function relationshipProvenanceIssues(
  relationships: DuplicateRelationship[],
  citedRelationshipIds: ReadonlySet<string>,
) {
  return relationships.flatMap((relationship) => {
    if (citedRelationshipIds.has(relationship.id)) return [];

    return [
      {
        id: `relationship-provenance:${relationship.id}`,
        kind: "relationship_missing_provenance" as const,
        severity: "info" as const,
        personId: relationship.sourcePersonId,
        relationshipId: relationship.id,
        relatedPersonId: relationship.targetPersonId,
        title: "Quan hệ chưa có citation",
        detail:
          "Quan hệ canonical chưa có nguồn/citation gắn trực tiếp. Đây là tín hiệu ưu tiên bổ sung provenance.",
      },
    ];
  });
}

function sortIssues(issues: DataQualityIssue[]) {
  return [...issues].sort(
    (first, second) =>
      severityOrder[first.severity] - severityOrder[second.severity] ||
      first.kind.localeCompare(second.kind) ||
      first.id.localeCompare(second.id),
  );
}

function countIssues(issues: DataQualityIssue[]) {
  return issues.reduce<Record<DataQualitySeverity, number>>(
    (counts, issue) => {
      counts[issue.severity] += 1;
      return counts;
    },
    { error: 0, warning: 0, info: 0 },
  );
}

export function buildDataQualityReport(
  input: DataQualityInput,
): DataQualityReport {
  const people = activePeople(input.people);
  const personIds = activePersonIds(people);
  const relationships = activeRelationships(input.relationships, personIds);
  const issues = sortIssues([
    ...missingParentIssues(people, relationships),
    ...missingBirthYearIssues(people, relationships),
    ...personChronologyIssues(people),
    ...relationshipChronologyIssues(people, relationships),
    ...duplicateIssues(people),
    ...isolatedPersonIssues(people, relationships),
    ...livingExposureIssues(people),
    ...relationshipProvenanceIssues(relationships, input.citedRelationshipIds),
  ]);

  return { issues, counts: countIssues(issues) };
}
