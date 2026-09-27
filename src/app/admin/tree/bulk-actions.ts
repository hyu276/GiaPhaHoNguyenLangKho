"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type BulkPersonSummary,
  bulkVisibilitySchema,
} from "@/features/tree/bulk-utils";
import { requireAdmin } from "@/lib/auth/admin";

const batchVisibilityInputSchema = z.object({
  visibility: bulkVisibilitySchema,
  people: z
    .array(
      z.object({
        personId: z.string().uuid(),
        expectedRevision: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(500),
});

export type BulkPeopleLoadResult =
  { ok: true; people: BulkPersonSummary[] } | { ok: false; message: string };

export type BatchVisibilityResult =
  | {
      ok: true;
      revisions: Array<{ personId: string; revision: number }>;
    }
  | { ok: false; message: string; kind?: "conflict" };

export type BackupExportResult =
  | { ok: true; backup: Record<string, unknown> }
  | { ok: false; message: string };

type AdminContext = Awaited<ReturnType<typeof requireAdmin>>;
type SupabaseAdminClient = AdminContext["supabase"];

type BulkPersonRow = {
  id: string;
  display_name: string;
  visibility: BulkPersonSummary["visibility"];
  death_year: number | null;
  revision: number;
};

function mapBulkPerson(row: BulkPersonRow): BulkPersonSummary {
  return {
    id: row.id,
    displayName: row.display_name,
    visibility: row.visibility,
    deathYear: row.death_year,
    revision: row.revision,
  };
}

export async function loadBulkPeople(): Promise<BulkPeopleLoadResult> {
  const { supabase } = await requireAdmin();
  const result = await supabase
    .from("people")
    .select("id, display_name, visibility, death_year, revision")
    .is("archived_at", null)
    .is("merged_into_person_id", null)
    .order("display_name");

  if (result.error) {
    return { ok: false, message: "Không thể tải danh sách batch." };
  }

  return {
    ok: true,
    people: (result.data ?? []).map((row) =>
      mapBulkPerson(row as BulkPersonRow),
    ),
  };
}

async function exportTable(
  supabase: SupabaseAdminClient,
  table:
    | "people"
    | "relationships"
    | "person_layouts"
    | "genealogy_sources"
    | "genealogy_citations"
    | "person_merge_audits"
    | "mutation_audits",
) {
  const result = await supabase.from(table).select("*");
  if (result.error) return null;
  return result.data ?? [];
}

export async function exportGenealogyBackup(): Promise<BackupExportResult> {
  const { supabase } = await requireAdmin();
  const exportedTables = await Promise.all([
    exportTable(supabase, "people"),
    exportTable(supabase, "relationships"),
    exportTable(supabase, "person_layouts"),
    exportTable(supabase, "genealogy_sources"),
    exportTable(supabase, "genealogy_citations"),
    exportTable(supabase, "person_merge_audits"),
    exportTable(supabase, "mutation_audits"),
  ]);

  if (exportedTables.some((rows) => rows === null)) {
    return { ok: false, message: "Không thể tạo backup đầy đủ." };
  }

  const [
    people,
    relationships,
    personLayouts,
    genealogySources,
    genealogyCitations,
    personMergeAudits,
    mutationAudits,
  ] = exportedTables as unknown[][];

  return {
    ok: true,
    backup: {
      version: 1,
      exportedAt: new Date().toISOString(),
      people,
      relationships,
      person_layouts: personLayouts,
      genealogy_sources: genealogySources,
      genealogy_citations: genealogyCitations,
      person_merge_audits: personMergeAudits,
      mutation_audits: mutationAudits,
    },
  };
}

function batchFailure(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  if (error?.code === "40001" || message.includes("stale person revision")) {
    return {
      ok: false as const,
      kind: "conflict" as const,
      message:
        "Ít nhất một hồ sơ đã thay đổi sau khi batch được review. Hãy tải lại danh sách và review impact trước khi thử lại.",
    };
  }

  return {
    ok: false as const,
    message:
      "Không thể áp dụng batch visibility. Transaction đã được rollback.",
  };
}

const revisionRowsSchema = z.array(
  z.object({
    person_id: z.string().uuid(),
    revision: z.number().int().min(1),
  }),
);

export async function batchSetPeopleVisibility(
  input: z.input<typeof batchVisibilityInputSchema>,
): Promise<BatchVisibilityResult> {
  const parsed = batchVisibilityInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Batch visibility không hợp lệ." };
  }

  const uniqueIds = new Set(parsed.data.people.map((item) => item.personId));
  if (uniqueIds.size !== parsed.data.people.length) {
    return { ok: false, message: "Batch chứa hồ sơ bị lặp." };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc(
    "batch_set_people_visibility_if_current",
    {
      p_items: parsed.data.people,
      p_visibility: parsed.data.visibility,
    },
  );

  if (error) return batchFailure(error);

  const rows = revisionRowsSchema.safeParse(data);
  if (!rows.success) {
    return { ok: false, message: "Không thể đọc kết quả batch visibility." };
  }

  revalidatePath("/admin/tree");
  return {
    ok: true,
    revisions: rows.data.map((row) => ({
      personId: row.person_id,
      revision: row.revision,
    })),
  };
}
