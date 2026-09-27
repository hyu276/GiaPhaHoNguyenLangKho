"use server";

import { revalidatePath } from "next/cache";

import {
  batchVisibilityExecutionInputSchema,
  batchVisibilityPreviewInputSchema,
  buildBatchVisibilityImpact,
  previewGenealogyImport,
  type BatchVisibilityImpact,
  type GenealogyBackup,
} from "@/features/tree/bulk-data";
import { requireAdmin } from "@/lib/auth/admin";

type SupabaseAdminClient = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

export type ExportBackupResult =
  | { ok: true; backup: GenealogyBackup }
  | { ok: false; message: string };

export type ImportPreviewResult =
  | { ok: true; preview: ReturnType<typeof previewGenealogyImport> }
  | { ok: false; message: string };

export type BatchVisibilityPreviewResult =
  | { ok: true; impact: BatchVisibilityImpact }
  | { ok: false; message: string };

export type BatchVisibilityMutationResult =
  | {
      ok: true;
      revisions: Array<{ personId: string; revision: number }>;
    }
  | { ok: false; message: string; kind?: "conflict" };

function mapBackupPerson(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    description:
      typeof row.description === "string" ? row.description : null,
    birthYear: typeof row.birth_year === "number" ? row.birth_year : null,
    deathYear: typeof row.death_year === "number" ? row.death_year : null,
    sex: row.sex === "male" || row.sex === "female" ? row.sex : null,
    visibility: row.visibility === "private" ? "private" : "public",
    archivedAt:
      typeof row.archived_at === "string" ? row.archived_at : null,
    mergedIntoPersonId:
      typeof row.merged_into_person_id === "string"
        ? row.merged_into_person_id
        : null,
    revision: Number(row.revision),
  } as const;
}

function mapBackupRelationship(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    relationshipKind:
      row.relationship_kind === "partnership"
        ? ("partnership" as const)
        : ("parent_child" as const),
    sourcePersonId: String(row.source_person_id),
    targetPersonId: String(row.target_person_id),
    revision: Number(row.revision),
  };
}

function mapBackupLayout(row: Record<string, unknown>) {
  return {
    personId: String(row.person_id),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    revision: Number(row.revision),
  };
}

function mapBackupSource(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    sourceType: row.source_type as GenealogyBackup["sources"][number]["sourceType"],
    repositoryName:
      typeof row.repository_name === "string" ? row.repository_name : null,
    referenceCode:
      typeof row.reference_code === "string" ? row.reference_code : null,
    sourceUrl: typeof row.source_url === "string" ? row.source_url : null,
    revision: Number(row.revision),
  };
}

function mapBackupCitation(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    personId: typeof row.person_id === "string" ? row.person_id : null,
    relationshipId:
      typeof row.relationship_id === "string" ? row.relationship_id : null,
    claimKind: row.claim_kind as GenealogyBackup["citations"][number]["claimKind"],
    claimText: String(row.claim_text),
    citationLocator:
      typeof row.citation_locator === "string" ? row.citation_locator : null,
    note: typeof row.note === "string" ? row.note : null,
    certainty: row.certainty as GenealogyBackup["citations"][number]["certainty"],
    dateText: typeof row.date_text === "string" ? row.date_text : null,
    dateQualifier:
      row.date_qualifier as GenealogyBackup["citations"][number]["dateQualifier"],
    revision: Number(row.revision),
  };
}

async function loadBackupTables(supabase: SupabaseAdminClient) {
  return Promise.all([
    supabase
      .from("people")
      .select(
        "id, display_name, description, birth_year, death_year, sex, visibility, archived_at, merged_into_person_id, revision",
      )
      .order("display_name"),
    supabase
      .from("relationships")
      .select(
        "id, relationship_kind, source_person_id, target_person_id, revision",
      ),
    supabase
      .from("person_layouts")
      .select("person_id, position_x, position_y, revision"),
    supabase
      .from("genealogy_sources")
      .select(
        "id, title, source_type, repository_name, reference_code, source_url, revision",
      ),
    supabase
      .from("genealogy_citations")
      .select(
        "id, source_id, person_id, relationship_id, claim_kind, claim_text, citation_locator, note, certainty, date_text, date_qualifier, revision",
      ),
  ]);
}

export async function exportGenealogyBackup(): Promise<ExportBackupResult> {
  const { supabase } = await requireAdmin();
  const [people, relationships, layouts, sources, citations] =
    await loadBackupTables(supabase);

  if (
    people.error ||
    relationships.error ||
    layouts.error ||
    sources.error ||
    citations.error
  ) {
    return { ok: false, message: "Không thể tạo backup gia phả." };
  }

  return {
    ok: true,
    backup: {
      format: "nguyen-lang-kho-genealogy",
      version: 1,
      exportedAt: new Date().toISOString(),
      people: (people.data ?? []).map((row) =>
        mapBackupPerson(row as Record<string, unknown>),
      ),
      relationships: (relationships.data ?? []).map((row) =>
        mapBackupRelationship(row as Record<string, unknown>),
      ),
      layouts: (layouts.data ?? []).map((row) =>
        mapBackupLayout(row as Record<string, unknown>),
      ),
      sources: (sources.data ?? []).map((row) =>
        mapBackupSource(row as Record<string, unknown>),
      ),
      citations: (citations.data ?? []).map((row) =>
        mapBackupCitation(row as Record<string, unknown>),
      ),
    },
  };
}

function parseJson(text: string) {
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const };
  }
}

export async function previewStructuredImport(
  text: string,
): Promise<ImportPreviewResult> {
  if (text.length > 10_000_000) {
    return { ok: false, message: "File import vượt giới hạn 10 MB." };
  }

  const parsedJson = parseJson(text);
  if (!parsedJson.ok) {
    return { ok: false, message: "JSON import không hợp lệ." };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("people").select("id");
  if (error) {
    return { ok: false, message: "Không thể tải ID hiện có để preview import." };
  }

  const existingIds = new Set(
    (data ?? []).map((row) => String((row as { id: string }).id)),
  );

  return {
    ok: true,
    preview: previewGenealogyImport(parsedJson.value, existingIds),
  };
}

async function loadVisibilityPeople(
  supabase: SupabaseAdminClient,
  personIds: string[],
) {
  const result = await supabase
    .from("people")
    .select("id, display_name, death_year, visibility, revision")
    .in("id", personIds)
    .is("archived_at", null)
    .is("merged_into_person_id", null);

  if (result.error) return null;

  return (result.data ?? []).map((row) => ({
    id: String(row.id),
    displayName: String(row.display_name),
    deathYear: typeof row.death_year === "number" ? row.death_year : null,
    visibility: row.visibility === "private" ? ("private" as const) : ("public" as const),
    revision: Number(row.revision),
  }));
}

export async function previewBatchVisibility(input: unknown) {
  const parsed = batchVisibilityPreviewInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Batch không hợp lệ.",
    };
  }

  const uniqueIds = [...new Set(parsed.data.personIds)];
  if (uniqueIds.length !== parsed.data.personIds.length) {
    return { ok: false as const, message: "Danh sách người chứa ID bị lặp." };
  }

  const { supabase } = await requireAdmin();
  const people = await loadVisibilityPeople(supabase, uniqueIds);
  if (!people || people.length !== uniqueIds.length) {
    return {
      ok: false as const,
      message:
        "Một hoặc nhiều hồ sơ không còn active hoặc không tồn tại. Hãy tải lại dữ liệu.",
    };
  }

  return {
    ok: true as const,
    impact: buildBatchVisibilityImpact(
      people,
      parsed.data.targetVisibility,
    ),
  };
}

export async function executeBatchVisibility(
  input: unknown,
): Promise<BatchVisibilityMutationResult> {
  const parsed = batchVisibilityExecutionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Batch không hợp lệ.",
    };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc(
    "set_people_visibility_if_current",
    { p_changes: parsed.data.changes },
  );

  if (error) {
    if (error.code === "40001" || error.message.includes("stale")) {
      return {
        ok: false,
        kind: "conflict",
        message:
          "Một hồ sơ đã thay đổi sau preview. Batch đã rollback toàn bộ; hãy preview lại.",
      };
    }
    return { ok: false, message: "Không thể cập nhật visibility theo batch." };
  }

  const revisions = Array.isArray(data)
    ? data.map((row) => ({
        personId: String((row as { person_id: string }).person_id),
        revision: Number((row as { revision: number }).revision),
      }))
    : [];

  revalidatePath("/admin/tree");
  return { ok: true, revisions };
}
