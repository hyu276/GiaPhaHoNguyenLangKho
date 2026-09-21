"use server";

import { revalidatePath } from "next/cache";

import {
  type MutationAuditRecord,
  recentAuditQuerySchema,
  type RecentAuditQuery,
  undoMutationInputSchema,
  type UndoMutationInput,
} from "@/features/tree/audit-input";
import { requireAdmin } from "@/lib/auth/admin";

type AuditRow = {
  id: string;
  actor_user_id: string | null;
  command: string;
  entity_table: MutationAuditRecord["entityTable"];
  entity_id: string;
  operation: MutationAuditRecord["operation"];
  before_revision: number | null;
  after_revision: number | null;
  undoable: boolean;
  undo_of_audit_id: string | null;
  undone_by_audit_id: string | null;
  created_at: string;
};

export type AuditLoadResult =
  { ok: true; audits: MutationAuditRecord[] } | { ok: false; message: string };

export type UndoAuditResult =
  | { ok: true; undoAuditId: string }
  | { ok: false; message: string; kind?: "conflict" };

function mapAudit(row: AuditRow): MutationAuditRecord {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    command: row.command,
    entityTable: row.entity_table,
    entityId: row.entity_id,
    operation: row.operation,
    beforeRevision: row.before_revision,
    afterRevision: row.after_revision,
    undoable: row.undoable,
    undoOfAuditId: row.undo_of_audit_id,
    undoneByAuditId: row.undone_by_audit_id,
    createdAt: row.created_at,
  };
}

export async function loadRecentMutationAudits(
  input: RecentAuditQuery = { limit: 30 },
): Promise<AuditLoadResult> {
  const parsed = recentAuditQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Yêu cầu audit log không hợp lệ." };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("mutation_audits")
    .select(
      "id, actor_user_id, command, entity_table, entity_id, operation, before_revision, after_revision, undoable, undo_of_audit_id, undone_by_audit_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (error) {
    return { ok: false, message: "Không thể tải lịch sử thay đổi." };
  }

  return { ok: true, audits: ((data ?? []) as AuditRow[]).map(mapAudit) };
}

export async function undoMutationAudit(
  input: UndoMutationInput,
): Promise<UndoAuditResult> {
  const parsed = undoMutationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Audit ID không hợp lệ." };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("undo_genealogy_mutation", {
    p_audit_id: parsed.data.auditId,
  });

  if (error || typeof data !== "string") {
    const message = error?.message ?? "";
    if (
      error?.code === "40001" ||
      message.includes("stale revision") ||
      message.includes("changed after audited mutation")
    ) {
      return {
        ok: false,
        kind: "conflict",
        message:
          "Không thể hoàn tác vì dữ liệu đã thay đổi sau mutation này. Hãy tải lại audit log và review trạng thái mới.",
      };
    }

    return {
      ok: false,
      message:
        "Mutation này không còn có thể hoàn tác an toàn hoặc dữ liệu hiện tại không thỏa các ràng buộc gia phả.",
    };
  }

  revalidatePath("/admin/tree");
  return { ok: true, undoAuditId: data };
}
