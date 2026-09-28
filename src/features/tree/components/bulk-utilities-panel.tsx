/**
 * BULK_UTILITIES_PANEL
 *
 * Purpose: Provides backup, safe file checking, and controlled multi-record visibility changes for administrators.
 * Connections: Bulk server actions, backup export, import validation, and optimistic concurrency.
 * Risk: Medium because batch visibility can update many genealogy records.
 */
"use client";

import { useMemo, useState } from "react";

import {
  batchSetPeopleVisibility,
  exportGenealogyBackup,
  loadBulkPeople,
} from "@/app/admin/tree/bulk-actions";
import { Button } from "@/components/ui/button";
import {
  buildVisibilityImpact,
  type BulkPersonSummary,
  type ImportPreview,
  previewStructuredImport,
} from "@/features/tree/bulk-utils";

function downloadBackup(backup: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    "gia-pha-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ImportPreviewSummary({
  fileName,
  preview,
}: {
  fileName: string | null;
  preview: ImportPreview | null;
}) {
  if (!preview) {
    return (
      <p className="text-xs leading-5 text-muted-foreground">
        Chọn JSON backup để kiểm tra cấu trúc và tham chiếu. Step 10 chỉ
        preview; không có thao tác import ghi dữ liệu.
      </p>
    );
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-background p-4">
      <div>
        <p className="text-sm font-semibold text-card-foreground">
          {fileName ?? "Xem trước dữ liệu nhập"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {preview.counts.people} người · {preview.counts.relationships} quan hệ
          · {preview.counts.layouts} layout · {preview.counts.sources} nguồn ·{" "}
          {preview.counts.citations} citation
        </p>
      </div>

      <p
        className={
          preview.ok
            ? "text-xs font-medium text-primary"
            : "text-xs font-medium text-destructive"
        }
      >
        {preview.ok
          ? "Cấu trúc dữ liệu hợp lệ ở bước kiểm tra trước."
          : "Dữ liệu nhập còn lỗi cần xử lý."}
      </p>

      {preview.errors.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-xs text-destructive">
          {preview.errors.slice(0, 12).map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {preview.warnings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {preview.warnings.slice(0, 12).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function BulkPersonList({
  people,
  selectedIds,
  onToggle,
}: {
  people: BulkPersonSummary[];
  selectedIds: ReadonlySet<string>;
  onToggle: (personId: string) => void;
}) {
  if (people.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Không có hồ sơ đang sử dụng cần xử lý.
      </p>
    );
  }

  return (
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-border bg-background p-3">
      {people.map((person) => (
        <label
          className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-muted/40"
          key={person.id}
        >
          <input
            checked={selectedIds.has(person.id)}
            onChange={() => onToggle(person.id)}
            type="checkbox"
          />
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-sm text-card-foreground">
              {person.displayName}
            </strong>
            <span className="text-xs text-muted-foreground">
              {person.visibility === "public" ? "Công khai" : "Riêng tư"} · phiên bản{" "}
              {person.revision}
            </span>
          </span>
          {person.deathYear === null ? (
            <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
              có thể còn sống
            </span>
          ) : null}
        </label>
      ))}
    </div>
  );
}

function VisibilityImpactSummary({
  impact,
}: {
  impact: ReturnType<typeof buildVisibilityImpact>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl border border-border bg-background p-3">
        <strong className="text-lg">{impact.selectedCount}</strong>
        <p className="text-xs text-muted-foreground">đã chọn</p>
      </div>
      <div className="rounded-xl border border-border bg-background p-3">
        <strong className="text-lg">{impact.changingCount}</strong>
        <p className="text-xs text-muted-foreground">sẽ đổi</p>
      </div>
      <div className="rounded-xl border border-border bg-background p-3">
        <strong className="text-lg">{impact.unchangedCount}</strong>
        <p className="text-xs text-muted-foreground">không đổi</p>
      </div>
      <div className="rounded-xl border border-border bg-background p-3">
        <strong className="text-lg">{impact.livingPublicAfterCount}</strong>
        <p className="text-xs text-muted-foreground">còn sống sẽ công khai</p>
      </div>
    </div>
  );
}

function PanelStatus({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p aria-live="polite" className="text-xs leading-5 text-muted-foreground">
      {message}
    </p>
  );
}

export function BulkUtilitiesPanel() {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<BulkPersonSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [confirmation, setConfirmation] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const impact = useMemo(
    () => buildVisibilityImpact(people, selectedIds, visibility),
    [people, selectedIds, visibility],
  );

  async function refreshPeople() {
    const result = await loadBulkPeople();
    if (!result.ok) {
      setPeople([]);
      setMessage(result.message);
      return false;
    }

    setPeople(result.people);
    setMessage(null);
    return true;
  }

  async function openPanel() {
    setOpen(true);
    setBusy(true);
    await refreshPeople();
    setBusy(false);
  }

  function togglePerson(personId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else if (next.size < 500) next.add(personId);
      return next;
    });
    setConfirmation("");
  }

  function selectVisiblePeople() {
    setSelectedIds(new Set(people.slice(0, 500).map((person) => person.id)));
    setConfirmation("");
  }

  async function exportBackup() {
    setBusy(true);
    const result = await exportGenealogyBackup();
    setBusy(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    downloadBackup(result.backup);
    setMessage("Đã tạo bản sao lưu JSON từ dữ liệu hiện tại.");
  }

  async function previewImportFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setImportFileName(file.name);
    setImportPreview(previewStructuredImport(text));
  }

  async function applyVisibilityBatch() {
    if (confirmation !== "XACNHAN" || impact.changingCount === 0) return;

    const selectedPeople = people.filter(
      (person) =>
        selectedIds.has(person.id) && person.visibility !== visibility,
    );
    setBusy(true);
    const result = await batchSetPeopleVisibility({
      visibility,
      people: selectedPeople.map((person) => ({
        personId: person.id,
        expectedRevision: person.revision,
      })),
    });
    setBusy(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setSelectedIds(new Set());
    setConfirmation("");
    await refreshPeople();
    setMessage(
      "Đã cập nhật " +
        result.revisions.length +
        " hồ sơ và ghi lại từng thay đổi trong lịch sử.",
    );
  }

  return (
    <>
      <Button className="w-full justify-start" onClick={() => void openPanel()} type="button" variant="outline">
        Dữ liệu & sao lưu
      </Button>

      {open ? (
        <div
          aria-label="Dữ liệu và sao lưu"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
        >
          <section className="w-full max-w-5xl rounded-3xl border border-border bg-card p-5 shadow-xl sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Quản lý dữ liệu
                </p>
                <h2 className="font-display mt-1 text-3xl text-card-foreground">
                  Dữ liệu & sao lưu
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Import chỉ preview. Backup chỉ export. Batch visibility cần
                  impact review, optimistic revision và xác nhận thủ công.
                </p>
              </div>
              <Button
                aria-label="Đóng dữ liệu và sao lưu"
                autoFocus
                onClick={() => setOpen(false)}
                type="button"
                variant="ghost"
              >
                Đóng
              </Button>
            </div>

            <div className="mt-6 grid gap-6">
              <section className="grid gap-3 rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-card-foreground">
                      Tạo bản sao lưu
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Xuất people, relationships, layouts, provenance và audit
                      history thành một JSON snapshot.
                    </p>
                  </div>
                  <Button
                    disabled={busy}
                    onClick={() => void exportBackup()}
                    type="button"
                    variant="outline"
                  >
                    Tải backup JSON
                  </Button>
                </div>
              </section>

              <section className="grid gap-3 rounded-2xl border border-border p-4">
                <div>
                  <h3 className="font-semibold text-card-foreground">
                    Structured import preview
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Validate cấu trúc, ID và tham chiếu trước khi một import
                    write workflow được thiết kế ở tương lai.
                  </p>
                </div>
                <label className="text-xs font-medium text-muted-foreground">
                  Backup JSON
                  <input
                    accept=".json,application/json"
                    className="mt-2 block w-full text-sm"
                    onChange={(event) =>
                      void previewImportFile(event.target.files?.[0] ?? null)
                    }
                    type="file"
                  />
                </label>
                <ImportPreviewSummary
                  fileName={importFileName}
                  preview={importPreview}
                />
              </section>

              <section className="grid gap-4 rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-card-foreground">
                      Đổi quyền hiển thị hàng loạt
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tối đa 500 hồ sơ đang sử dụng trong mỗi lần áp dụng.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={busy || people.length === 0}
                      onClick={selectVisiblePeople}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Chọn tối đa 500
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() => void refreshPeople()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Làm mới
                    </Button>
                  </div>
                </div>

                <BulkPersonList
                  onToggle={togglePerson}
                  people={people}
                  selectedIds={selectedIds}
                />

                <label className="text-xs font-medium text-muted-foreground">
                  Quyền hiển thị sau khi áp dụng
                  <select
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                    onChange={(event) => {
                      setVisibility(event.target.value as "public" | "private");
                      setConfirmation("");
                    }}
                    value={visibility}
                  >
                    <option value="private">Riêng tư</option>
                    <option value="public">Công khai</option>
                  </select>
                </label>

                <VisibilityImpactSummary impact={impact} />

                {impact.livingPublicAfterCount > 0 ? (
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
                    Batch này sẽ để {impact.livingPublicAfterCount} hồ sơ được
                    heuristic hiện tại xem là còn sống ở trạng thái public. Hãy
                    review trước khi xác nhận.
                  </p>
                ) : null}

                <label className="text-xs font-medium text-muted-foreground">
                  Nhập XACNHAN để xác nhận
                  <input
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="XACNHAN"
                    value={confirmation}
                  />
                </label>

                <Button
                  disabled={
                    busy ||
                    confirmation !== "XACNHAN" ||
                    impact.changingCount === 0
                  }
                  onClick={() => void applyVisibilityBatch()}
                  type="button"
                >
                  Áp dụng thay đổi
                </Button>
              </section>

              <PanelStatus message={message} />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
