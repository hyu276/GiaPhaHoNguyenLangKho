"use server";

import { revalidatePath } from "next/cache";

import { conflictMessage } from "@/features/tree/audit-input";
import {
  createPersonInputSchema,
  type CreatePersonInput,
  type PersonStateInput,
  personStateInputSchema,
  type UpdatePersonInput,
  updatePersonInputSchema,
} from "@/features/tree/person-input";
import { requireAdmin } from "@/lib/auth/admin";

export type PersonMutationResult =
  | { ok: true; personId: string; revision: number }
  | { ok: false; message: string; kind?: "conflict" };

function getValidationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Dữ liệu người không hợp lệ.";
}

async function getPersonRevision(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  personId: string,
) {
  const { data } = await supabase
    .from("people")
    .select("revision")
    .eq("id", personId)
    .maybeSingle();

  return typeof data?.revision === "number" ? data.revision : null;
}

async function failedPersonMutation(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  personId: string,
  expectedRevision: number | undefined,
  fallbackMessage: string,
): Promise<PersonMutationResult> {
  if (expectedRevision !== undefined) {
    const currentRevision = await getPersonRevision(supabase, personId);
    if (currentRevision !== null && currentRevision !== expectedRevision) {
      return {
        ok: false,
        kind: "conflict",
        message: conflictMessage("Hồ sơ"),
      };
    }
  }

  return { ok: false, message: fallbackMessage };
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
    .select("id, revision")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể thêm người vào gia phả." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, personId: data.id, revision: data.revision };
}

export async function updatePerson(
  input: UpdatePersonInput,
): Promise<PersonMutationResult> {
  const parsed = updatePersonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  let query = supabase
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
    .is("archived_at", null);

  if (parsed.data.expectedRevision !== undefined) {
    query = query.eq("revision", parsed.data.expectedRevision);
  }

  const { data, error } = await query.select("id, revision").single();

  if (error || !data) {
    return failedPersonMutation(
      supabase,
      parsed.data.personId,
      parsed.data.expectedRevision,
      "Không thể cập nhật hồ sơ người này.",
    );
  }

  revalidatePath("/admin/tree");
  return { ok: true, personId: data.id, revision: data.revision };
}

export async function archivePerson(
  input: PersonStateInput,
): Promise<PersonMutationResult> {
  const parsed = personStateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  let query = supabase
    .from("people")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.personId)
    .is("archived_at", null);

  if (parsed.data.expectedRevision !== undefined) {
    query = query.eq("revision", parsed.data.expectedRevision);
  }

  const { data, error } = await query.select("id, revision").single();

  if (error || !data) {
    return failedPersonMutation(
      supabase,
      parsed.data.personId,
      parsed.data.expectedRevision,
      "Không thể lưu trữ hồ sơ này hoặc hồ sơ đã được lưu trữ.",
    );
  }

  revalidatePath("/admin/tree");
  return { ok: true, personId: data.id, revision: data.revision };
}

export async function restorePerson(
  input: PersonStateInput,
): Promise<PersonMutationResult> {
  const parsed = personStateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  let query = supabase
    .from("people")
    .update({ archived_at: null })
    .eq("id", parsed.data.personId)
    .not("archived_at", "is", null);

  if (parsed.data.expectedRevision !== undefined) {
    query = query.eq("revision", parsed.data.expectedRevision);
  }

  const { data, error } = await query.select("id, revision").single();

  if (error || !data) {
    return failedPersonMutation(
      supabase,
      parsed.data.personId,
      parsed.data.expectedRevision,
      "Không thể khôi phục hồ sơ này hoặc hồ sơ chưa được lưu trữ.",
    );
  }

  revalidatePath("/admin/tree");
  return { ok: true, personId: data.id, revision: data.revision };
}
