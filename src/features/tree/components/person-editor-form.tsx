"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  CreatePersonInput,
  PersonSex,
  PersonVisibility,
} from "@/features/tree/person-input";

export type PersonFormPerson = {
  id: string;
  displayName: string;
  description: string | null;
  birthYear: number | null;
  deathYear: number | null;
  sex?: PersonSex | null;
  visibility: PersonVisibility;
};

type PersonMutationResult =
  | { ok: true; personId: string; revision: number }
  | { ok: false; message: string; kind?: "conflict" };

type PersonEditorFormProps = {
  person: PersonFormPerson | null;
  onCancel: () => void;
  onDraftStateChange: (dirty: boolean, saving: boolean) => void;
  onSave: (input: CreatePersonInput) => Promise<PersonMutationResult>;
  onSaved: (personId: string) => void;
};

type Draft = {
  displayName: string;
  description: string;
  birthYear: string;
  deathYear: string;
  sex: PersonSex | "";
  visibility: PersonVisibility;
};

const EMPTY_DRAFT: Draft = {
  displayName: "",
  description: "",
  birthYear: "",
  deathYear: "",
  sex: "",
  visibility: "private",
};

function formatYearField(year: number | null) {
  return year === null ? "" : year.toString();
}

function formatDescriptionField(description: string | null) {
  return description ?? "";
}

function toDraft(person: PersonFormPerson | null): Draft {
  if (!person) return { ...EMPTY_DRAFT };

  return {
    displayName: person.displayName,
    description: formatDescriptionField(person.description),
    birthYear: formatYearField(person.birthYear),
    deathYear: formatYearField(person.deathYear),
    sex: person.sex ?? "",
    visibility: person.visibility,
  };
}

function parseYear(value: string) {
  return value === "" ? null : Number(value);
}

function toInput(draft: Draft): CreatePersonInput {
  return {
    displayName: draft.displayName,
    description: draft.description,
    birthYear: parseYear(draft.birthYear),
    deathYear: parseYear(draft.deathYear),
    sex: draft.sex || null,
    visibility: draft.visibility,
  };
}

export function PersonEditorForm({
  person,
  onCancel,
  onDraftStateChange,
  onSave,
  onSaved,
}: PersonEditorFormProps) {
  const router = useRouter();
  const [initialDraft] = useState(() => toDraft(person));
  const [draft, setDraft] = useState(initialDraft);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  useEffect(() => {
    onDraftStateChange(dirty, saving);
    return () => onDraftStateChange(false, false);
  }, [dirty, saving, onDraftStateChange]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage(null);
    setConflict(false);

    let result: PersonMutationResult;
    try {
      result = await onSave(toInput(draft));
    } catch {
      setErrorMessage(
        "Không thể kết nối để lưu hồ sơ. Nội dung vẫn được giữ, hãy thử lại.",
      );
      return;
    } finally {
      setSaving(false);
    }

    if (!result.ok) {
      setErrorMessage(result.message);
      setConflict(result.kind === "conflict");
      return;
    }

    onSaved(result.personId);
  }

  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <p className="text-sm text-muted-foreground">
        Họ tên là bắt buộc. Các thông tin chưa rõ có thể để trống.
      </p>
      <fieldset disabled={saving} className="space-y-4">
        <label className="block text-sm font-medium text-card-foreground">
          Họ tên
          <input
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            maxLength={120}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
            required
            value={draft.displayName}
          />
        </label>

        <label className="block text-sm font-medium text-card-foreground">
          Mô tả
          <textarea
            className="mt-1.5 min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            maxLength={2000}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Vai trò trong dòng họ, nghề nghiệp, ghi chú tiểu sử ngắn…"
            value={draft.description}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {draft.description.length}/2000 ký tự
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-card-foreground">
            Năm sinh
            <input
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              inputMode="numeric"
              max={2200}
              min={1}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  birthYear: event.target.value,
                }))
              }
              type="number"
              value={draft.birthYear}
            />
          </label>

          <label className="block text-sm font-medium text-card-foreground">
            Năm mất
            <input
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              inputMode="numeric"
              max={2200}
              min={1}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  deathYear: event.target.value,
                }))
              }
              type="number"
              value={draft.deathYear}
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-card-foreground">
          Giới tính dùng cho quan hệ
          <select
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sex: event.target.value as PersonSex | "",
              }))
            }
            value={draft.sex}
          >
            <option value="">Chưa rõ</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-card-foreground">
          Quyền hiển thị
          <select
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                visibility: event.target.value as PersonVisibility,
              }))
            }
            value={draft.visibility}
          >
            <option value="private">Riêng tư</option>
            <option value="public">Công khai</option>
          </select>
        </label>
      </fieldset>
      {errorMessage ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p aria-live="polite" className="text-sm text-destructive">
            {errorMessage}
          </p>
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
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t bg-card px-4 py-3">
        <Button disabled={saving || (person !== null && !dirty)} type="submit">
          {saving ? "Đang lưu…" : "Lưu hồ sơ"}
        </Button>
        <Button
          disabled={saving}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}
