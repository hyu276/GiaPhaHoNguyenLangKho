/**
 * PROVENANCE_PANEL
 *
 * Purpose: Manages reusable genealogy sources and evidence records with family-friendly Vietnamese terminology.
 * Connections: Provenance actions, selected people, selected relationships, and optimistic concurrency handling.
 * Risk: Medium because edits persist source and evidence records.
 */
"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  createProvenanceCitation,
  createProvenanceSource,
  loadProvenance,
  removeProvenanceCitation,
  updateProvenanceCitation,
  updateProvenanceSource,
} from "@/app/admin/tree/provenance-actions";
import { Button } from "@/components/ui/button";
import type {
  ProvenanceCitationRecord,
  ProvenanceClaimKind,
  ProvenanceCertainty,
  ProvenanceDateQualifier,
  ProvenanceSourceRecord,
  ProvenanceSourceType,
} from "@/features/tree/provenance-input";

type ProvenancePanelProps = {
  personId: string | null;
  relationshipId: string | null;
  readOnly: boolean;
};

type EditorState =
  | { kind: "source"; source: ProvenanceSourceRecord | null }
  | { kind: "dẫn chứng"; dẫn chứng: ProvenanceCitationRecord | null }
  | null;

type LoadedProvenance = {
  key: string;
  sources: ProvenanceSourceRecord[];
  dẫn chứngs: ProvenanceCitationRecord[];
  error: string | null;
};

type SourceFormDefaults = {
  title: string;
  sourceType: ProvenanceSourceType;
  repositoryName: string;
  referenceCode: string;
  sourceUrl: string;
  heading: string;
  helpText: string | null;
};

type CitationFormDefaults = {
  sourceId: string;
  claimKind: ProvenanceClaimKind;
  claimText: string;
  dẫn chứngLocator: string;
  certainty: ProvenanceCertainty;
  dateQualifier: string;
  dateText: string;
  note: string;
  heading: string;
};

const SOURCE_TYPE_LABELS: Record<ProvenanceSourceType, string> = {
  family_book: "Gia phả / tộc phả",
  civil_record: "Hộ tịch",
  archive: "Lưu trữ",
  oral_history: "Khẩu thuật",
  photo: "Ảnh / hiện vật",
  publication: "Ấn phẩm",
  web: "Nguồn web",
  other: "Khác",
};

const CLAIM_KIND_LABELS: Record<ProvenanceClaimKind, string> = {
  identity: "Nhân thân",
  birth: "Sinh",
  death: "Mất",
  relationship: "Quan hệ",
  residence: "Cư trú",
  occupation: "Nghề nghiệp",
  note: "Ghi chú",
  other: "Khác",
};

const CERTAINTY_LABELS: Record<ProvenanceCertainty, string> = {
  certain: "Chắc chắn",
  probable: "Có khả năng cao",
  possible: "Có thể",
  unknown: "Chưa rõ",
};

const DATE_QUALIFIER_LABELS: Record<ProvenanceDateQualifier, string> = {
  exact: "Chính xác",
  about: "Khoảng",
  before: "Trước",
  after: "Sau",
  range: "Khoảng thời gian",
  unknown: "Không rõ",
};

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function nullableFormText(formData: FormData, name: string) {
  const value = formText(formData, name).trim();
  return value.length > 0 ? value : null;
}

function getSourceSecondaryText(source: ProvenanceSourceRecord) {
  return [source.repositoryName, source.referenceCode]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function getSourceFormDefaults(
  source: ProvenanceSourceRecord | null,
): SourceFormDefaults {
  if (source) {
    return {
      title: source.title,
      sourceType: source.sourceType,
      repositoryName: source.repositoryName ?? "",
      referenceCode: source.referenceCode ?? "",
      sourceUrl: source.sourceUrl ?? "",
      heading: "Sửa nguồn tư liệu",
      helpText:
        "Một nguồn tư liệu có thể được dùng cho nhiều dẫn chứng; khi sửa thông tin nguồn, mọi dẫn chứng liên quan sẽ dùng thông tin mới.",
    };
  }

  return {
    title: "",
    sourceType: "family_book",
    repositoryName: "",
    referenceCode: "",
    sourceUrl: "",
    heading: "Thêm nguồn tư liệu",
    helpText: null,
  };
}

function textOrEmpty(value: string | null) {
  return value || "";
}

function getFirstSourceId(sources: ProvenanceSourceRecord[]) {
  const firstSource = sources[0];
  return firstSource ? firstSource.id : "";
}

function getCitationFormDefaults(
  dẫn chứng: ProvenanceCitationRecord | null,
  sources: ProvenanceSourceRecord[],
): CitationFormDefaults {
  if (dẫn chứng) {
    return {
      sourceId: dẫn chứng.sourceId,
      claimKind: dẫn chứng.claimKind,
      claimText: dẫn chứng.claimText,
      dẫn chứngLocator: textOrEmpty(dẫn chứng.dẫn chứngLocator),
      certainty: dẫn chứng.certainty,
      dateQualifier: textOrEmpty(dẫn chứng.dateQualifier),
      dateText: textOrEmpty(dẫn chứng.dateText),
      note: textOrEmpty(dẫn chứng.note),
      heading: "Sửa dẫn chứng",
    };
  }

  const firstSourceId = getFirstSourceId(sources);
  return {
    sourceId: firstSourceId,
    claimKind: "note",
    claimText: "",
    dẫn chứngLocator: "",
    certainty: "unknown",
    dateQualifier: "",
    dateText: "",
    note: "",
    heading: "Thêm dẫn chứng",
  };
}

function SourceLink({ sourceUrl }: { sourceUrl: string | null }) {
  if (!sourceUrl) return null;

  return (
    <a
      className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
      href={sourceUrl}
      rel="noreferrer"
      target="_blank"
    >
      Mở nguồn
    </a>
  );
}

function SourceEditButton({
  onEdit,
  readOnly,
  source,
}: {
  onEdit: (source: ProvenanceSourceRecord) => void;
  readOnly: boolean;
  source: ProvenanceSourceRecord;
}) {
  if (readOnly) return null;

  return (
    <Button
      onClick={() => onEdit(source)}
      size="sm"
      type="button"
      variant="ghost"
    >
      Sửa nguồn
    </Button>
  );
}

function SourceSummary({
  onEdit,
  readOnly,
  source,
}: {
  onEdit: (source: ProvenanceSourceRecord) => void;
  readOnly: boolean;
  source: ProvenanceSourceRecord;
}) {
  const secondary = getSourceSecondaryText(source);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-card-foreground">
            {source.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {SOURCE_TYPE_LABELS[source.sourceType]}
            {secondary ? ` · ${secondary}` : ""}
          </p>
        </div>
        <SourceEditButton onEdit={onEdit} readOnly={readOnly} source={source} />
      </div>
      <SourceLink sourceUrl={source.sourceUrl} />
    </div>
  );
}

function CitationDate({ dẫn chứng }: { dẫn chứng: ProvenanceCitationRecord }) {
  if (!dẫn chứng.dateText || !dẫn chứng.dateQualifier) return null;

  return (
    <p className="mt-2 text-xs font-medium text-muted-foreground">
      Ngày ghi nhận: {DATE_QUALIFIER_LABELS[dẫn chứng.dateQualifier]}:{" "}
      {dẫn chứng.dateText}
    </p>
  );
}

function CitationLocator({
  dẫn chứngLocator,
}: {
  dẫn chứngLocator: string | null;
}) {
  if (!dẫn chứngLocator) return null;
  return <p className="mt-1">Vị trí trích dẫn: {dẫn chứngLocator}</p>;
}

function CitationNote({ note }: { note: string | null }) {
  if (!note) return null;

  return (
    <p className="mt-2 whitespace-pre-wrap leading-5">
      Ghi chú nghiên cứu: {note}
    </p>
  );
}

function CitationActions({
  dẫn chứng,
  onEdit,
  onRemove,
  readOnly,
}: {
  dẫn chứng: ProvenanceCitationRecord;
  onEdit: (dẫn chứng: ProvenanceCitationRecord) => void;
  onRemove: (dẫn chứngId: string) => void;
  readOnly: boolean;
}) {
  if (readOnly) return null;

  return (
    <div className="mt-3 flex gap-2">
      <Button
        onClick={() => onEdit(dẫn chứng)}
        size="sm"
        type="button"
        variant="outline"
      >
        Sửa dẫn chứng
      </Button>
      <Button
        onClick={() => onRemove(dẫn chứng.id)}
        size="sm"
        type="button"
        variant="ghost"
      >
        Xóa dẫn chứng
      </Button>
    </div>
  );
}

function CitationCard({
  dẫn chứng,
  onEdit,
  onRemove,
  readOnly,
  source,
}: {
  dẫn chứng: ProvenanceCitationRecord;
  onEdit: (dẫn chứng: ProvenanceCitationRecord) => void;
  onRemove: (dẫn chứngId: string) => void;
  readOnly: boolean;
  source: ProvenanceSourceRecord | undefined;
}) {
  const sourceTitle = source ? source.title : "Nguồn không khả dụng";

  return (
    <article className="rounded-2xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
        <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
          {CLAIM_KIND_LABELS[dẫn chứng.claimKind]}
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
          {CERTAINTY_LABELS[dẫn chứng.certainty]}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-card-foreground">
        {dẫn chứng.claimText}
      </p>

      <CitationDate dẫn chứng={dẫn chứng} />

      <div className="mt-3 rounded-xl bg-muted/35 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-card-foreground">{sourceTitle}</p>
        <CitationLocator dẫn chứngLocator={dẫn chứng.dẫn chứngLocator} />
        <CitationNote note={dẫn chứng.note} />
      </div>

      <CitationActions
        dẫn chứng={dẫn chứng}
        onEdit={onEdit}
        onRemove={onRemove}
        readOnly={readOnly}
      />
    </article>
  );
}

function SourceFormHelp({ helpText }: { helpText: string | null }) {
  if (!helpText) return null;
  return (
    <p className="mt-1 text-xs leading-5 text-muted-foreground">{helpText}</p>
  );
}

function SourceForm({
  saving,
  source,
  onCancel,
  onSubmit,
}: {
  saving: boolean;
  source: ProvenanceSourceRecord | null;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const defaults = getSourceFormDefaults(source);

  return (
    <form
      className="mt-3 rounded-2xl border border-border bg-muted/20 p-3"
      key={source ? source.id : "new-source"}
      onSubmit={onSubmit}
    >
      <p className="text-sm font-semibold text-card-foreground">
        {defaults.heading}
      </p>
      <SourceFormHelp helpText={defaults.helpText} />

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Tên nguồn
        <input
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.title}
          maxLength={200}
          name="title"
          required
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Loại nguồn
        <select
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.sourceType}
          name="sourceType"
        >
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Nơi lưu trữ / cơ quan
        <input
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.repositoryName}
          maxLength={200}
          name="repositoryName"
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Mã hồ sơ / ký hiệu
        <input
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.referenceCode}
          maxLength={200}
          name="referenceCode"
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        URL nguồn
        <input
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.sourceUrl}
          maxLength={2048}
          name="sourceUrl"
          placeholder="https://..."
          type="url"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <Button disabled={saving} size="sm" type="submit">
          {saving ? "Đang lưu…" : "Lưu nguồn"}
        </Button>
        <Button
          disabled={saving}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}

function CitationForm({
  dẫn chứng,
  saving,
  sources,
  onCancel,
  onSubmit,
}: {
  dẫn chứng: ProvenanceCitationRecord | null;
  saving: boolean;
  sources: ProvenanceSourceRecord[];
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const defaults = getCitationFormDefaults(dẫn chứng, sources);

  return (
    <form
      className="mt-3 rounded-2xl border border-border bg-muted/20 p-3"
      key={dẫn chứng ? dẫn chứng.id : "new-dẫn chứng"}
      onSubmit={onSubmit}
    >
      <p className="text-sm font-semibold text-card-foreground">
        {defaults.heading}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Thông tin chưa chắc chắn hoặc mâu thuẫn được lưu riêng tại đây; biểu mẫu này không tự sửa năm sinh, năm mất hay quan hệ chính.
      </p>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Nguồn tư liệu
        <select
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.sourceId}
          name="sourceId"
          required
        >
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.title}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Loại thông tin
        <select
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.claimKind}
          name="claimKind"
        >
          {Object.entries(CLAIM_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Nội dung dẫn chứng
        <textarea
          className="mt-1 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.claimText}
          maxLength={2000}
          name="claimText"
          required
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Vị trí trích dẫn
        <input
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.dẫn chứngLocator}
          maxLength={240}
          name="dẫn chứngLocator"
          placeholder="Trang, folio, mục, số hồ sơ…"
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Mức độ chắc chắn
        <select
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.certainty}
          name="certainty"
        >
          {Object.entries(CERTAINTY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Dạng ngày
          <select
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
            defaultValue={defaults.dateQualifier}
            name="dateQualifier"
          >
            <option value="">Không gắn ngày</option>
            {Object.entries(DATE_QUALIFIER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Biểu thức ngày
          <input
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
            defaultValue={defaults.dateText}
            maxLength={80}
            name="dateText"
            placeholder="VD: khoảng 1900–1905"
          />
        </label>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
        Nếu dùng ngày ước lượng, hãy nhập cả dạng ngày và biểu thức; hệ thống
        không chuyển chúng thành năm chính xác.
      </p>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Ghi chú nghiên cứu
        <textarea
          className="mt-1 min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={defaults.note}
          maxLength={2000}
          name="note"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <Button
          disabled={saving || sources.length === 0}
          size="sm"
          type="submit"
        >
          {saving ? "Đang lưu…" : "Lưu dẫn chứng"}
        </Button>
        <Button
          disabled={saving}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}

function ProvenanceToolbar({
  onAddCitation,
  onAddSource,
  readOnly,
  sourceCount,
}: {
  onAddCitation: () => void;
  onAddSource: () => void;
  readOnly: boolean;
  sourceCount: number;
}) {
  if (readOnly) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button onClick={onAddSource} size="sm" type="button" variant="outline">
        + Nguồn
      </Button>
      <Button
        disabled={sourceCount === 0}
        onClick={onAddCitation}
        size="sm"
        type="button"
        variant="outline"
      >
        + Dẫn chứng
      </Button>
    </div>
  );
}

function LoadingMessage({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      Đang tải nguồn tư liệu…
    </p>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mt-3 text-xs text-destructive">{message}</p>;
}

function StatusMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p aria-live="polite" className="mt-3 text-xs text-primary">
      {message}
    </p>
  );
}

function ProvenanceEditor({
  editor,
  onCancel,
  onCitationSubmit,
  onSourceSubmit,
  saving,
  sources,
}: {
  editor: EditorState;
  onCancel: () => void;
  onCitationSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSourceSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  sources: ProvenanceSourceRecord[];
}) {
  if (editor?.kind === "source") {
    return (
      <SourceForm
        onCancel={onCancel}
        onSubmit={onSourceSubmit}
        saving={saving}
        source={editor.source}
      />
    );
  }

  if (editor?.kind === "dẫn chứng") {
    return (
      <CitationForm
        dẫn chứng={editor.dẫn chứng}
        onCancel={onCancel}
        onSubmit={onCitationSubmit}
        saving={saving}
        sources={sources}
      />
    );
  }

  return null;
}

function UsedSourcesList({
  loading,
  onEdit,
  readOnly,
  sources,
}: {
  loading: boolean;
  onEdit: (source: ProvenanceSourceRecord) => void;
  readOnly: boolean;
  sources: ProvenanceSourceRecord[];
}) {
  if (loading || sources.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Nguồn đã dùng
      </p>
      <div className="mt-2 grid gap-2">
        {sources.map((source) => (
          <SourceSummary
            key={source.id}
            onEdit={onEdit}
            readOnly={readOnly}
            source={source}
          />
        ))}
      </div>
    </div>
  );
}

function CitationList({
  dẫn chứngs,
  loading,
  onEdit,
  onRemove,
  readOnly,
  sourceById,
}: {
  dẫn chứngs: ProvenanceCitationRecord[];
  loading: boolean;
  onEdit: (dẫn chứng: ProvenanceCitationRecord) => void;
  onRemove: (dẫn chứngId: string) => void;
  readOnly: boolean;
  sourceById: ReadonlyMap<string, ProvenanceSourceRecord>;
}) {
  if (loading) return null;

  if (dẫn chứngs.length === 0) {
    return (
      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Dẫn chứng
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Chưa có dẫn chứng cho mục đang chọn.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Dẫn chứng
      </p>
      <div className="mt-2 grid gap-2">
        {dẫn chứngs.map((dẫn chứng) => (
          <CitationCard
            dẫn chứng={dẫn chứng}
            key={dẫn chứng.id}
            onEdit={onEdit}
            onRemove={onRemove}
            readOnly={readOnly}
            source={sourceById.get(dẫn chứng.sourceId)}
          />
        ))}
      </div>
    </div>
  );
}

function provenanceKey(personId: string | null, relationshipId: string | null) {
  return `${personId ?? "none"}:${relationshipId ?? "none"}`;
}

function loadedStateFromResult(
  key: string,
  result: Awaited<ReturnType<typeof loadProvenance>>,
): LoadedProvenance {
  if (!result.ok) {
    return { key, sources: [], dẫn chứngs: [], error: result.message };
  }

  return {
    key,
    sources: result.sources,
    dẫn chứngs: result.dẫn chứngs,
    error: null,
  };
}

export function ProvenancePanel({
  personId,
  relationshipId,
  readOnly,
}: ProvenancePanelProps) {
  const router = useRouter();
  const targetKey = provenanceKey(personId, relationshipId);
  const [loaded, setLoaded] = useState<LoadedProvenance>({
    key: "",
    sources: [],
    dẫn chứngs: [],
    error: null,
  });
  const [editor, setEditor] = useState<EditorState>(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const loading = loaded.key !== targetKey;
  const sources = loaded.sources;
  const dẫn chứngs = loaded.dẫn chứngs;

  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const usedSources = useMemo(() => {
    const usedIds = new Set(dẫn chứngs.map((dẫn chứng) => dẫn chứng.sourceId));
    return sources.filter((source) => usedIds.has(source.id));
  }, [dẫn chứngs, sources]);

  useEffect(() => {
    let cancelled = false;

    void loadProvenance({ personId, relationshipId }).then((result) => {
      if (cancelled) return;
      setLoaded(loadedStateFromResult(targetKey, result));
    });

    return () => {
      cancelled = true;
    };
  }, [personId, relationshipId, targetKey]);

  async function refreshProvenance() {
    const result = await loadProvenance({ personId, relationshipId });
    setLoaded(loadedStateFromResult(targetKey, result));
    return result.ok;
  }

  async function submitSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editor?.kind !== "source") return;

    const formData = new FormData(event.currentTarget);
    const input = {
      title: formText(formData, "title"),
      sourceType: formText(formData, "sourceType") as ProvenanceSourceType,
      repositoryName: nullableFormText(formData, "repositoryName"),
      referenceCode: nullableFormText(formData, "referenceCode"),
      sourceUrl: nullableFormText(formData, "sourceUrl"),
    };

    setSaving(true);
    setStatusMessage(null);
    setConflict(false);

    const result = editor.source
      ? await updateProvenanceSource({
          sourceId: editor.source.id,
          expectedRevision: editor.source.revision,
          ...input,
        })
      : await createProvenanceSource(input);

    setSaving(false);
    if (!result.ok) {
      setConflict(result.kind === "conflict");
      setLoaded((current) => ({ ...current, error: result.message }));
      return;
    }

    setEditor(null);
    setStatusMessage(editor.source ? "Đã cập nhật nguồn." : "Đã thêm nguồn.");
    await refreshProvenance();
  }

  async function submitCitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editor?.kind !== "dẫn chứng") return;

    const formData = new FormData(event.currentTarget);
    const dateQualifierValue = nullableFormText(formData, "dateQualifier");
    const input = {
      sourceId: formText(formData, "sourceId"),
      personId,
      relationshipId,
      claimKind: formText(formData, "claimKind") as ProvenanceClaimKind,
      claimText: formText(formData, "claimText"),
      dẫn chứngLocator: nullableFormText(formData, "dẫn chứngLocator"),
      note: nullableFormText(formData, "note"),
      certainty: formText(formData, "certainty") as ProvenanceCertainty,
      dateText: nullableFormText(formData, "dateText"),
      dateQualifier: dateQualifierValue as ProvenanceDateQualifier | null,
    };

    setSaving(true);
    setStatusMessage(null);
    setConflict(false);

    const result = editor.dẫn chứng
      ? await updateProvenanceCitation({
          dẫn chứngId: editor.dẫn chứng.id,
          expectedRevision: editor.dẫn chứng.revision,
          ...input,
        })
      : await createProvenanceCitation(input);

    setSaving(false);
    if (!result.ok) {
      setConflict(result.kind === "conflict");
      setLoaded((current) => ({ ...current, error: result.message }));
      return;
    }

    setEditor(null);
    setStatusMessage(
      editor.dẫn chứng ? "Đã cập nhật dẫn chứng." : "Đã thêm dẫn chứng.",
    );
    await refreshProvenance();
  }

  async function removeCitation(dẫn chứngId: string) {
    const confirmed = window.confirm(
      "Xóa dẫn chứng này? Nguồn tư liệu gốc vẫn được giữ lại.",
    );
    if (!confirmed) return;

    const dẫn chứng = dẫn chứngs.find((item) => item.id === dẫn chứngId);
    if (!dẫn chứng) return;

    setSaving(true);
    setStatusMessage(null);
    setConflict(false);
    const result = await removeProvenanceCitation({
      dẫn chứngId,
      expectedRevision: dẫn chứng.revision,
    });
    setSaving(false);

    if (!result.ok) {
      setConflict(result.kind === "conflict");
      setLoaded((current) => ({ ...current, error: result.message }));
      return;
    }

    setEditor(null);
    setStatusMessage("Đã xóa dẫn chứng.");
    await refreshProvenance();
  }

  return (
    <section className="mt-5 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Nguồn tư liệu & ghi chú
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Nguồn tư liệu và các dẫn chứng chưa chắc chắn được lưu tách khỏi hồ sơ chính. Các thông tin mâu thuẫn có thể cùng tồn tại để người quản trị kiểm tra.
      </p>

      <ProvenanceToolbar
        onAddCitation={() => setEditor({ kind: "dẫn chứng", dẫn chứng: null })}
        onAddSource={() => setEditor({ kind: "source", source: null })}
        readOnly={readOnly}
        sourceCount={sources.length}
      />
      <LoadingMessage loading={loading} />
      <ErrorMessage message={loaded.error} />
      {conflict ? (
        <Button
          className="mt-2"
          onClick={() => router.refresh()}
          size="sm"
          type="button"
          variant="outline"
        >
          Tải dữ liệu mới
        </Button>
      ) : null}
      <StatusMessage message={statusMessage} />
      <ProvenanceEditor
        editor={editor}
        onCancel={() => setEditor(null)}
        onCitationSubmit={submitCitation}
        onSourceSubmit={submitSource}
        saving={saving}
        sources={sources}
      />
      <UsedSourcesList
        loading={loading}
        onEdit={(source) => setEditor({ kind: "source", source })}
        readOnly={readOnly}
        sources={usedSources}
      />
      <CitationList
        dẫn chứngs={dẫn chứngs}
        loading={loading}
        onEdit={(dẫn chứng) => setEditor({ kind: "dẫn chứng", dẫn chứng })}
        onRemove={(dẫn chứngId) => void removeCitation(dẫn chứngId)}
        readOnly={readOnly}
        sourceById={sourceById}
      />
    </section>
  );
}
