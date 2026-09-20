"use server";

import { revalidatePath } from "next/cache";

import {
  createProvenanceCitationInputSchema,
  type CreateProvenanceCitationInput,
  createProvenanceSourceInputSchema,
  type CreateProvenanceSourceInput,
  type ProvenanceCitationRecord,
  provenanceTargetInputSchema,
  type ProvenanceSourceRecord,
  type ProvenanceTargetInput,
  removeProvenanceCitationInputSchema,
  type RemoveProvenanceCitationInput,
  updateProvenanceCitationInputSchema,
  type UpdateProvenanceCitationInput,
  updateProvenanceSourceInputSchema,
  type UpdateProvenanceSourceInput,
} from "@/features/tree/provenance-input";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProvenanceSourceMutationResult =
  { ok: true; sourceId: string } | { ok: false; message: string };

export type ProvenanceCitationMutationResult =
  { ok: true; citationId: string } | { ok: false; message: string };

export type ProvenanceLoadResult =
  | {
      ok: true;
      sources: ProvenanceSourceRecord[];
      citations: ProvenanceCitationRecord[];
    }
  | { ok: false; message: string };

type ViewerRole = "admin" | "spectator";

type SourceRow = {
  id: string;
  title: string;
  source_type: ProvenanceSourceRecord["sourceType"];
  repository_name: string | null;
  reference_code: string | null;
  source_url: string | null;
};

type CitationRow = {
  id: string;
  source_id: string;
  person_id: string | null;
  relationship_id: string | null;
  claim_kind: ProvenanceCitationRecord["claimKind"];
  claim_text: string;
  citation_locator: string | null;
  note: string | null;
  certainty: ProvenanceCitationRecord["certainty"];
  date_text: string | null;
  date_qualifier: ProvenanceCitationRecord["dateQualifier"];
};

function getValidationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Dữ liệu provenance không hợp lệ.";
}

function mapSource(row: SourceRow): ProvenanceSourceRecord {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    repositoryName: row.repository_name,
    referenceCode: row.reference_code,
    sourceUrl: row.source_url,
  };
}

function mapCitation(row: CitationRow): ProvenanceCitationRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    personId: row.person_id,
    relationshipId: row.relationship_id,
    claimKind: row.claim_kind,
    claimText: row.claim_text,
    citationLocator: row.citation_locator,
    note: row.note,
    certainty: row.certainty,
    dateText: row.date_text,
    dateQualifier: row.date_qualifier,
  };
}

async function getProvenanceViewer() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const role = user.app_metadata.role;
  if (role !== "admin" && role !== "spectator") return null;

  return { supabase, role: role as ViewerRole };
}

export async function loadProvenance(
  input: ProvenanceTargetInput,
): Promise<ProvenanceLoadResult> {
  const parsed = provenanceTargetInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: getValidationMessage(parsed.error) };
  }

  const viewer = await getProvenanceViewer();
  if (!viewer) {
    return { ok: false, message: "Không có quyền xem provenance." };
  }

  let citationQuery = viewer.supabase
    .from("genealogy_citations")
    .select(
      "id, source_id, person_id, relationship_id, claim_kind, claim_text, citation_locator, note, certainty, date_text, date_qualifier",
    );

  citationQuery =
    parsed.data.personId !== null
      ? citationQuery.eq("person_id", parsed.data.personId)
      : citationQuery.eq("relationship_id", parsed.data.relationshipId);

  const citationResult = await citationQuery.order("created_at", {
    ascending: false,
  });

  if (citationResult.error) {
    return { ok: false, message: "Không thể tải citation." };
  }

  const citationRows = (citationResult.data ?? []) as CitationRow[];
  const sourceIds = [...new Set(citationRows.map((row) => row.source_id))];

  let sourceQuery = viewer.supabase
    .from("genealogy_sources")
    .select(
      "id, title, source_type, repository_name, reference_code, source_url",
    );

  if (viewer.role === "spectator") {
    if (sourceIds.length === 0) {
      return {
        ok: true,
        sources: [],
        citations: citationRows.map(mapCitation),
      };
    }
    sourceQuery = sourceQuery.in("id", sourceIds);
  }

  const sourceResult = await sourceQuery.order("title");
  if (sourceResult.error) {
    return { ok: false, message: "Không thể tải nguồn tư liệu." };
  }

  return {
    ok: true,
    sources: ((sourceResult.data ?? []) as SourceRow[]).map(mapSource),
    citations: citationRows.map(mapCitation),
  };
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
