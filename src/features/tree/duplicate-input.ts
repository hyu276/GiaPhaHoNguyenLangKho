import { z } from "zod";

const personIdSchema = z.string().uuid();

function hasDistinctPeople(value: {
  targetPersonId: string;
  sourcePersonId: string;
}) {
  return value.targetPersonId !== value.sourcePersonId;
}

export const personMergePairInputSchema = z
  .object({
    targetPersonId: personIdSchema,
    sourcePersonId: personIdSchema,
  })
  .refine(hasDistinctPeople, {
    message: "Target và source phải là hai người khác nhau.",
    path: ["sourcePersonId"],
  });

export const executePersonMergeInputSchema = personMergePairInputSchema.extend({
  confirmation: z.literal("MERGE"),
});

export type PersonMergePairInput = z.input<typeof personMergePairInputSchema>;
export type ExecutePersonMergeInput = z.input<
  typeof executePersonMergeInputSchema
>;
