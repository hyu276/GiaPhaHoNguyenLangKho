import { z } from "zod";

const importPersonSchema = z.object({
  externalId: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  birthYear: z.number().int().min(1).max(2200).nullable(),
  deathYear: z.number().int().min(1).max(2200).nullable(),
  sex: z.enum(["male", "female"]).nullable(),
  visibility: z.enum(["public", "private"]),
});

const importRelationshipSchema = z.object({
  kind: z.enum(["parent_child", "partnership"]),
  sourceExternalId: z.string().trim().min(1).max(120),
  targetExternalId: z.string().trim().min(1).max(120),
});

const importPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  people: z.array(importPersonSchema).max(5000),
  relationships: z.array(importRelationshipSchema).max(10000),
});

export type ImportPreviewIssue = {
  code:
    | "duplicate_external_id"
    | "missing_person_reference"
    | "self_relationship"
    | "duplicate_relationship"
    | "invalid_year_order";
  severity: "error" | "warning";
  message: string;
};

export type ImportPreview = {
  schemaVersion: 1;
  personCount: number;
  relationshipCount: number;
  publicCount: number;
  privateCount: number;
  issues: ImportPreviewIssue[];
  canProceedToFutureImport: boolean;
};

function parseJson(text: string) {
  if (text.length > 2_000_000) {
    return {
      ok: false as const,
      message: "Import preview chỉ nhận tối đa 2 MB JSON.",
    };
  }

  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false as const,
      message: "JSON không hợp lệ.",
    };
  }
}

function relationshipKey(
  kind: "parent_child" | "partnership",
  source: string,
  target: string,
) {
  if (kind === "partnership" && source.localeCompare(target) > 0) {
    return kind + ":" + target + ":" + source;
  }
  return kind + ":" + source + ":" + target;
}

function duplicateExternalIdIssues(
  people: z.infer<typeof importPersonSchema>[],
) {
  const seen = new Set<string>();
  const issues: ImportPreviewIssue[] = [];

  for (const person of people) {
    if (seen.has(person.externalId)) {
      issues.push({
        code: "duplicate_external_id",
        severity: "error",
        message: "externalId bị lặp: " + person.externalId,
      });
    }
    seen.add(person.externalId);
  }

  return issues;
}

function yearOrderIssues(people: z.infer<typeof importPersonSchema>[]) {
  return people.flatMap<ImportPreviewIssue>((person) => {
    if (
      person.birthYear === null ||
      person.deathYear === null ||
      person.birthYear <= person.deathYear
    ) {
      return [];
    }

    return [
      {
        code: "invalid_year_order",
        severity: "error",
        message: person.externalId + ": năm sinh sau năm mất.",
      },
    ];
  });
}

function relationshipIssues(
  people: z.infer<typeof importPersonSchema>[],
  relationships: z.infer<typeof importRelationshipSchema>[],
) {
  const personIds = new Set(people.map((person) => person.externalId));
  const seenRelationships = new Set<string>();
  const issues: ImportPreviewIssue[] = [];

  for (const relationship of relationships) {
    if (
      !personIds.has(relationship.sourceExternalId) ||
      !personIds.has(relationship.targetExternalId)
    ) {
      issues.push({
        code: "missing_person_reference",
        severity: "error",
        message:
          relationship.kind +
          ": source/target phải tồn tại trong people (" +
          relationship.sourceExternalId +
          " → " +
          relationship.targetExternalId +
          ").",
      });
    }

    if (relationship.sourceExternalId === relationship.targetExternalId) {
      issues.push({
        code: "self_relationship",
        severity: "error",
        message: "Quan hệ self-link: " + relationship.sourceExternalId + ".",
      });
    }

    const key = relationshipKey(
      relationship.kind,
      relationship.sourceExternalId,
      relationship.targetExternalId,
    );
    if (seenRelationships.has(key)) {
      issues.push({
        code: "duplicate_relationship",
        severity: "warning",
        message: "Quan hệ bị lặp: " + key + ".",
      });
    }
    seenRelationships.add(key);
  }

  return issues;
}

export function previewStructuredImport(text: string):
  | { ok: true; preview: ImportPreview }
  | { ok: false; message: string } {
  const parsedJson = parseJson(text);
  if (!parsedJson.ok) return parsedJson;

  const parsed = importPayloadSchema.safeParse(parsedJson.value);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Cấu trúc import không hợp lệ.",
    };
  }

  const issues = [
    ...duplicateExternalIdIssues(parsed.data.people),
    ...yearOrderIssues(parsed.data.people),
    ...relationshipIssues(parsed.data.people, parsed.data.relationships),
  ];
  const publicCount = parsed.data.people.filter(
    (person) => person.visibility === "public",
  ).length;

  return {
    ok: true,
    preview: {
      schemaVersion: 1,
      personCount: parsed.data.people.length,
      relationshipCount: parsed.data.relationships.length,
      publicCount,
      privateCount: parsed.data.people.length - publicCount,
      issues,
      canProceedToFutureImport: !issues.some(
        (issue) => issue.severity === "error",
      ),
    },
  };
}

export const batchVisibilityInputSchema = z.object({
  visibility: z.enum(["public", "private"]),
  people: z
    .array(
      z.object({
        personId: z.string().uuid(),
        expectedRevision: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(500)
    .refine(
      (items) =>
        new Set(items.map((item) => item.personId)).size === items.length,
      "Danh sách batch visibility chứa hồ sơ bị lặp.",
    ),
});

export type BatchVisibilityInput = z.input<typeof batchVisibilityInputSchema>;
