"use client";

import { useState } from "react";

import {
  exportGenealogyBackup,
  previewGenealogyImport,
} from "@/app/admin/tree/bulk-actions";
import { Button } from "@/components/ui/button";
import type { ImportPreview } from "@/features/tree/bulk-utils";

function saveTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function PreviewSummary({ preview }: { preview: ImportPreview }) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-background p-3">
          <strong>{preview.personCount}</strong>
          <p className="text-xs text-muted-foreground">People</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <strong>{preview.relationshipCount}</strong>
          <p className="text-xs text-muted-foreground">Relationships</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <strong>{preview.publicCount}</strong>
          <p className="text-xs text-muted-foreground">Public</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <strong>{preview.privateCount}</strong>
          <p className="text-xs text-muted-foreground">Private</p>
        </div>
      </div>

      {preview.issues.length ? (
        <ul className="grid gap-2">
          {preview.issues.map((issue, index) => (
            <li
              className="rounded-xl border border-border bg-background p-3 text-xs"
              key={issue.code + ":" + index}
            >
              <strong>{issue.severity.toUpperCase()}</strong> · {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Không phát hiện vấn đề cấu trúc trong preview.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Preview-only: không có dữ liệu nào được import vào database.
      </p>
    </div>
  );
}

export function BulkToolsPanel() {
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function previewImport() {
    setLoading(true);
    setStatus(null);
    const result = await previewGenealogyImport(jsonText);
    setLoading(false);

    if (!result.ok) {
      setPreview(null);
      setStatus(result.message);
      return;
    }

    setPreview(result.preview);
  }

  async function exportBackup() {
    setLoading(true);
    setStatus(null);
    const result = await exportGenealogyBackup();
    setLoading(false);

    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    saveTextFile(result.filename, result.json);
    setStatus("Đã tạo backup JSON từ dữ liệu admin hiện tại.");
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        Import / Backup
      </Button>

      {open ? (
        <div
          aria-label="Import preview and backup"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
        >
          <section className="w-full max-w-3xl rounded-3xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Step 10 · Bulk utilities
                </p>
                <h2 className="font-display mt-1 text-3xl">
                  Import preview / backup
                </h2>
              </div>
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="ghost"
              >
                Đóng
              </Button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="text-xs font-medium text-muted-foreground">
                Structured import JSON · schemaVersion 1
                <textarea
                  className="mt-1 min-h-52 w-full rounded-xl border border-input bg-background p-3 font-mono text-xs"
                  onChange={(event) => {
                    setJsonText(event.target.value);
                    setPreview(null);
                  }}
                  placeholder='{"schemaVersion":1,"people":[],"relationships":[]}'
                  value={jsonText}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={loading || jsonText.trim().length === 0}
                  onClick={() => void previewImport()}
                  type="button"
                >
                  Preview import
                </Button>
                <Button
                  disabled={loading}
                  onClick={() => void exportBackup()}
                  type="button"
                  variant="outline"
                >
                  Export backup JSON
                </Button>
              </div>

              {preview ? <PreviewSummary preview={preview} /> : null}
              {status ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {status}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
