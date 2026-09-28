import { z } from "zod";

export const bulkVisibilitySchema = z.enum(["public", "private"]);

const importedPersonSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().trim().min(1).max(120),
  birth_year: z.number().int().min(1).max(2200).nullable(),
  death_year: z.number().int().min(1).max(2200).nullable(),
  visibility: bulkVisibilitySchema,
  archived_at: z.string().nullable().optional(),
  merged_into_person_id: z.string().uuid().nullable().optional(),
});

const importedRelationshipSchema = z.object({
  id: z.string().uuid(),
  relationship_kind: z.enum(["parent_child", "partnership"]),
  source_person_id: z.string().uuid(),
  target_person_id: z.string().uuid(),
});

const importedLayoutSchema = z.object({
  person_id: z.string().uuid(),
  position_x: z.number().finite(),
  position_y: z.number().finite(),
});

const importedSourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
});

const importedCitationSchema = z.object({
  id: z.string().uuid(),
  source_id: z.string().uuid(),
  person_id: z.string().uuid().nullable(),
  relationship_id: z.string().uuid().nullable(),
});

const backupImportSchema = z.object({
  version: z.literal(1),
  people: z.array(importedPersonSchema).max(10_000),
  relationships: z.array(importedRelationshipSchema).max(20_000),
  person_layouts: z.array(importedLayoutSchema).max(10_000),
  genealogy_sources: z.array(importedSourceSchema).max(10_000),
  genealogy_citations: z.array(importedCitationSchema).max(50_000),
});

export type BulkPersonSummary = {
  id: string;
  displayName: string;
  visibility: z.infer<typeof bulkVisibilitySchema>;
  deathYear: number | null;
  revision: number;
};

export type ImportPreview = {
  ok: boolean;
  counts: {
    people: number;
    relationships: number;
    layouts: number;
    sources: number;
    citations: number;
  };
  errors: string[];
  warnings: string[];
};

export type VisibilityImpact = {
  selectedCount: number;
  changingCount: number;
  unchangedCount: number;
  livingPublicAfterCount: number;
};

function duplicateIds(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });

  return [...duplicates];
}

function validateRelationshipReferences(
  peopleIds: ReadonlySet<string>,
  relationships: z.infer<typeof importedRelationshipSchema>[],
) {
  const errors: string[] = [];

  relationships.forEach((relationship) => {
    if (!peopleIds.has(relationship.source_person_id)) {
      errors.push(
        `Relationship ${relationship.id} references missing source person.`,
      );
    }
    if (!peopleIds.has(relationship.target_person_id)) {
      errors.push(
        `Relationship ${relationship.id} references missing target person.`,
      );
    }
    if (relationship.source_person_id === relationship.target_person_id) {
      errors.push(`Relationship ${relationship.id} is a self-link.`);
    }
  });

  return errors;
}

function validateLayoutReferences(
  peopleIds: ReadonlySet<string>,
  layouts: z.infer<typeof importedLayoutSchema>[],
) {
  return layouts.flatMap((layout) =>
    peopleIds.has(layout.person_id)
      ? []
      : [`Layout references missing person ${layout.person_id}.`],
  );
}

function validateCitationReferences(
  sourceIds: ReadonlySet<string>,
  peopleIds: ReadonlySet<string>,
  relationshipIds: ReadonlySet<string>,
  citations: z.infer<typeof importedCitationSchema>[],
) {
  const errors: string[] = [];

  citations.forEach((citation) => {
    if (!sourceIds.has(citation.source_id)) {
      errors.push(`Citation ${citation.id} references a missing source.`);
    }

    const targetCount =
      Number(citation.person_id !== null) +
      Number(citation.relationship_id !== null);
    if (targetCount !== 1) {
      errors.push(
        `Citation ${citation.id} must target exactly one person or relationship.`,
      );
    }

    if (citation.person_id && !peopleIds.has(citation.person_id)) {
      errors.push(`Citation ${citation.id} references a missing person.`);
    }
    if (
      citation.relationship_id &&
      !relationshipIds.has(citation.relationship_id)
    ) {
      errors.push(`Citation ${citation.id} references a missing relationship.`);
    }
  });

  return errors;
}

function chronologyWarnings(people: z.infer<typeof importedPersonSchema>[]) {
  return people.flatMap((person) => {
    if (
      person.birth_year === null ||
      person.death_year === null ||
      person.birth_year <= person.death_year
    ) {
      return [];
    }

    return [
      `Person ${person.id} has birth year after death year and would require review.`,
    ];
  });
}

function emptyPreview(error: string): ImportPreview {
  return {
    ok: false,
    counts: {
      people: 0,
      relationships: 0,
      layouts: 0,
      sources: 0,
      citations: 0,
    },
    errors: [error],
    warnings: [],
  };
}

export function previewStructuredImport(rawText: string): ImportPreview {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return emptyPreview("File is not valid JSON.");
  }

  const parsed = backupImportSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return emptyPreview(
      parsed.error.issues[0]?.message ?? "Backup structure is invalid.",
    );
  }

  const backup = parsed.data;
  const peopleIds = new Set(backup.people.map((person) => person.id));
  const relationshipIds = new Set(
    backup.relationships.map((relationship) => relationship.id),
  );
  const sourceIds = new Set(
    backup.genealogy_sources.map((source) => source.id),
  );
  const errors = [
    ...duplicateIds(backup.people.map((person) => person.id)).map(
      (id) => `Duplicate person ID: ${id}.`,
    ),
    ...duplicateIds(
      backup.relationships.map((relationship) => relationship.id),
    ).map((id) => `Duplicate relationship ID: ${id}.`),
    ...validateRelationshipReferences(peopleIds, backup.relationships),
    ...validateLayoutReferences(peopleIds, backup.person_layouts),
    ...validateCitationReferences(
      sourceIds,
      peopleIds,
      relationshipIds,
      backup.genealogy_citations,
    ),
  ];
  const warnings = chronologyWarnings(backup.people);

  return {
    ok: errors.length === 0,
    counts: {
      people: backup.people.length,
      relationships: backup.relationships.length,
      layouts: backup.person_layouts.length,
      sources: backup.genealogy_sources.length,
      citations: backup.genealogy_citations.length,
    },
    errors,
    warnings,
  };
}

export function buildVisibilityImpact(
  people: BulkPersonSummary[],
  selectedIds: ReadonlySet<string>,
  nextVisibility: z.infer<typeof bulkVisibilitySchema>,
): VisibilityImpact {
  const selected = people.filter((person) => selectedIds.has(person.id));
  const changing = selected.filter(
    (person) => person.visibility !== nextVisibility,
  );
  const livingPublicAfterCount = selected.filter(
    (person) => person.deathYear === null && nextVisibility === "public",
  ).length;

  return {
    selectedCount: selected.length,
    changingCount: changing.length,
    unchangedCount: selected.length - changing.length,
    livingPublicAfterCount,
  };
}
