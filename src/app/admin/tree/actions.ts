"use server";

import { revalidatePath } from "next/cache";

import {
  createPersonInputSchema,
  type CreatePersonInput,
  type UpdatePersonInput,
  updatePersonInputSchema,
} from "@/features/tree/person-input";
import { requireAdmin } from "@/lib/auth/admin";

export type PersonMutationResult =
  { ok: true; personId: string } | { ok: false; message: string };

function getValidationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Dữ liệu người không hợp lệ.";
}

export async function createPerson(
  input: CreatePersonInput,
): Promise<PersonMutationResult> {
  const parsed = createPersonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("people")
    .insert({
      display_name: parsed.data.displayName,
      description: parsed.data.description,
      birth_year: parsed.data.birthYear,
      death_year: parsed.data.deathYear,
      sex: parsed.data.sex,
      visibility: parsed.data.visibility,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể thêm người vào gia phả." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, personId: data.id };
}

export async function updatePerson(
  input: UpdatePersonInput,
): Promise<PersonMutationResult> {
  const parsed = updatePersonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("people")
    .update({
      display_name: parsed.data.displayName,
      description: parsed.data.description,
      birth_year: parsed.data.birthYear,
      death_year: parsed.data.deathYear,
      sex: parsed.data.sex,
      visibility: parsed.data.visibility,
    })
    .eq("id", parsed.data.personId)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể cập nhật hồ sơ người này." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, personId: data.id };
}
