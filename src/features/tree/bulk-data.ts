import { z } from "zod";

import { personVisibilitySchema } from "@/features/tree/person-input";

const uuidSchema = z.string().uuid();
const nullableYearSchema = z.number().int().min(1).max(2200).nullable();

const backupPersonSchema = z.object({
  id: uuidSchema,
  displayName: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable(),
  birthYear: nullableYearSchema,
  deathYear: nullableYearSchema,
  sex: z.enum(["male", "female"]).nullable(),
  visibility: personVisibilitySchema,
  archivedAt: z.string().nullable(),
  mergedIntoPersonId: uuidSchema.nullable(),
  revision: z.number().int().min(1),
});

const backupRelationshipSchema = z.object({
  id: uuidSchema,
  relationshipKind: z.enum(["parent_child", "partnership"]),
  sourcePersonId: uuidSchema,
  targetPersonId: uuidSchema,
  revision: z.number().int().min(1),
});

const backupLayoutSchema = z.object({
  personId: uuidSchema,
  positionX: z.number().finite(),
  positionY: z.number().finite(),
  revision: z.number().int().min(1),
});

const backupSourceSchema = z.object({
  id: uuidSchema,
  title: z.string().trim().min(1).max(200),
  sourceType: z.enum([
    "family_book",
    "civil_record",
    "archive",
    "oral_history",
    "photo",
    "publication",
    "web",
    "other",
  ]),
  repositoryName: z.string().max(200).nullable(),
  referenceCode: z.string().max(200).nullable(),
  sourceUrl: z.string().max(2048).nullable(),
  revision: z.number().int().min(1),
});

const backupCitationSchema = z.object({
  id: uuidSchema,
  sourceId: uuidSchema,
  personId: uuidSchema.nullable(),
  relationshipId: uuidSchema.nullable(),
  claimKind: z.enum([
    "identity",
    "birth",
    "death",
    "relationship",
    "residence",
    "occupation",
    "note",
    "other",
  ]),
  claimText: z.string().trim().min(1).max(2000),
  citationLocator: z.string().max(240).nullable(),
  note: z.string().max(2000).nullable(),
  certainty: z.enum(["certain", "probable", "possible", "unknown"]),
  dateText: z.string().max(80).nullable(),
  dateQualifier: z
    .enum(["exact", "about", "before", "after", "range", "unknown"])
    .nullable(),
  revision: z.number().int().min(1),
});

export const genealogyBackupSchema = z.object({
  format: z.literal("nguyen-lang-kho-genealogy"),
  version: z.literal(1),
  exportedAt: z.string(),
  people: z.array(backupPersonSchema).max(20_000),
  relationships: z.array(backupRelationshipSchema).max(40_000),
  layouts: z.array(backupLayoutSchema).max(20_000),
  sources: z.array(backupSourceSchema).max(20_000),
  citations: z.array(backupCitationSchema).max(80_000),
});

export type GenealogyBackup = z.infer<typeof genealogyBackupSchema>;

export type ImportPreview = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    people: number;
    relationships: number;
    layouts: number;
    sources: number;
    citations: number;
    existingPeople: number;
    newPeople: number;
  };
};

export type VisibilityPreviewPerson = {
  id: string;
  displayName: string;
  deathYear: number | null;
  visibility: "public" | "private";
  revision: number;
};

export type BatchVisibilityImpact = {
  selectedCount: number;
  changingCount: number;
  unchangedCount: number;
  privateToPublicCount: number;
  publicToPrivateCount: number;
  livingPublicAfterCount: number;
  changes: Array<{
    personId: string;
    displayName: string;
    expectedRevision: number;
    fromVisibility: "public" | "private";
    toVisibility: "public" | "private";
  }>;
};

export const batchVisibilityPreviewInputSchema = z.object({
  personIds: z.array(uuidSchema).min(1).max(500),
  targetVisibility: personVisibilitySchema,
});

export const batchVisibilityExecutionInputSchema = z.object({
  changes: z
    .array(
      z.object({
        personId: uuidSchema,
        expectedRevision: z.number().int().min(1),
        targetVisibility: personVisibilitySchema,
      }),
    )
    .min(1)
    .max(500),
});

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });

  return [...duplicates];
}

function addDuplicateIdErrors(
  errors: string[],
  label: string,
  values: string[],
) {
  const duplicates = duplicateValues(values);
  if (duplicates.length === 0) return;
  errors.push(
    `${label} chứa ID trùng: ${duplicates.slice(0, 5).join(", ")}`,
  );
}

function validateRelationshipReferences(
  backup: GenealogyBackup,
  errors: string[],
) {
  const personIds = new Set(backup.people.map((person) => person.id));

  backup.relationships.forEach((relationship) => {
    if (!personIds.has(relationship.sourcePersonId)) {
      errors.push(
        `Quan hệ ${relationship.id} tham chiếu source person không có trong backup.`,
      );
    }
    if (!personIds.has(relationship.targetPersonId)) {
      errors.push(
        `Quan hệ ${relationship.id} tham chiếu target person không có trong backup.`,
      );
    }
    if (relationship.sourcePersonId === relationship.targetPersonId) {
      errors.push(`Quan hệ ${relationship.id} là self-link.`);
    }
  });
}

function validateLayoutReferences(backup: GenealogyBackup, errors: string[]) {
  const personIds = new Set(backup.people.map((person) => person.id));

  backup.layouts.forEach((layout) => {
    if (!personIds.has(layout.personId)) {
      errors.push(
        `Layout của ${layout.personId} không có person tương ứng trong backup.`,
      );
    }
  });
}

function validateCitationReferences(backup: GenealogyBackup, errors: string[]) {
  const personIds = new Set(backup.people.map((person) => person.id));
  const relationshipIds = new Set(
    backup.relationships.map((relationship) => relationship.id),
  );
  const sourceIds = new Set(backup.sources.map((source) => source.id));

  backup.citations.forEach((citation) => {
    const targetCount =
      Number(citation.personId !== null) +
      Number(citation.relationshipId !== null);

    if (!sourceIds.has(citation.sourceId)) {
      errors.push(
        `Citation ${citation.id} tham chiếu source không có trong backup.`,
      );
    }
    if (targetCount !== 1) {
      errors.push(`Citation ${citation.id} phải có đúng một target.`);
    }
    if (citation.personId && !personIds.has(citation.personId)) {
      errors.push(
        `Citation ${citation.id} tham chiếu person không có trong backup.`,
      );
    }
    if (
      citation.relationshipId &&
      !relationshipIds.has(citation.relationshipId)
    ) {
      errors.push(
        `Citation ${citation.id} tham chiếu relationship không có trong backup.`,
      );
    }
  });
}

function validateUniqueIds(backup: GenealogyBackup, errors: string[]) {
  addDuplicateIdErrors(
    errors,
    "People",
    backup.people.map((person) => person.id),
  );
  addDuplicateIdErrors(
    errors,
    "Relationships",
    backup.relationships.map((relationship) => relationship.id),
  );
  addDuplicateIdErrors(
    errors,
    "Sources",
    backup.sources.map((source) => source.id),
  );
  addDuplicateIdErrors(
    errors,
    "Citations",
    backup.citations.map((citation) => citation.id),
  );
  addDuplicateIdErrors(
    errors,
    "Layouts",
    backup.layouts.map((layout) => layout.personId),
  );
}

function parentChildHasCycle(backup: GenealogyBackup) {
  const childrenByParent = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  backup.relationships.forEach((relationship) => {
    if (relationship.relationshipKind !== "parent_child") return;
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
  });

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([personId]) => personId);
  let visited = 0;

  while (queue.length > 0) {
    const personId = queue.shift();
    if (!personId) continue;
    visited += 1;

    for (const childId of childrenByParent.get(personId) ?? []) {
      const nextDegree = (indegree.get(childId) ?? 0) - 1;
      indegree.set(childId, nextDegree);
      if (nextDegree === 0) queue.push(childId);
    }
  }

  return visited !== indegree.size;
}

function importWarnings(backup: GenealogyBackup) {
  const warnings: string[] = [];
  const archivedCount = backup.people.filter(
    (person) => person.archivedAt !== null,
  ).length;
  const mergedCount = backup.people.filter(
    (person) => person.mergedIntoPersonId !== null,
  ).length;

  if (archivedCount > 0) {
    warnings.push(`Backup chứa ${archivedCount} hồ sơ archived.`);
  }
  if (mergedCount > 0) {
    warnings.push(`Backup chứa ${mergedCount} hồ sơ đã merged.`);
  }
  if (parentChildHasCycle(backup)) {
    warnings.push(
      "Backup chứa vòng lặp parent-child; import thực tế phải bị chặn cho tới khi review.",
    );
  }

  return warnings;
}

function previewCounts(
  backup: GenealogyBackup,
  existingPersonIds: ReadonlySet<string>,
) {
  const existingPeople = backup.people.filter((person) =>
    existingPersonIds.has(person.id),
  ).length;

  return {
    people: backup.people.length,
    relationships: backup.relationships.length,
    layouts: backup.layouts.length,
    sources: backup.sources.length,
    citations: backup.citations.length,
    existingPeople,
    newPeople: backup.people.length - existingPeople,
  };
}

export function previewGenealogyImport(
  raw: unknown,
  existingPersonIds: ReadonlySet<string>,
): ImportPreview {
  const parsed = genealogyBackupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues
        .slice(0, 20)
        .map((issue) => issue.message),
      warnings: [],
      counts: {
        people: 0,
        relationships: 0,
        layouts: 0,
        sources: 0,
        citations: 0,
        existingPeople: 0,
        newPeople: 0,
      },
    };
  }

  const errors: string[] = [];
  validateUniqueIds(parsed.data, errors);
  validateRelationshipReferences(parsed.data, errors);
  validateLayoutReferences(parsed.data, errors);
  validateCitationReferences(parsed.data, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings: importWarnings(parsed.data),
    counts: previewCounts(parsed.data, existingPersonIds),
  };
}

export function buildBatchVisibilityImpact(
  people: VisibilityPreviewPerson[],
  targetVisibility: "public" | "private",
): BatchVisibilityImpact {
  const changes = people
    .filter((person) => person.visibility !== targetVisibility)
    .map((person) => ({
      personId: person.id,
      displayName: person.displayName,
      expectedRevision: person.revision,
      fromVisibility: person.visibility,
      toVisibility: targetVisibility,
    }));

  const privateToPublicCount = changes.filter(
    (change) => change.fromVisibility === "private",
  ).length;
  const publicToPrivateCount = changes.filter(
    (change) => change.fromVisibility === "public",
  ).length;
  const livingPublicAfterCount = people.filter((person) => {
    const finalVisibility =
      person.visibility === targetVisibility ? person.visibility : targetVisibility;
    return person.deathYear === null && finalVisibility === "public";
  }).length;

  return {
    selectedCount: people.length,
    changingCount: changes.length,
    unchangedCount: people.length - changes.length,
    privateToPublicCount:
      targetVisibility === "public" ? privateToPublicCount : 0,
    publicToPrivateCount:
      targetVisibility === "private" ? publicToPrivateCount : 0,
    livingPublicAfterCount,
    changes,
  };
}
