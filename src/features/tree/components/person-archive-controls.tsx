"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type PersonStateResult =
  | { ok: true; personId: string }
  | { ok: false; message: string };

export type PersonStateMutation = (input: {
  personId: string;
}) => Promise<PersonStateResult>;

type ArchivePerson = {
  id: string;
  displayName: string;
  archivedAt: string | null;
};

type ArchiveRelationship = {
  id: string;
  sourcePersonId: string;
  targetPersonId: string;
};

type PersonArchiveControlsProps = {
  archivePerson: PersonStateMutation | undefined;
  people: ArchivePerson[];
  person: ArchivePerson;
  relationships: ArchiveRelationship[];
  restorePerson: PersonStateMutation | undefined;
  onChanged: () => void;
};

function getConnectedRelationships(
  personId: string,
  relationships: ArchiveRelationship[],
) {
  return relationships.filter(
    (relationship) =>
      relationship.sourcePersonId === personId ||
      relationship.targetPersonId === personId,
  );
}

function getOtherPersonId(
  personId: string,
  relationship: ArchiveRelationship,
) {
  return relationship.sourcePersonId === personId
    ? relationship.targetPersonId
    : relationship.sourcePersonId;
}

function getConnectedNames(
  person: ArchivePerson,
  people: ArchivePerson[],
  relationships: ArchiveRelationship[],
) {
  const peopleById = new Map(people.map((item) => [item.id, item.displayName]));

  return getConnectedRelationships(person.id, relationships)
    .map((relationship) => peopleById.get(getOtherPersonId(person.id, relationship)))
    .filter((name): name is string => Boolean(name));
}

function ArchiveImpact({
  people,
  person,
  relationships,
}: Pick<PersonArchiveControlsProps, "people" | "person" | "relationships">) {
  const names = getConnectedNames(person, people, relationships);

  return (
    <div className="mt-5 rounded-2xl border border-border bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Ảnh hưởng khi lưu trữ
      </p>
      <p className="mt-2 text-sm leading-6 text-card-foreground">
        Hồ sơ sẽ bị ẩn khỏi chế độ xem thông thường. {names.length} quan hệ kết
        nối vẫn được giữ nguyên để có thể khôi phục đầy đủ.
      </p>
      {names.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Liên quan: {names.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

export function PersonArchiveControls({
  archivePerson,
  people,
  person,
  relationships,
  restorePerson,
  onChanged,
}: PersonArchiveControlsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleArchive() {
    if (!archivePerson) return;

    const connectedCount = getConnectedRelationships(
      person.id,
      relationships,
    ).length;
    const confirmed = window.confirm(
      `Lưu trữ ${person.displayName}? Hồ sơ sẽ bị ẩn nhưng ${connectedCount} quan hệ kết nối vẫn được giữ nguyên.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage(null);
    const result = await archivePerson({ personId: person.id });
    setSaving(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    onChanged();
  }

  async function handleRestore() {
    if (!restorePerson) return;

    setSaving(true);
    setMessage(null);
    const result = await restorePerson({ personId: person.id });
    setSaving(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    onChanged();
  }

  if (person.archivedAt) {
    return (
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-sm font-medium text-card-foreground">
          Hồ sơ đang được lưu trữ
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Quan hệ và vị trí vẫn còn trong dữ liệu. Khôi phục để chỉnh sửa hoặc
          thêm quan hệ mới.
        </p>
        <Button
          className="mt-4 w-full"
          disabled={saving}
          onClick={handleRestore}
          type="button"
          variant="outline"
        >
          {saving ? "Đang khôi phục…" : "Khôi phục hồ sơ"}
        </Button>
        {message ? (
          <p aria-live="polite" className="mt-2 text-sm text-destructive">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <ArchiveImpact people={people} person={person} relationships={relationships} />
      <Button
        className="mt-4 w-full"
        disabled={saving}
        onClick={handleArchive}
        type="button"
        variant="outline"
      >
        {saving ? "Đang lưu trữ…" : "Lưu trữ hồ sơ"}
      </Button>
      {message ? (
        <p aria-live="polite" className="mt-2 text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
