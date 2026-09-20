"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  | { kind: "citation"; citation: ProvenanceCitationRecord | null }
  | null;

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
        {readOnly ? null : (
          <Button
            onClick={() => onEdit(source)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Sửa nguồn
          </Button>
        )}
      </div>
      {source.sourceUrl ? (
        <a
          className="mt-2 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
          href={source.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          Mở nguồn
        </a>
      ) : null}
    </div>
  );
}

function CitationCard({
  citation,
  onEdit,
  onRemove,
  readOnly,
  source,
}: {
  citation: ProvenanceCitationRecord;
  onEdit: (citation: ProvenanceCitationRecord) => void;
  onRemove: (citationId: string) => void;
  readOnly: boolean;
  source: ProvenanceSourceRecord | undefined;
}) {
  const dateLabel =
    citation.dateText && citation.dateQualifier
      ? `${DATE_QUALIFIER_LABELS[citation.dateQualifier]}: ${citation.dateText}`
      : null;

  return (
    <article className="rounded-2xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
        <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
          {CLAIM_KIND_LABELS[citation.claimKind]}
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
          {CERTAINTY_LABELS[citation.certainty]}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-card-foreground">
        {citation.claimText}
      </p>

      {dateLabel ? (
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          Ngày ghi nhận: {dateLabel}
        </p>
      ) : null}

      <div className="mt-3 rounded-xl bg-muted/35 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-card-foreground">
          {source?.title ?? "Nguồn không khả dụng"}
        </p>
        {citation.citationLocator ? (
          <p className="mt-1">Vị trí trích dẫn: {citation.citationLocator}</p>
        ) : null}
        {citation.note ? (
          <p className="mt-2 whitespace-pre-wrap leading-5">
            Ghi chú nghiên cứu: {citation.note}
          </p>
        ) : null}
      </div>

      {readOnly ? null : (
        <div className="mt-3 flex gap-2">
          <Button
            onClick={() => onEdit(citation)}
            size="sm"
            type="button"
            variant="outline"
          >
            Sửa citation
          </Button>
          <Button
            onClick={() => onRemove(citation.id)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Xóa citation
          </Button>
        </div>
      )}
    </article>
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
  return (
    <form
      className="mt-3 rounded-2xl border border-border bg-muted/20 p-3"
      key={source?.id ?? "new-source"}
      onSubmit={onSubmit}
    >
      <p className="text-sm font-semibold text-card-foreground">
        {source ? "Sửa nguồn tư liệu" : "Thêm nguồn tư liệu"}
      </p>
      {source ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Nguồn có thể được dùng bởi nhiều citation; sửa metadata nguồn sẽ hiển
          thị ở tất cả citation tham chiếu đến nguồn này.
        </p>
      ) : null}

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Tên nguồn
        <input
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={source?.title ?? ""}
          maxLength={200}
          name="title"
          required
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Loại nguồn
        <select
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={source?.sourceType ?? "family_book"}
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
          defaultValue={source?.repositoryName ?? ""}
          maxLength={200}
          name="repositoryName"
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Mã hồ sơ / ký hiệu
        <input
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={source?.referenceCode ?? ""}
          maxLength={200}
          name="referenceCode"
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        URL nguồn
        <input
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={source?.sourceUrl ?? ""}
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
  citation,
  saving,
  sources,
  onCancel,
  onSubmit,
}: {
  citation: ProvenanceCitationRecord | null;
  saving: boolean;
  sources: ProvenanceSourceRecord[];
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      className="mt-3 rounded-2xl border border-border bg-muted/20 p-3"
      key={citation?.id ?? "new-citation"}
      onSubmit={onSubmit}
    >
      <p className="text-sm font-semibold text-card-foreground">
        {citation ? "Sửa citation" : "Thêm citation"}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Claim chưa chắc chắn hoặc mâu thuẫn được lưu riêng tại đây; form này
        không tự sửa năm sinh, năm mất hay quan hệ canonical.
      </p>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Nguồn tư liệu
        <select
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={citation?.sourceId ?? sources[0]?.id ?? ""}
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
        Loại claim
        <select
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={citation?.claimKind ?? "note"}
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
        Nội dung claim
        <textarea
          className="mt-1 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={citation?.claimText ?? ""}
          maxLength={2000}
          name="claimText"
          required
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Vị trí trích dẫn
        <input
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={citation?.citationLocator ?? ""}
          maxLength={240}
          name="citationLocator"
          placeholder="Trang, folio, mục, số hồ sơ…"
        />
      </label>

      <label className="mt-3 block text-xs font-medium text-muted-foreground">
        Mức độ chắc chắn
        <select
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
          defaultValue={citation?.certainty ?? "unknown"}
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
            defaultValue={citation?.dateQualifier ?? ""}
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
            defaultValue={citation?.dateText ?? ""}
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
          defaultValue={citation?.note ?? ""}
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
          {saving ? "Đang lưu…" : "Lưu citation"}
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

export function ProvenancePanel({
  personId,
  relationshipId,
  readOnly,
}: ProvenancePanelProps) {
  const [sources, setSources] = useState<ProvenanceSourceRecord[]>([]);
  const [citations, setCitations] = useState<ProvenanceCitationRecord[]>([]);
  const [editor, setEditor] = useState<EditorState>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const usedSources = useMemo(() => {
    const usedIds = new Set(citations.map((citation) => citation.sourceId));
    return sources.filter((source) => usedIds.has(source.id));
  }, [citations, sources]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const result = await loadProvenance({ personId, relationshipId });

    if (!result.ok) {
      setErrorMessage(result.message);
      setLoading(false);
      return;
    }

    setSources(result.sources);
    setCitations(result.citations);
    setLoading(false);
  }, [personId, relationshipId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submitSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editor?.kind !== "source") return;

    const formData = new FormData(event.currentTarget);
    const sourceType = formText(formData, "sourceType") as ProvenanceSourceType;
    const input = {
      title: formText(formData, "title"),
      sourceType,
      repositoryName: nullableFormText(formData, "repositoryName"),
      referenceCode: nullableFormText(formData, "referenceCode"),
      sourceUrl: nullableFormText(formData, "sourceUrl"),
    };

    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const result = editor.source
      ? await updateProvenanceSource({
          sourceId: editor.source.id,
          ...input,
        })
      : await createProvenanceSource(input);

    setSaving(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setEditor(null);
    setStatusMessage(editor.source ? "Đã cập nhật nguồn." : "Đã thêm nguồn.");
    await refresh();
  }

  async function submitCitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editor?.kind !== "citation") return;

    const formData = new FormData(event.currentTarget);
    const dateQualifierValue = nullableFormText(formData, "dateQualifier");
    const input = {
      sourceId: formText(formData, "sourceId"),
      personId,
      relationshipId,
      claimKind: formText(formData, "claimKind") as ProvenanceClaimKind,
      claimText: formText(formData, "claimText"),
      citationLocator: nullableFormText(formData, "citationLocator"),
      note: nullableFormText(formData, "note"),
      certainty: formText(formData, "certainty") as ProvenanceCertainty,
      dateText: nullableFormText(formData, "dateText"),
      dateQualifier: dateQualifierValue as ProvenanceDateQualifier | null,
    };

    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const result = editor.citation
      ? await updateProvenanceCitation({
          citationId: editor.citation.id,
          ...input,
        })
      : await createProvenanceCitation(input);

    setSaving(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setEditor(null);
    setStatusMessage(
      editor.citation ? "Đã cập nhật citation." : "Đã thêm citation.",
    );
    await refresh();
  }

  async function removeCitation(citationId: string) {
    if (!window.confirm("Xóa citation này? Nguồn tư liệu sẽ được giữ lại.")) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    const result = await removeProvenanceCitation({ citationId });
    setSaving(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setEditor(null);
    setStatusMessage("Đã xóa citation.");
    await refresh();
  }

  return (
    <section className="mt-5 border-t border-border pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Notes & provenance
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Nguồn, citation và claim chưa chắc chắn được lưu tách khỏi dữ liệu
            canonical. Claim mâu thuẫn có thể cùng tồn tại để review.
          </p>
        </div>
      </div>

      {readOnly ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => setEditor({ kind: "source", source: null })}
            size="sm"
            type="button"
            variant="outline"
          >
            + Nguồn
          </Button>
          <Button
            disabled={sources.length === 0}
            onClick={() => setEditor({ kind: "citation", citation: null })}
            size="sm"
            type="button"
            variant="outline"
          >
            + Citation
          </Button>
        </div>
      )}

      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Đang tải provenance…
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 text-xs text-destructive">{errorMessage}</p>
      ) : null}

      {statusMessage ? (
        <p aria-live="polite" className="mt-3 text-xs text-primary">
          {statusMessage}
        </p>
      ) : null}

      {editor?.kind === "source" ? (
        <SourceForm
          onCancel={() => setEditor(null)}
          onSubmit={submitSource}
          saving={saving}
          source={editor.source}
        />
      ) : null}

      {editor?.kind === "citation" ? (
        <CitationForm
          citation={editor.citation}
          onCancel={() => setEditor(null)}
          onSubmit={submitCitation}
          saving={saving}
          sources={sources}
        />
      ) : null}

      {!loading && usedSources.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Nguồn đã dùng
          </p>
          <div className="mt-2 grid gap-2">
            {usedSources.map((source) => (
              <SourceSummary
                key={source.id}
                onEdit={(selectedSource) =>
                  setEditor({ kind: "source", source: selectedSource })
                }
                readOnly={readOnly}
                source={source}
              />
            ))}
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Citations
          </p>
          {citations.length === 0 ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Chưa có citation cho mục đang chọn.
            </p>
          ) : (
            <div className="mt-2 grid gap-2">
              {citations.map((citation) => (
                <CitationCard
                  citation={citation}
                  key={citation.id}
                  onEdit={(selectedCitation) =>
                    setEditor({
                      kind: "citation",
                      citation: selectedCitation,
                    })
                  }
                  onRemove={(citationId) => void removeCitation(citationId)}
                  readOnly={readOnly}
                  source={sourceById.get(citation.sourceId)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
