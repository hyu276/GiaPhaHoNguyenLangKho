"use server";

import { previewStructuredImport } from "@/features/tree/bulk-utils";
import { requireAdmin } from "@/lib/auth/admin";

export type StructuredImportPreviewResult =
  ReturnType<typeof previewStructuredImport> | { ok: false; message: string };

export type GenealogyBackupResult =
  { ok: true; filename: string; json: string } | { ok: false; message: string };

export async function previewGenealogyImport(
  text: string,
): Promise<StructuredImportPreviewResult> {
  await requireAdmin();
  return previewStructuredImport(text);
}

function backupRows<T>(result: { data: T[] | null }) {
  return result.data || [];
}

function hasBackupError(results: Array<{ error: unknown }>) {
  return results.some((result) => Boolean(result.error));
}

async function loadBackupTables(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
) {
  const [
    people,
    relationships,
    layouts,
    sources,
    citations,
    mutationAudits,
    mergeAudits,
  ] = await Promise.all([
    supabase.from("people").select("*").order("created_at"),
    supabase.from("relationships").select("*").order("created_at"),
    supabase.from("person_layouts").select("*").order("person_id"),
    supabase.from("genealogy_sources").select("*").order("created_at"),
    supabase.from("genealogy_citations").select("*").order("created_at"),
    supabase.from("mutation_audits").select("*").order("created_at"),
    supabase.from("person_merge_audits").select("*").order("created_at"),
  ]);

  const results = [
    people,
    relationships,
    layouts,
    sources,
    citations,
    mutationAudits,
    mergeAudits,
  ];
  if (hasBackupError(results)) return null;

  return {
    people: backupRows(people),
    relationships: backupRows(relationships),
    personLayouts: backupRows(layouts),
    genealogySources: backupRows(sources),
    genealogyCitations: backupRows(citations),
    mutationAudits: backupRows(mutationAudits),
    personMergeAudits: backupRows(mergeAudits),
  };
}

function backupFilename(createdAt: string) {
  const stamp = createdAt.replace(/[:.]/g, "-");
  return "gia-pha-ho-nguyen-lang-kho-backup-" + stamp + ".json";
}

export async function exportGenealogyBackup(): Promise<GenealogyBackupResult> {
  const { supabase } = await requireAdmin();
  const tables = await loadBackupTables(supabase);

  if (!tables) {
    return { ok: false, message: "Không thể tạo bản backup gia phả." };
  }

  const createdAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    createdAt,
    purpose: "genealogy_backup",
    tables,
  };

  return {
    ok: true,
    filename: backupFilename(createdAt),
    json: JSON.stringify(payload, null, 2),
  };
}
