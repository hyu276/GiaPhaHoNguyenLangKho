import { z } from "zod";

export const mutableEntityTableSchema = z.enum([
  "people",
  "relationships",
  "person_layouts",
  "genealogy_sources",
  "genealogy_citations",
]);

export const mutationOperationSchema = z.enum(["INSERT", "UPDATE", "DELETE"]);

export const revisionSchema = z.number().int().min(1);

export const undoMutationInputSchema = z.object({
  auditId: z.string().uuid(),
});

export const recentAuditQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(30),
});

export type MutableEntityTable = z.infer<typeof mutableEntityTableSchema>;
export type MutationOperation = z.infer<typeof mutationOperationSchema>;
export type UndoMutationInput = z.input<typeof undoMutationInputSchema>;
export type RecentAuditQuery = z.input<typeof recentAuditQuerySchema>;

export type MutationAuditRecord = {
  id: string;
  actorUserId: string | null;
  command: string;
  entityTable: MutableEntityTable;
  entityId: string;
  operation: MutationOperation;
  beforeRevision: number | null;
  afterRevision: number | null;
  undoable: boolean;
  undoOfAuditId: string | null;
  undoneByAuditId: string | null;
  createdAt: string;
};

export type ConcurrencyConflict = {
  kind: "conflict";
  message: string;
};

export function conflictMessage(entityLabel: string) {
  return (
    entityLabel +
    " đã được thay đổi bởi một phiên quản trị khác. Hãy tải lại dữ liệu mới trước khi thử lại."
  );
}
