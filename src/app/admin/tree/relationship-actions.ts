"use server";

import { revalidatePath } from "next/cache";

import { conflictMessage } from "@/features/tree/audit-input";
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
  | { ok: true; relationshipId: string; revision: number }
  | { ok: false; message: string; kind?: "conflict" };

type DatabaseError = {
  code?: string;
  message?: string;
};

function validationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Dữ liệu quan hệ không hợp lệ.";
}

function relationshipDatabaseMessage(error: DatabaseError) {
  const message = error.message ?? "";

  if (error.code === "23505") return "Quan hệ này đã tồn tại.";
  if (message.includes("ancestry cycle")) {
    return "Quan hệ cha/mẹ – con này sẽ tạo vòng lặp tổ tiên.";
  }
  if (message.includes("relationships_no_self_link")) {
    return "Không thể tạo quan hệ với chính người đó.";
  }
  if (message.includes("archived people cannot receive new relationships")) {
    return "Hãy khôi phục hồ sơ đã lưu trữ trước khi thêm quan hệ mới.";
  }

  return "Không thể lưu quan hệ gia phả.";
}

async function getRelationshipRevision(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  relationshipId: string,
) {
  const { data } = await supabase
    .from("relationships")
    .select("revision")
    .eq("id", relationshipId)
    .maybeSingle();

  return typeof data?.revision === "number" ? data.revision : null;
}

async function getRelationshipRemovalFailure(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  relationshipId: string,
  expectedRevision: number | undefined,
  error: DatabaseError | null,
): Promise<RelationshipMutationResult> {
  if (expectedRevision !== undefined) {
    const currentRevision = await getRelationshipRevision(
      supabase,
      relationshipId,
    );
    if (currentRevision !== null && currentRevision !== expectedRevision) {
      return {
        ok: false,
        kind: "conflict",
        message: conflictMessage("Quan hệ"),
      };
    }
  }

  if (error?.code === "23503") {
    return {
      ok: false,
      message:
        "Quan hệ này đang có citation. Hãy review/xóa citation trước khi xóa quan hệ để không làm mất provenance.",
    };
  }

  return { ok: false, message: "Không thể xóa quan hệ này." };
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
    .select("id, revision")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: relationshipDatabaseMessage(error ?? {}),
    };
  }

  revalidatePath("/admin/tree");
  return {
    ok: true,
    relationshipId: data.id,
    revision: data.revision,
  };
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
    .select("id, revision")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: relationshipDatabaseMessage(error ?? {}),
    };
  }

  revalidatePath("/admin/tree");
  return {
    ok: true,
    relationshipId: data.id,
    revision: data.revision,
  };
}

export async function removeRelationship(
  input: RemoveRelationshipInput,
): Promise<RelationshipMutationResult> {
  const parsed = removeRelationshipInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  let query = supabase
    .from("relationships")
    .delete()
    .eq("id", parsed.data.relationshipId);

  if (parsed.data.expectedRevision !== undefined) {
    query = query.eq("revision", parsed.data.expectedRevision);
  }

  const { data, error } = await query.select("id, revision").single();

  if (error || !data) {
    return getRelationshipRemovalFailure(
      supabase,
      parsed.data.relationshipId,
      parsed.data.expectedRevision,
      error,
    );
  }

  revalidatePath("/admin/tree");
  return {
    ok: true,
    relationshipId: data.id,
    revision: data.revision,
  };
}
