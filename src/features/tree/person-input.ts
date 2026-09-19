import { z } from "zod";

export const personVisibilitySchema = z.enum(["public", "private"]);
export const personSexSchema = z.enum(["male", "female"]);

const nullableYearSchema = z.number().int().min(1).max(2200).nullable();

const nullableDescriptionSchema = z
  .union([z.string().trim().max(2000), z.null()])
  .transform((value) => (value === null || value.length === 0 ? null : value));

const personFieldsSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  description: nullableDescriptionSchema,
  birthYear: nullableYearSchema,
  deathYear: nullableYearSchema,
  sex: personSexSchema.nullable(),
  visibility: personVisibilitySchema,
});

function hasValidYearOrder(value: {
  birthYear: number | null;
  deathYear: number | null;
}) {
  return (
    value.birthYear === null ||
    value.deathYear === null ||
    value.birthYear <= value.deathYear
  );
}

export const createPersonInputSchema = personFieldsSchema.refine(
  hasValidYearOrder,
  {
    message: "Năm sinh không thể sau năm mất.",
    path: ["deathYear"],
  },
);

export const personStateInputSchema = z.object({
  personId: z.string().uuid(),
});

export const updatePersonInputSchema = personFieldsSchema
  .extend({
    personId: z.string().uuid(),
  })
  .refine(hasValidYearOrder, {
    message: "Năm sinh không thể sau năm mất.",
    path: ["deathYear"],
  });

export type PersonVisibility = z.infer<typeof personVisibilitySchema>;
export type PersonSex = z.infer<typeof personSexSchema>;
export type CreatePersonInput = z.input<typeof createPersonInputSchema>;
export type UpdatePersonInput = z.input<typeof updatePersonInputSchema>;
export type PersonStateInput = z.input<typeof personStateInputSchema>;
