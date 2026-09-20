import { z } from "zod";

export const provenanceSourceTypeSchema = z.enum([
  "family_book",
  "civil_record",
  "archive",
  "oral_history",
  "photo",
  "publication",
  "web",
  "other",
]);

export const provenanceClaimKindSchema = z.enum([
  "identity",
  "birth",
  "death",
  "relationship",
  "residence",
  "occupation",
  "note",
  "other",
]);

export const provenanceCertaintySchema = z.enum([
  "certain",
  "probable",
  "possible",
  "unknown",
]);

export const provenanceDateQualifierSchema = z.enum([
  "exact",
  "about",
  "before",
  "after",
  "range",
  "unknown",
]);

function nullableTextSchema(maxLength: number) {
  return z
    .union([z.string().trim().max(maxLength), z.null()])
    .transform((value) => (value && value.length > 0 ? value : null));
}

const nullableHttpUrlSchema = nullableTextSchema(2048).refine(
  (value) => value === null || /^https?:\/\//iu.test(value),
  "URL nguồn phải bắt đầu bằng http:// hoặc https://.",
);

const sourceShape = {
  title: z.string().trim().min(1, "Tên nguồn là bắt buộc.").max(200),
  sourceType: provenanceSourceTypeSchema,
  repositoryName: nullableTextSchema(200),
  referenceCode: nullableTextSchema(200),
  sourceUrl: nullableHttpUrlSchema,
};

export const createProvenanceSourceInputSchema = z.object(sourceShape);

export const updateProvenanceSourceInputSchema = z.object({
  sourceId: z.string().uuid(),
  ...sourceShape,
});

const citationShape = {
  sourceId: z.string().uuid(),
  personId: z.string().uuid().nullable(),
  relationshipId: z.string().uuid().nullable(),
  claimKind: provenanceClaimKindSchema,
  claimText: z
    .string()
    .trim()
    .min(1, "Nội dung claim là bắt buộc.")
    .max(2000),
  citationLocator: nullableTextSchema(240),
  note: nullableTextSchema(2000),
  certainty: provenanceCertaintySchema,
  dateText: nullableTextSchema(80),
  dateQualifier: provenanceDateQualifierSchema.nullable(),
};

function validateCitationTargetAndDate(
  value: {
    personId: string | null;
    relationshipId: string | null;
    dateText: string | null;
    dateQualifier: z.infer<typeof provenanceDateQualifierSchema> | null;
  },
  context: z.RefinementCtx,
) {
  const targetCount =
    Number(value.personId !== null) + Number(value.relationshipId !== null);

  if (targetCount !== 1) {
    context.addIssue({
      code: "custom",
      message: "Citation phải gắn với đúng một người hoặc một quan hệ.",
      path: ["personId"],
    });
  }

  const hasDateText = value.dateText !== null;
  const hasDateQualifier = value.dateQualifier !== null;
  if (hasDateText !== hasDateQualifier) {
    context.addIssue({
      code: "custom",
      message: "Biểu thức ngày và mức độ chính xác của ngày phải đi cùng nhau.",
      path: ["dateText"],
    });
  }
}

export const createProvenanceCitationInputSchema = z
  .object(citationShape)
  .superRefine(validateCitationTargetAndDate);

export const updateProvenanceCitationInputSchema = z
  .object({
    citationId: z.string().uuid(),
    ...citationShape,
  })
  .superRefine(validateCitationTargetAndDate);

export const removeProvenanceCitationInputSchema = z.object({
  citationId: z.string().uuid(),
});

export type ProvenanceSourceType = z.infer<
  typeof provenanceSourceTypeSchema
>;
export type ProvenanceClaimKind = z.infer<typeof provenanceClaimKindSchema>;
export type ProvenanceCertainty = z.infer<typeof provenanceCertaintySchema>;
export type ProvenanceDateQualifier = z.infer<
  typeof provenanceDateQualifierSchema
>;
export type CreateProvenanceSourceInput = z.input<
  typeof createProvenanceSourceInputSchema
>;
export type UpdateProvenanceSourceInput = z.input<
  typeof updateProvenanceSourceInputSchema
>;
export type CreateProvenanceCitationInput = z.input<
  typeof createProvenanceCitationInputSchema
>;
export type UpdateProvenanceCitationInput = z.input<
  typeof updateProvenanceCitationInputSchema
>;
export type RemoveProvenanceCitationInput = z.input<
  typeof removeProvenanceCitationInputSchema
>;
