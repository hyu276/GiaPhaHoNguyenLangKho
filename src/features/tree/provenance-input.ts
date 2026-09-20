import { z } from "zod";

const uuidSchema = z.string().uuid();

function nullableText(max: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value ?? null;
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    },
    z.string().max(max).nullable(),
  );
}

const nullableUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value ?? null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  },
  z.string().url("URL nguồn không hợp lệ.").max(2000).nullable(),
);

export const sourceTypeSchema = z.enum([
  "document",
  "book",
  "archive",
  "oral_history",
  "website",
  "photo",
  "other",
]);

export const certaintySchema = z.enum([
  "certain",
  "probable",
  "possible",
  "uncertain",
]);

export const dateQualifierSchema = z.enum([
  "not_applicable",
  "exact",
  "about",
  "before",
  "after",
  "between",
  "unknown",
]);

export const provenanceFieldKeySchema = z.enum([
  "display_name",
  "birth_year",
  "death_year",
  "description",
  "sex",
  "relationship",
  "other",
]);

export const provenanceSubjectSchema = z
  .object({
    personId: uuidSchema.nullable(),
    relationshipId: uuidSchema.nullable(),
  })
  .refine(
    (value) =>
      (value.personId !== null) !== (value.relationshipId !== null),
    {
      message: "Provenance phải gắn với đúng một người hoặc một quan hệ.",
      path: ["personId"],
    },
  );

const sourceFields = {
  sourceTitle: z.string().trim().min(1).max(300),
  sourceType: sourceTypeSchema,
  sourceAuthor: nullableText(200),
  sourceRepository: nullableText(200),
  sourceReferenceCode: nullableText(120),
  sourcePublicationText: nullableText(120),
  sourceUrl: nullableUrl,
  sourceNotes: nullableText(2000),
};

const citationFields = {
  fieldKey: provenanceFieldKeySchema.nullable(),
  claimText: z.string().trim().min(1).max(2000),
  locator: nullableText(300),
  certainty: certaintySchema,
  dateQualifier: dateQualifierSchema,
};

export const createCitationInputSchema = provenanceSubjectSchema.extend({
  ...sourceFields,
  ...citationFields,
});

export const updateCitationInputSchema = createCitationInputSchema.extend({
  citationId: uuidSchema,
  sourceId: uuidSchema,
});

export const createNoteInputSchema = provenanceSubjectSchema.extend({
  noteText: z.string().trim().min(1).max(4000),
  certainty: certaintySchema,
});

export const updateNoteInputSchema = z.object({
  entryId: uuidSchema,
  noteText: z.string().trim().min(1).max(4000),
  certainty: certaintySchema,
});

export const removeProvenanceEntryInputSchema = z.object({
  entryId: uuidSchema,
});

export type SourceType = z.infer<typeof sourceTypeSchema>;
export type ProvenanceCertainty = z.infer<typeof certaintySchema>;
export type DateQualifier = z.infer<typeof dateQualifierSchema>;
export type ProvenanceFieldKey = z.infer<typeof provenanceFieldKeySchema>;
export type ProvenanceSubject = z.infer<typeof provenanceSubjectSchema>;
export type CreateCitationInput = z.input<typeof createCitationInputSchema>;
export type UpdateCitationInput = z.input<typeof updateCitationInputSchema>;
export type CreateNoteInput = z.input<typeof createNoteInputSchema>;
export type UpdateNoteInput = z.input<typeof updateNoteInputSchema>;
export type RemoveProvenanceEntryInput = z.input<
  typeof removeProvenanceEntryInputSchema
>;
