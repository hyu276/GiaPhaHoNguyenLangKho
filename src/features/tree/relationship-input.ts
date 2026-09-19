import { z } from "zod";

const personIdSchema = z.string().uuid();

function hasDistinctPeople(value: {
  firstPersonId: string;
  secondPersonId: string;
}) {
  return value.firstPersonId !== value.secondPersonId;
}

export const createParentChildInputSchema = z
  .object({
    firstPersonId: personIdSchema,
    secondPersonId: personIdSchema,
  })
  .refine(hasDistinctPeople, {
    message: "Không thể tạo quan hệ với chính người đó.",
    path: ["secondPersonId"],
  });

export const createPartnershipInputSchema = z
  .object({
    firstPersonId: personIdSchema,
    secondPersonId: personIdSchema,
  })
  .refine(hasDistinctPeople, {
    message: "Không thể tạo quan hệ hôn phối với chính người đó.",
    path: ["secondPersonId"],
  });

export const removeRelationshipInputSchema = z.object({
  relationshipId: z.string().uuid(),
});

export type CreateParentChildInput = z.input<
  typeof createParentChildInputSchema
>;
export type CreatePartnershipInput = z.input<
  typeof createPartnershipInputSchema
>;
export type RemoveRelationshipInput = z.input<
  typeof removeRelationshipInputSchema
>;
