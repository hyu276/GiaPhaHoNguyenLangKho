"use server";

import { revalidatePath } from "next/cache";

import { orderPartnershipEndpoints } from "@/features/tree/relationship-domain";
import {
  createParentChildInputSchema,
  type CreateParentChildInput,
  createPartnershipInputSchema,
  type CreatePartnershipInput,
  removeRelationshipInputSchema,
  type RemoveRelationshipInput,
} from "@/features/tree/relationship-input";
import { requireAdmin } from "@/lib/auth/admin";

export type RelationshipMutationResult =
  { ok: true; relationshipId: string } | { ok: false; message: string };

type DatabaseError = {
  code?: string;
  message?: string;
};

function validationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Dữ liệu quan hệ không hợp lệ.";
}

function relationshipDatabaseMessage(error: DatabaseError) {
  if (error.code === "23505") {
    return "Quan hệ này đã tồn tại.";
  }

  if (error.message?.includes("ancestry cycle")) {
    return "Quan hệ cha/mẹ – con này sẽ tạo vòng lặp tổ tiên.";
  }

  if (error.message?.includes("relationships_no_self_link")) {
    return "Không thể tạo quan hệ với chính người đó.";
  }

  if (error.message?.includes("archived people cannot receive new relationships")) {
    return "Hãy khôi phục hồ sơ đã lưu trữ trước khi thêm quan hệ mới.";
  }

  return "Không thể lưu quan hệ gia phả.";
}

export async function createParentChildRelationship(
  input: CreateParentChildInput,
): Promise<RelationshipMutationResult> {
  const parsed = createParentChildInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("relationships")
    .insert({
      relationship_kind: "parent_child",
      source_person_id: parsed.data.firstPersonId,
      target_person_id: parsed.data.secondPersonId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: relationshipDatabaseMessage(error ?? {}),
    };
  }

  revalidatePath("/admin/tree");
  return { ok: true, relationshipId: data.id };
}

export async function createPartnership(
  input: CreatePartnershipInput,
): Promise<RelationshipMutationResult> {
  const parsed = createPartnershipInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const [sourcePersonId, targetPersonId] = orderPartnershipEndpoints(
    parsed.data.firstPersonId,
    parsed.data.secondPersonId,
  );
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("relationships")
    .insert({
      relationship_kind: "partnership",
      source_person_id: sourcePersonId,
      target_person_id: targetPersonId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: relationshipDatabaseMessage(error ?? {}),
    };
  }

  revalidatePath("/admin/tree");
  return { ok: true, relationshipId: data.id };
}

export async function removeRelationship(
  input: RemoveRelationshipInput,
): Promise<RelationshipMutationResult> {
  const parsed = removeRelationshipInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("relationships")
    .delete()
    .eq("id", parsed.data.relationshipId)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể xóa quan hệ này." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, relationshipId: data.id };
}
