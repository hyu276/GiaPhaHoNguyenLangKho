"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  CreatePersonInput,
  PersonVisibility,
} from "@/features/tree/person-input";

export type PersonFormPerson = {
  id: string;
  displayName: string;
  description: string | null;
  birthYear: number | null;
  deathYear: number | null;
  visibility: PersonVisibility;
};

type PersonMutationResult =
  { ok: true; personId: string } | { ok: false; message: string };

type PersonEditorFormProps = {
  person: PersonFormPerson | null;
  onCancel: () => void;
  onSave: (input: CreatePersonInput) => Promise<PersonMutationResult>;
  onSaved: (personId: string) => void;
};

type Draft = {
  displayName: string;
  description: string;
  birthYear: string;
  deathYear: string;
  visibility: PersonVisibility;
};

function toDraft(person: PersonFormPerson | null): Draft {
  return {
    displayName: person?.displayName ?? "",
    description: person?.description ?? "",
    birthYear: person?.birthYear?.toString() ?? "",
    deathYear: person?.deathYear?.toString() ?? "",
    visibility: person?.visibility ?? "private",
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
    visibility: draft.visibility,
  };
}

export function PersonEditorForm({
  person,
  onCancel,
  onSave,
  onSaved,
}: PersonEditorFormProps) {
  const [draft, setDraft] = useState(() => toDraft(person));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const title = person ? "Sửa hồ sơ" : "Thêm người";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);

    const result = await onSave(toInput(draft));
    setSaving(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    onSaved(result.personId);
  }

  return (
    <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Person CRUD
        </p>
        <h2 className="font-display mt-1 text-3xl text-card-foreground">
          {title}
        </h2>
      </div>

      <label className="block text-sm font-medium text-card-foreground">
        Họ tên
        <input
          className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
          className="mt-1.5 min-h-28 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
            className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
            className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
        Visibility
        <select
          className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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

      {errorMessage ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button disabled={saving} type="submit">
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
