"use server";

import { revalidatePath } from "next/cache";

import {
  createProvenanceCitationInputSchema,
  type CreateProvenanceCitationInput,
  createProvenanceSourceInputSchema,
  type CreateProvenanceSourceInput,
  removeProvenanceCitationInputSchema,
  type RemoveProvenanceCitationInput,
  updateProvenanceCitationInputSchema,
  type UpdateProvenanceCitationInput,
  updateProvenanceSourceInputSchema,
  type UpdateProvenanceSourceInput,
} from "@/features/tree/provenance-input";
import { requireAdmin } from "@/lib/auth/admin";

export type ProvenanceSourceMutationResult =
  | { ok: true; sourceId: string }
  | { ok: false; message: string };

export type ProvenanceCitationMutationResult =
  | { ok: true; citationId: string }
  | { ok: false; message: string };

function getValidationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Dữ liệu provenance không hợp lệ.";
}

export async function createProvenanceSource(
  input: CreateProvenanceSourceInput,
): Promise<ProvenanceSourceMutationResult> {
  const parsed = createProvenanceSourceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase
    .from("genealogy_sources")
    .insert({
      title: parsed.data.title,
      source_type: parsed.data.sourceType,
      repository_name: parsed.data.repositoryName,
      reference_code: parsed.data.referenceCode,
      source_url: parsed.data.sourceUrl,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể tạo nguồn tư liệu." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, sourceId: data.id };
}

export async function updateProvenanceSource(
  input: UpdateProvenanceSourceInput,
): Promise<ProvenanceSourceMutationResult> {
  const parsed = updateProvenanceSourceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase
    .from("genealogy_sources")
    .update({
      title: parsed.data.title,
      source_type: parsed.data.sourceType,
      repository_name: parsed.data.repositoryName,
      reference_code: parsed.data.referenceCode,
      source_url: parsed.data.sourceUrl,
      updated_by: user.id,
    })
    .eq("id", parsed.data.sourceId)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể cập nhật nguồn tư liệu." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, sourceId: data.id };
}

export async function createProvenanceCitation(
  input: CreateProvenanceCitationInput,
): Promise<ProvenanceCitationMutationResult> {
  const parsed = createProvenanceCitationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase
    .from("genealogy_citations")
    .insert({
      source_id: parsed.data.sourceId,
      person_id: parsed.data.personId,
      relationship_id: parsed.data.relationshipId,
      claim_kind: parsed.data.claimKind,
      claim_text: parsed.data.claimText,
      citation_locator: parsed.data.citationLocator,
      note: parsed.data.note,
      certainty: parsed.data.certainty,
      date_text: parsed.data.dateText,
      date_qualifier: parsed.data.dateQualifier,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể thêm citation." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, citationId: data.id };
}

export async function updateProvenanceCitation(
  input: UpdateProvenanceCitationInput,
): Promise<ProvenanceCitationMutationResult> {
  const parsed = updateProvenanceCitationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase
    .from("genealogy_citations")
    .update({
      source_id: parsed.data.sourceId,
      person_id: parsed.data.personId,
      relationship_id: parsed.data.relationshipId,
      claim_kind: parsed.data.claimKind,
      claim_text: parsed.data.claimText,
      citation_locator: parsed.data.citationLocator,
      note: parsed.data.note,
      certainty: parsed.data.certainty,
      date_text: parsed.data.dateText,
      date_qualifier: parsed.data.dateQualifier,
      updated_by: user.id,
    })
    .eq("id", parsed.data.citationId)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể cập nhật citation." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, citationId: data.id };
}

export async function removeProvenanceCitation(
  input: RemoveProvenanceCitationInput,
): Promise<ProvenanceCitationMutationResult> {
  const parsed = removeProvenanceCitationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("genealogy_citations")
    .delete()
    .eq("id", parsed.data.citationId)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể xóa citation." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, citationId: data.id };
}
