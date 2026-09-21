"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  executeDuplicatePersonMerge,
  loadDuplicateSuggestions,
  loadPersonMergePreview,
  type DuplicateSuggestionLoadResult,
  type PersonMergePreviewResult,
} from "@/app/admin/tree/duplicate-actions";
import { Button } from "@/components/ui/button";
import type {
  DuplicatePerson,
  DuplicateSuggestion,
  MergeRelationshipChange,
} from "@/features/tree/duplicate-domain";

type ReviewPair = {
  targetPersonId: string;
  sourcePersonId: string;
};

type DuplicateData = Extract<DuplicateSuggestionLoadResult, { ok: true }>;
type MergePreviewData = Extract<PersonMergePreviewResult, { ok: true }>;

function personById(people: DuplicatePerson[], personId: string) {
  return people.find((person) => person.id === personId) ?? null;
}

function personYears(person: DuplicatePerson) {
  const birth = person.birthYear?.toString() ?? "?";
  const death = person.deathYear?.toString() ?? "nay";
  return `${birth} – ${death}`;
}

function personSexLabel(person: DuplicatePerson) {
  if (person.sex === "male") return "Nam";
  if (person.sex === "female") return "Nữ";
  return "Chưa rõ";
}

function ProfileCard({
  label,
  person,
  tone,
}: {
  label: string;
  person: DuplicatePerson;
  tone: "target" | "source";
}) {
  const targetDescription =
    tone === "target"
      ? "Hồ sơ này được giữ làm canonical. Merge không tự sao chép field từ source."
      : "Hồ sơ này sẽ được lưu trữ và đánh dấu merged_into nếu merge thành công.";

  return (
    <article className="rounded-2xl border border-border bg-background p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        {label}
      </p>
      <h4 className="mt-2 text-lg font-semibold text-card-foreground">
        {person.displayName}
      </h4>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Năm</dt>
        <dd className="text-right font-medium text-card-foreground">
          {personYears(person)}
        </dd>
        <dt className="text-muted-foreground">Giới tính</dt>
        <dd className="text-right font-medium text-card-foreground">
          {personSexLabel(person)}
        </dd>
        <dt className="text-muted-foreground">Hiển thị</dt>
        <dd className="text-right font-medium text-card-foreground">
          {person.visibility === "private" ? "Riêng tư" : "Công khai"}
        </dd>
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {person.description || "Chưa có mô tả."}
      </p>
      <p className="mt-3 rounded-xl bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
        {targetDescription}
      </p>
    </article>
  );
}

function personDisplayName(people: DuplicatePerson[], personId: string) {
  const person = personById(people, personId);
  return person ? person.displayName : personId;
}

function relationshipKindLabel(
  relationshipKind: MergeRelationshipChange["relationshipKind"],
) {
  return relationshipKind === "partnership" ? "Hôn phối" : "Cha/mẹ → con";
}

function relationshipActionLabel(action: MergeRelationshipChange["action"]) {
  return action === "deduplicate" ? "Gộp cạnh trùng" : "Di chuyển cạnh";
}

function DeduplicationNote({
  existingRelationshipId,
}: {
  existingRelationshipId: string | null;
}) {
  if (!existingRelationshipId) return null;

  return (
    <p className="mt-1 text-muted-foreground">
      Citation của cạnh trùng sẽ chuyển sang relationship hiện có.
    </p>
  );
}

function RelationshipChangeRow({
  change,
  people,
}: {
  change: MergeRelationshipChange;
  people: DuplicatePerson[];
}) {
  const fromSource = personDisplayName(people, change.fromSourcePersonId);
  const fromTarget = personDisplayName(people, change.fromTargetPersonId);
  const toSource = personDisplayName(people, change.toSourcePersonId);
  const toTarget = personDisplayName(people, change.toTargetPersonId);

  return (
    <li className="rounded-xl border border-border bg-background p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-card-foreground">
          {relationshipKindLabel(change.relationshipKind)}
        </span>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          {relationshipActionLabel(change.action)}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground">
        {fromSource} → {fromTarget}
      </p>
      <p className="mt-1 font-medium text-card-foreground">
        Sau merge: {toSource} → {toTarget}
      </p>
      <DeduplicationNote
        existingRelationshipId={change.existingRelationshipId}
      />
    </li>
  );
}

function BlockerList({ blockers }: { blockers: string[] }) {
  if (blockers.length === 0) {
    return (
      <p className="rounded-xl bg-primary/10 p-3 text-xs font-medium text-primary">
        Preview không phát hiện blocker. Vẫn cần xác nhận thủ công trước khi
        merge.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-xs font-semibold text-destructive">
        Merge đang bị chặn
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-destructive">
        {blockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({
  people,
  suggestion,
  onReview,
}: {
  people: DuplicatePerson[];
  suggestion: DuplicateSuggestion;
  onReview: (suggestion: DuplicateSuggestion) => void;
}) {
  const first = personById(people, suggestion.firstPersonId);
  const second = personById(people, suggestion.secondPersonId);
  if (!first || !second) return null;

  return (
    <article className="rounded-2xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-card-foreground">
            {first.displayName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {personYears(first)} ↔ {personYears(second)}
          </p>
          <p className="mt-1 text-sm font-semibold text-card-foreground">
            {second.displayName}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          tín hiệu {suggestion.score}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {suggestion.reasons.join(" · ")}
      </p>
      <Button
        className="mt-3"
        onClick={() => onReview(suggestion)}
        size="sm"
        type="button"
        variant="outline"
      >
        Review side-by-side
      </Button>
    </article>
  );
}

function SuggestionList({
  data,
  onReview,
}: {
  data: DuplicateData;
  onReview: (suggestion: DuplicateSuggestion) => void;
}) {
  if (data.suggestions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Không có candidate nào vượt ngưỡng bảo thủ hiện tại. Hệ thống không tự
        merge và không gợi ý chỉ dựa trên tên giống nhau.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {data.suggestions.map((suggestion) => (
        <SuggestionRow
          key={`${suggestion.firstPersonId}:${suggestion.secondPersonId}`}
          onReview={onReview}
          people={data.people}
          suggestion={suggestion}
        />
      ))}
    </div>
  );
}

function MergeImpact({
  data,
  people,
}: {
  data: MergePreviewData;
  people: DuplicatePerson[];
}) {
  return (
    <section className="mt-4 rounded-2xl border border-border bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Migration preview
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-background p-3">
          <p className="text-2xl font-semibold text-card-foreground">
            {data.preview.relationshipChanges.length}
          </p>
          <p className="text-xs text-muted-foreground">quan hệ bị tác động</p>
        </div>
        <div className="rounded-xl bg-background p-3">
          <p className="text-2xl font-semibold text-card-foreground">
            {data.sourcePersonCitationCount}
          </p>
          <p className="text-xs text-muted-foreground">
            citation của source person
          </p>
        </div>
        <div className="rounded-xl bg-background p-3">
          <p className="text-2xl font-semibold text-card-foreground">
            {data.sourceRelationshipCitationCount}
          </p>
          <p className="text-xs text-muted-foreground">
            citation của relationship
          </p>
        </div>
      </div>

      <div className="mt-3">
        <BlockerList blockers={data.preview.blockers} />
      </div>

      {data.preview.relationshipChanges.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {data.preview.relationshipChanges.map((change) => (
            <RelationshipChangeRow
              change={change}
              key={change.relationshipId}
              people={people}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Source không có relationship cần migrate.
        </p>
      )}
    </section>
  );
}

function MergeConfirmation({
  blocked,
  confirmation,
  executing,
  onConfirmationChange,
  onExecute,
}: {
  blocked: boolean;
  confirmation: string;
  executing: boolean;
  onConfirmationChange: (value: string) => void;
  onExecute: () => void;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-border bg-background p-4">
      <p className="text-sm font-semibold text-card-foreground">
        Xác nhận merge có kiểm soát
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Nhập chính xác <strong>MERGE</strong>. Không có auto-merge, không có
        merge khi preview còn blocker.
      </p>
      <input
        className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        onChange={(event) => onConfirmationChange(event.target.value)}
        placeholder="MERGE"
        value={confirmation}
      />
      <Button
        className="mt-3"
        disabled={blocked || confirmation !== "MERGE" || executing}
        onClick={onExecute}
        type="button"
      >
        {executing ? "Đang merge…" : "Thực thi merge"}
      </Button>
    </section>
  );
}

function ReviewWorkspace({
  confirmation,
  data,
  executing,
  onCloseReview,
  onConfirmationChange,
  onExecute,
  onSwap,
  pair,
  preview,
}: {
  confirmation: string;
  data: DuplicateData;
  executing: boolean;
  onCloseReview: () => void;
  onConfirmationChange: (value: string) => void;
  onExecute: () => void;
  onSwap: () => void;
  pair: ReviewPair;
  preview: MergePreviewData | null;
}) {
  const target = personById(data.people, pair.targetPersonId);
  const source = personById(data.people, pair.sourcePersonId);
  if (!target || !source) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={onCloseReview} size="sm" type="button" variant="ghost">
          ← Candidate list
        </Button>
        <Button onClick={onSwap} size="sm" type="button" variant="outline">
          Đổi Target ↔ Source
        </Button>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <ProfileCard label="TARGET · giữ lại" person={target} tone="target" />
        <ProfileCard
          label="SOURCE · sẽ lưu trữ"
          person={source}
          tone="source"
        />
      </div>

      {preview ? <MergeImpact data={preview} people={data.people} /> : null}
      {preview ? (
        <MergeConfirmation
          blocked={preview.preview.blockers.length > 0}
          confirmation={confirmation}
          executing={executing}
          onConfirmationChange={onConfirmationChange}
          onExecute={onExecute}
        />
      ) : null}
    </div>
  );
}

type DuplicateReviewModalProps = {
  candidateCount: number;
  confirmation: string;
  data: DuplicateData | null;
  executing: boolean;
  loading: boolean;
  message: string | null;
  pair: ReviewPair | null;
  preview: MergePreviewData | null;
  previewLoading: boolean;
  onClose: () => void;
  onCloseReview: () => void;
  onConfirmationChange: (value: string) => void;
  onExecute: () => void;
  onRefresh: () => void;
  onReview: (suggestion: DuplicateSuggestion) => void;
  onSwap: () => void;
};

function PanelMessage({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-card-foreground">
      {message}
    </p>
  );
}

function LoadingStatus({
  loading,
  previewLoading,
}: {
  loading: boolean;
  previewLoading: boolean;
}) {
  if (loading) {
    return (
      <p className="mt-5 text-sm text-muted-foreground">
        Đang quét duplicate candidates…
      </p>
    );
  }

  if (previewLoading) {
    return (
      <p className="mt-5 text-sm text-muted-foreground">
        Đang tính migration preview…
      </p>
    );
  }

  return null;
}

function ReviewContent({
  confirmation,
  data,
  executing,
  loading,
  pair,
  preview,
  onCloseReview,
  onConfirmationChange,
  onExecute,
  onReview,
  onSwap,
}: Pick<
  DuplicateReviewModalProps,
  | "confirmation"
  | "data"
  | "executing"
  | "loading"
  | "pair"
  | "preview"
  | "onCloseReview"
  | "onConfirmationChange"
  | "onExecute"
  | "onReview"
  | "onSwap"
>) {
  if (loading || !data) return null;

  if (!pair) {
    return (
      <div className="mt-5">
        <SuggestionList data={data} onReview={onReview} />
      </div>
    );
  }

  return (
    <div className="mt-5">
      <ReviewWorkspace
        confirmation={confirmation}
        data={data}
        executing={executing}
        onCloseReview={onCloseReview}
        onConfirmationChange={onConfirmationChange}
        onExecute={onExecute}
        onSwap={onSwap}
        pair={pair}
        preview={preview}
      />
    </div>
  );
}

function DuplicateReviewModal(props: DuplicateReviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/90 p-4 backdrop-blur-sm sm:p-6">
      <div className="mx-auto max-w-6xl rounded-3xl border border-border bg-card p-5 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Duplicate Detection & Merge Review
            </p>
            <h2 className="font-display mt-1 text-3xl text-card-foreground">
              Review trước, merge sau
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Detector chỉ gợi ý khi tên chuẩn hóa trùng và có tín hiệu ngày
              mạnh. Không có auto-merge. Target canonical không bị source ghi
              đè.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={props.loading}
              onClick={props.onRefresh}
              type="button"
              variant="outline"
            >
              Quét lại
            </Button>
            <Button onClick={props.onClose} type="button" variant="ghost">
              Đóng
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{props.candidateCount} candidate</span>
          <span aria-hidden="true">·</span>
          <span>Không merge tự động</span>
        </div>

        <PanelMessage message={props.message} />
        <LoadingStatus
          loading={props.loading}
          previewLoading={props.previewLoading}
        />
        <ReviewContent
          confirmation={props.confirmation}
          data={props.data}
          executing={props.executing}
          loading={props.loading}
          onCloseReview={props.onCloseReview}
          onConfirmationChange={props.onConfirmationChange}
          onExecute={props.onExecute}
          onReview={props.onReview}
          onSwap={props.onSwap}
          pair={props.pair}
          preview={props.preview}
        />
      </div>
    </div>
  );
}

export function DuplicateReviewPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DuplicateData | null>(null);
  const [pair, setPair] = useState<ReviewPair | null>(null);
  const [preview, setPreview] = useState<MergePreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const candidateCount = useMemo(
    () => data?.suggestions.length ?? 0,
    [data?.suggestions.length],
  );

  async function refreshSuggestions() {
    setLoading(true);
    setMessage(null);
    const result = await loadDuplicateSuggestions();
    setLoading(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setData(result);
  }

  async function openPanel() {
    setOpen(true);
    if (!data) await refreshSuggestions();
  }

  async function loadPreview(nextPair: ReviewPair) {
    setPair(nextPair);
    setPreview(null);
    setConfirmation("");
    setPreviewLoading(true);
    setMessage(null);
    const result = await loadPersonMergePreview(nextPair);
    setPreviewLoading(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setPreview(result);
  }

  async function reviewSuggestion(suggestion: DuplicateSuggestion) {
    await loadPreview({
      targetPersonId: suggestion.firstPersonId,
      sourcePersonId: suggestion.secondPersonId,
    });
  }

  async function swapPair() {
    if (!pair) return;
    await loadPreview({
      targetPersonId: pair.sourcePersonId,
      sourcePersonId: pair.targetPersonId,
    });
  }

  async function executeMerge() {
    if (!pair || confirmation !== "MERGE") return;
    if (!preview || preview.preview.blockers.length > 0) return;

    setExecuting(true);
    setMessage(null);
    const result = await executeDuplicatePersonMerge({
      ...pair,
      confirmation: "MERGE",
    });
    setExecuting(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setMessage(`Merge hoàn tất. Audit ID: ${result.auditId}`);
    setPair(null);
    setPreview(null);
    setConfirmation("");
    await refreshSuggestions();
    router.refresh();
  }

  function closeReview() {
    setPair(null);
    setPreview(null);
    setConfirmation("");
    setMessage(null);
  }

  if (!open) {
    return (
      <Button onClick={() => void openPanel()} type="button" variant="outline">
        Review duplicates
      </Button>
    );
  }

  return (
    <DuplicateReviewModal
      candidateCount={candidateCount}
      confirmation={confirmation}
      data={data}
      executing={executing}
      loading={loading}
      message={message}
      onClose={() => setOpen(false)}
      onCloseReview={closeReview}
      onConfirmationChange={setConfirmation}
      onExecute={() => void executeMerge()}
      onRefresh={() => void refreshSuggestions()}
      onReview={(suggestion) => void reviewSuggestion(suggestion)}
      onSwap={() => void swapPair()}
      pair={pair}
      preview={preview}
      previewLoading={previewLoading}
    />
  );
}
