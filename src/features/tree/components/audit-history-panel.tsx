"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { type UndoAuditResult } from "@/app/admin/tree/audit-actions";
import { Button } from "@/components/ui/button";
import type { MutationAuditRecord } from "@/features/tree/audit-input";

type AuditHistoryPanelProps = {
  audits: MutationAuditRecord[];
  loadError: string | null;
  undoMutation: (input: { auditId: string }) => Promise<UndoAuditResult>;
};

const COMMAND_LABELS: Record<string, string> = {
  create_person: "Thêm người",
  update_person: "Sửa hồ sơ",
  archive_person: "Lưu trữ người",
  restore_person: "Khôi phục người",
  create_parent_child_relationship: "Thêm cha/mẹ – con",
  create_partnership: "Thêm hôn phối",
  remove_relationship: "Xóa quan hệ",
  create_layout: "Tạo vị trí",
  save_layout: "Sửa vị trí",
  remove_layout: "Xóa vị trí",
  create_provenance_source: "Thêm nguồn",
  update_provenance_source: "Sửa nguồn",
  create_provenance_citation: "Thêm citation",
  update_provenance_citation: "Sửa citation",
  remove_provenance_citation: "Xóa citation",
  merge_person_source_archive: "Merge duplicate",
};

function commandLabel(command: string) {
  if (command.startsWith("undo:")) {
    const original = command.slice("undo:".length);
    return "Hoàn tác · " + (COMMAND_LABELS[original] ?? original);
  }

  return COMMAND_LABELS[command] ?? command;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function canUndo(audit: MutationAuditRecord) {
  return audit.undoable && audit.undoneByAuditId === null;
}

export function AuditHistoryPanel({
  audits,
  loadError,
  undoMutation,
}: AuditHistoryPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingAuditId, setPendingAuditId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleUndo(audit: MutationAuditRecord) {
    const confirmed = window.confirm(
      "Hoàn tác mutation này theo snapshot đã audit? Hệ thống vẫn kiểm tra revision và các ràng buộc hiện tại trước khi ghi.",
    );
    if (!confirmed) return;

    setPendingAuditId(audit.id);
    setMessage(null);
    const result = await undoMutation({ auditId: audit.id });
    setPendingAuditId(null);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setMessage("Đã hoàn tác và ghi một audit entry mới.");
    router.refresh();
  }

  return (
    <div className="relative">
      <Button onClick={() => setOpen((current) => !current)} variant="outline">
        Lịch sử thay đổi
      </Button>

      {open ? (
        <section className="absolute right-0 top-12 z-50 w-[min(92vw,42rem)] rounded-2xl border border-border bg-card p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Audit log
              </p>
              <h2 className="font-display mt-1 text-2xl text-card-foreground">
                Thay đổi gần đây
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Undo chỉ xuất hiện khi database có inverse an toàn. Merge duplicate
                không tự động undo.
              </p>
            </div>
            <Button
              onClick={() => setOpen(false)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Đóng
            </Button>
          </div>

          {loadError ? (
            <p className="mt-3 text-sm text-destructive">{loadError}</p>
          ) : null}
          {message ? (
            <p aria-live="polite" className="mt-3 text-sm text-primary">
              {message}
            </p>
          ) : null}

          <div className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
            {audits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có mutation audit.
              </p>
            ) : (
              audits.map((audit) => (
                <article
                  className="rounded-xl border border-border bg-background p-3"
                  key={audit.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">
                        {commandLabel(audit.command)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {audit.entityTable} · {shortId(audit.entityId)} ·{" "}
                        {formatTimestamp(audit.createdAt)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        revision {audit.beforeRevision ?? "∅"} →{" "}
                        {audit.afterRevision ?? "∅"}
                        {audit.actorUserId
                          ? " · actor " + shortId(audit.actorUserId)
                          : " · actor system"}
                      </p>
                    </div>

                    {canUndo(audit) ? (
                      <Button
                        disabled={pendingAuditId !== null}
                        onClick={() => void handleUndo(audit)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {pendingAuditId === audit.id
                          ? "Đang hoàn tác…"
                          : "Hoàn tác"}
                      </Button>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                        {audit.undoneByAuditId ? "Đã hoàn tác" : "Không auto-undo"}
                      </span>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
