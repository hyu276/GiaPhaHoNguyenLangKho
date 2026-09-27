"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  executeBatchVisibility,
  exportGenealogyBackup,
  previewBatchVisibility,
  previewStructuredImport,
} from "@/app/admin/tree/bulk-actions";
import { Button } from "@/components/ui/button";
import type {
  BatchVisibilityImpact,
  ImportPreview,
} from "@/features/tree/bulk-data";

export type BulkPersonOption = {
  id: string;
  displayName: string;
  deathYear: number | null;
  visibility: "public" | "private";
};

const MAX_IMPORT_BYTES = 10_000_000;
const MAX_VISIBLE_OPTIONS = 250;

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function BackupSection() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function exportBackup() {
    setBusy(true);
    setMessage(null);
    const result = await exportGenealogyBackup();
    setBusy(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const stamp = result.backup.exportedAt.slice(0, 10);
    downloadJson(`gia-pha-ho-nguyen-lang-kho-${stamp}.json`, result.backup);
    setMessage("Đã tạo backup JSON từ dữ liệu hiện tại.");
  }

  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        Export / backup
      </p>
      <h3 className="mt-1 text-lg font-semibold text-card-foreground">
        Backup có version
      </h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Xuất people, relationships, layout, sources và citations thành JSON để
        lưu ngoài hệ thống trước release.
      </p>
      <Button
        className="mt-3"
        disabled={busy}
        onClick={() => void exportBackup()}
        type="button"
        variant="outline"
      >
        {busy ? "Đang tạo backup…" : "Tải backup JSON"}
      </Button>
      {message ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function ImportCounts({ preview }: { preview: ImportPreview }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <div className="rounded-xl bg-muted/40 p-3">
        <dt className="text-muted-foreground">People</dt>
        <dd className="mt-1 font-semibold text-card-foreground">
          {preview.counts.people}
        </dd>
      </div>
      <div className="rounded-xl bg-muted/40 p-3">
        <dt className="text-muted-foreground">Relationships</dt>
        <dd className="mt-1 font-semibold text-card-foreground">
          {preview.counts.relationships}
        </dd>
      </div>
      <div className="rounded-xl bg-muted/40 p-3">
        <dt className="text-muted-foreground">Existing IDs</dt>
        <dd className="mt-1 font-semibold text-card-foreground">
          {preview.counts.existingPeople}
        </dd>
      </div>
      <div className="rounded-xl bg-muted/40 p-3">
        <dt className="text-muted-foreground">New IDs</dt>
        <dd className="mt-1 font-semibold text-card-foreground">
          {preview.counts.newPeople}
        </dd>
      </div>
    </dl>
  );
}

function ImportMessages({ preview }: { preview: ImportPreview }) {
  return (
    <div className="mt-3 grid gap-2">
      {preview.errors.map((message) => (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
          key={message}
        >
          {message}
        </p>
      ))}
      {preview.warnings.map((message) => (
        <p
          className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200"
          key={message}
        >
          {message}
        </p>
      ))}
      {preview.valid ? (
        <p className="rounded-xl bg-primary/10 p-3 text-xs font-medium text-primary">
          Cấu trúc hợp lệ cho review. Step 10 không cung cấp nút thực thi import;
          import thực tế vẫn bị khóa.
        </p>
      ) : null}
    </div>
  );
}

function ImportPreviewSection() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function chooseFile(file: File | null) {
    setPreview(null);
    setMessage(null);
    setRaw(null);
    setFileName(file?.name ?? null);
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      setMessage("File vượt giới hạn 10 MB.");
      return;
    }

    setRaw(await file.text());
  }

  async function runPreview() {
    if (!raw) return;
    setBusy(true);
    setMessage(null);
    const result = await previewStructuredImport(raw);
    setBusy(false);

    if (!result.ok) {
      setPreview(null);
      setMessage(result.message);
      return;
    }

    setPreview(result.preview);
  }

  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        Structured import
      </p>
      <h3 className="mt-1 text-lg font-semibold text-card-foreground">
        Dry-run trước khi nhập
      </h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Chỉ kiểm tra backup JSON: schema, ID trùng, reference hỏng, self-link và
        cycle warning. Không có đường ghi dữ liệu import.
      </p>

      <label className="mt-3 block text-xs font-medium text-foreground">
        Chọn backup JSON
        <input
          accept="application/json,.json"
          className="mt-2 block w-full text-xs"
          onChange={(event) =>
            void chooseFile(event.target.files?.item(0) ?? null)
          }
          type="file"
        />
      </label>

      {fileName ? (
        <p className="mt-2 text-xs text-muted-foreground">{fileName}</p>
      ) : null}

      <Button
        className="mt-3"
        disabled={!raw || busy}
        onClick={() => void runPreview()}
        type="button"
        variant="outline"
      >
        {busy ? "Đang preview…" : "Preview import"}
      </Button>

      {message ? (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {message}
        </p>
      ) : null}

      {preview ? (
        <>
          <ImportCounts preview={preview} />
          <ImportMessages preview={preview} />
        </>
      ) : null}
    </section>
  );
}

function VisibilityImpact({ impact }: { impact: BatchVisibilityImpact }) {
  return (
    <div className="mt-3 grid gap-2">
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-xl bg-muted/40 p-3">
          <strong>{impact.selectedCount}</strong>
          <p className="mt-1 text-muted-foreground">đã chọn</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <strong>{impact.changingCount}</strong>
          <p className="mt-1 text-muted-foreground">sẽ đổi</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <strong>{impact.unchangedCount}</strong>
          <p className="mt-1 text-muted-foreground">không đổi</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <strong>{impact.livingPublicAfterCount}</strong>
          <p className="mt-1 text-muted-foreground">living-public sau batch</p>
        </div>
      </div>

      {impact.privateToPublicCount > 0 ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
          {impact.privateToPublicCount} hồ sơ sẽ chuyển private → public. Hãy
          review living-person exposure trước khi xác nhận.
        </p>
      ) : null}
    </div>
  );
}

function PersonCheckboxList({
  filteredPeople,
  selectedIds,
  onToggle,
}: {
  filteredPeople: BulkPersonOption[];
  selectedIds: ReadonlySet<string>;
  onToggle: (personId: string) => void;
}) {
  const visible = filteredPeople.slice(0, MAX_VISIBLE_OPTIONS);

  return (
    <div
      aria-label="Danh sách hồ sơ cho batch visibility"
      className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-border"
      role="group"
    >
      {visible.map((person) => (
        <label
          className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
          key={person.id}
        >
          <input
            checked={selectedIds.has(person.id)}
            onChange={() => onToggle(person.id)}
            type="checkbox"
          />
          <span className="min-w-0 flex-1 truncate">{person.displayName}</span>
          <span className="text-xs text-muted-foreground">
            {person.visibility === "public" ? "Public" : "Private"}
          </span>
        </label>
      ))}
      {filteredPeople.length > MAX_VISIBLE_OPTIONS ? (
        <p className="p-3 text-xs text-muted-foreground">
          Đang hiển thị {MAX_VISIBLE_OPTIONS}/{filteredPeople.length}. Thu hẹp
          tìm kiếm để chọn các hồ sơ còn lại.
        </p>
      ) : null}
    </div>
  );
}

function BatchVisibilitySection({ people }: { people: BulkPersonOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetVisibility, setTargetVisibility] = useState<
    "public" | "private"
  >("private");
  const [impact, setImpact] = useState<BatchVisibilityImpact | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi-VN");
    if (!normalized) return people;
    return people.filter((person) =>
      person.displayName.toLocaleLowerCase("vi-VN").includes(normalized),
    );
  }, [people, query]);

  function togglePerson(personId: string) {
    setImpact(null);
    setConfirmation("");
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  async function runPreview() {
    setBusy(true);
    setMessage(null);
    setImpact(null);
    setConfirmation("");

    const result = await previewBatchVisibility({
      personIds: [...selectedIds],
      targetVisibility,
    });
    setBusy(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setImpact(result.impact);
  }

  async function execute() {
    if (!impact || confirmation !== "APPLY") return;
    if (impact.changes.length === 0) return;

    setBusy(true);
    setMessage(null);
    const result = await executeBatchVisibility({
      changes: impact.changes.map((change) => ({
        personId: change.personId,
        expectedRevision: change.expectedRevision,
        targetVisibility: change.toVisibility,
      })),
    });
    setBusy(false);

    if (!result.ok) {
      setMessage(result.message);
      if (result.kind === "conflict") {
        setImpact(null);
        setConfirmation("");
      }
      return;
    }

    setMessage(`Đã cập nhật ${result.revisions.length} hồ sơ.`);
    setImpact(null);
    setConfirmation("");
    setSelectedIds(new Set());
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        Batch visibility
      </p>
      <h3 className="mt-1 text-lg font-semibold text-card-foreground">
        Impact review trước khi ghi
      </h3>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_12rem]">
        <label className="text-xs font-medium text-foreground">
          Tìm người
          <input
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nhập tên…"
            value={query}
          />
        </label>
        <label className="text-xs font-medium text-foreground">
          Visibility đích
          <select
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3"
            onChange={(event) => {
              setTargetVisibility(event.target.value as "public" | "private");
              setImpact(null);
              setConfirmation("");
            }}
            value={targetVisibility}
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>
      </div>

      <PersonCheckboxList
        filteredPeople={filteredPeople}
        onToggle={togglePerson}
        selectedIds={selectedIds}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setSelectedIds(
              new Set(
                filteredPeople
                  .slice(0, MAX_VISIBLE_OPTIONS)
                  .map((person) => person.id),
              ),
            );
            setImpact(null);
          }}
          type="button"
          variant="ghost"
        >
          Chọn các mục đang hiển thị
        </Button>
        <Button
          onClick={() => {
            setSelectedIds(new Set());
            setImpact(null);
          }}
          type="button"
          variant="ghost"
        >
          Bỏ chọn
        </Button>
        <Button
          disabled={selectedIds.size === 0 || busy}
          onClick={() => void runPreview()}
          type="button"
          variant="outline"
        >
          Preview impact ({selectedIds.size})
        </Button>
      </div>

      {impact ? <VisibilityImpact impact={impact} /> : null}

      {impact && impact.changingCount > 0 ? (
        <div className="mt-3 grid gap-2">
          <label className="text-xs font-medium text-foreground">
            Nhập chính xác APPLY để xác nhận batch
            <input
              autoComplete="off"
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3"
              onChange={(event) => setConfirmation(event.target.value)}
              value={confirmation}
            />
          </label>
          <Button
            disabled={busy || confirmation !== "APPLY"}
            onClick={() => void execute()}
            type="button"
          >
            Thực thi batch visibility
          </Button>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

export function BulkToolsPanel({ people }: { people: BulkPersonOption[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        Bulk & backup
      </Button>

      {open ? (
        <div
          aria-label="Bulk utilities and backup"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
        >
          <div
            className="mx-auto w-full max-w-5xl rounded-3xl border border-border bg-card p-5 shadow-xl outline-none sm:p-6"
            ref={panelRef}
            tabIndex={-1}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Step 10
                </p>
                <h2 className="font-display mt-1 text-3xl text-card-foreground">
                  Bulk utilities & release prep
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Backup, import dry-run và batch visibility có impact review.
                  Không có bulk import execution.
                </p>
              </div>
              <Button
                autoFocus
                onClick={() => setOpen(false)}
                type="button"
                variant="ghost"
              >
                Đóng
              </Button>
            </div>

            <div className="mt-5 grid gap-4">
              <BackupSection />
              <ImportPreviewSection />
              <BatchVisibilitySection people={people} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
