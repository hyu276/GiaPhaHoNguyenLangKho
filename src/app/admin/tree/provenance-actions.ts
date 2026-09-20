"use server";

import { revalidatePath } from "next/cache";

import {
  createCitationInputSchema,
  type CreateCitationInput,
  createNoteInputSchema,
  type CreateNoteInput,
  removeProvenanceEntryInputSchema,
  type RemoveProvenanceEntryInput,
  updateCitationInputSchema,
  type UpdateCitationInput,
  updateNoteInputSchema,
  type UpdateNoteInput,
} from "@/features/tree/provenance-input";
import { requireAdmin } from "@/lib/auth/admin";

export type ProvenanceMutationResult =
  | { ok: true; entryId: string }
  | { ok: false; message: string };

function validationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Dữ liệu provenance không hợp lệ.";
}

function subjectColumns(subject: {
  personId: string | null;
  relationshipId: string | null;
}) {
  return {
    person_id: subject.personId,
    relationship_id: subject.relationshipId,
  };
}

function sourceColumns(
  input: Omit<
    UpdateCitationInput,
    | "citationId"
    | "sourceId"
    | "personId"
    | "relationshipId"
    | "fieldKey"
    | "claimText"
    | "locator"
    | "certainty"
    | "dateQualifier"
  >,
  userId: string,
) {
  return {
    title: input.sourceTitle,
    source_type: input.sourceType,
    author: input.sourceAuthor,
    repository: input.sourceRepository,
    reference_code: input.sourceReferenceCode,
    publication_text: input.sourcePublicationText,
    url: input.sourceUrl,
    notes: input.sourceNotes,
    created_by: userId,
  };
}

function citationColumns(
  input: Pick<
    UpdateCitationInput,
    "fieldKey" | "claimText" | "locator" | "certainty" | "dateQualifier"
  >,
) {
  return {
    field_key: input.fieldKey,
    claim_text: input.claimText,
    locator: input.locator,
    certainty: input.certainty,
    date_qualifier: input.dateQualifier,
  };
}

export async function createCitation(
  input: CreateCitationInput,
): Promise<ProvenanceMutationResult> {
  const parsed = createCitationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase, user } = await requireAdmin();
  const { data: source, error: sourceError } = await supabase
    .from("genealogy_sources")
    .insert(sourceColumns(parsed.data, user.id))
    .select("id")
    .single();

  if (sourceError || !source) {
    return { ok: false, message: "Không thể lưu nguồn tư liệu." };
  }

  const { data: entry, error: entryError } = await supabase
    .from("provenance_entries")
    .insert({
      ...subjectColumns(parsed.data),
      source_id: source.id,
      entry_kind: "citation",
      ...citationColumns(parsed.data),
      note_text: null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (entryError || !entry) {
    await supabase.from("genealogy_sources").delete().eq("id", source.id);
    return { ok: false, message: "Không thể lưu citation." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, entryId: entry.id };
}

export async function updateCitation(
  input: UpdateCitationInput,
): Promise<ProvenanceMutationResult> {
  const parsed = updateCitationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase, user } = await requireAdmin();
  const { error: sourceError } = await supabase
    .from("genealogy_sources")
    .update(sourceColumns(parsed.data, user.id))
    .eq("id", parsed.data.sourceId);

  if (sourceError) {
    return { ok: false, message: "Không thể cập nhật nguồn tư liệu." };
  }

  const { data: entry, error: entryError } = await supabase
    .from("provenance_entries")
    .update({
      ...subjectColumns(parsed.data),
      ...citationColumns(parsed.data),
    })
    .eq("id", parsed.data.citationId)
    .eq("source_id", parsed.data.sourceId)
    .eq("entry_kind", "citation")
    .select("id")
    .single();

  if (entryError || !entry) {
    return { ok: false, message: "Không thể cập nhật citation." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, entryId: entry.id };
}

export async function createNote(
  input: CreateNoteInput,
): Promise<ProvenanceMutationResult> {
  const parsed = createNoteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase
    .from("provenance_entries")
    .insert({
      ...subjectColumns(parsed.data),
      source_id: null,
      entry_kind: "note",
      field_key: null,
      claim_text: null,
      locator: null,
      note_text: parsed.data.noteText,
      certainty: parsed.data.certainty,
      date_qualifier: "not_applicable",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể lưu ghi chú." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, entryId: data.id };
}

export async function updateNote(
  input: UpdateNoteInput,
): Promise<ProvenanceMutationResult> {
  const parsed = updateNoteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("provenance_entries")
    .update({
      note_text: parsed.data.noteText,
      certainty: parsed.data.certainty,
    })
    .eq("id", parsed.data.entryId)
    .eq("entry_kind", "note")
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: "Không thể cập nhật ghi chú." };
  }

  revalidatePath("/admin/tree");
  return { ok: true, entryId: data.id };
}

export async function removeProvenanceEntry(
  input: RemoveProvenanceEntryInput,
): Promise<ProvenanceMutationResult> {
  const parsed = removeProvenanceEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  const { data: existing, error: readError } = await supabase
    .from("provenance_entries")
    .select("id, source_id")
    .eq("id", parsed.data.entryId)
    .single();

  if (readError || !existing) {
    return { ok: false, message: "Không tìm thấy provenance cần xóa." };
  }

  const { data: removed, error: deleteError } = await supabase
    .from("provenance_entries")
    .delete()
    .eq("id", parsed.data.entryId)
    .select("id")
    .single();

  if (deleteError || !removed) {
    return { ok: false, message: "Không thể xóa provenance." };
  }

  if (existing.source_id) {
    const { count } = await supabase
      .from("provenance_entries")
      .select("id", { count: "exact", head: true })
      .eq("source_id", existing.source_id);

    if (count === 0) {
      await supabase
        .from("genealogy_sources")
        .delete()
        .eq("id", existing.source_id);
    }
  }

  revalidatePath("/admin/tree");
  return { ok: true, entryId: removed.id };
}
