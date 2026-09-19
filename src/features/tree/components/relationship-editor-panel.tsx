"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildRelationshipProposal,
  type RelationshipIntent,
  type RelationshipRecord,
  validateRelationshipProposal,
} from "@/features/tree/relationship-domain";
import type {
  CreateParentChildInput,
  CreatePartnershipInput,
  RemoveRelationshipInput,
} from "@/features/tree/relationship-input";

export type RelationshipPerson = {
  id: string;
  displayName: string;
  birthYear: number | null;
  deathYear: number | null;
};

export type RelationshipMutationResult =
  { ok: true; relationshipId: string } | { ok: false; message: string };

export type CreateParentChildRelationship = (
  input: CreateParentChildInput,
) => Promise<RelationshipMutationResult>;
export type CreatePartnership = (
  input: CreatePartnershipInput,
) => Promise<RelationshipMutationResult>;
export type RemoveRelationship = (
  input: RemoveRelationshipInput,
) => Promise<RelationshipMutationResult>;

type PersonRelationshipSectionProps = {
  createParentChildRelationship: CreateParentChildRelationship | undefined;
  createPartnership: CreatePartnership | undefined;
  focalPerson: RelationshipPerson;
  onChanged: (focusPersonId: string) => void;
  people: RelationshipPerson[];
  readOnly: boolean;
  relationships: RelationshipRecord[];
};

type RelationshipInspectorProps = {
  onChanged: (focusPersonId?: string) => void;
  people: RelationshipPerson[];
  readOnly: boolean;
  relationship: RelationshipRecord;
  removeRelationship: RemoveRelationship | undefined;
};

function formatYears(person: RelationshipPerson) {
  const birth = person.birthYear?.toString() ?? "?";
  const death = person.deathYear?.toString() ?? "nay";
  return `${birth} – ${death}`;
}

function getIntentLabel(intent: RelationshipIntent) {
  if (intent === "parent") return "Thêm cha / mẹ";
  if (intent === "child") return "Thêm con";
  return "Thêm hôn phối";
}

function getDirectRelationshipLabel(
  relationship: RelationshipRecord,
  focalPersonId: string,
) {
  if (relationship.kind === "partnership") return "Hôn phối";
  return relationship.sourcePersonId === focalPersonId ? "Con" : "Cha / mẹ";
}

function getOtherPersonId(
  relationship: RelationshipRecord,
  focalPersonId: string,
) {
  return relationship.sourcePersonId === focalPersonId
    ? relationship.targetPersonId
    : relationship.sourcePersonId;
}

function getPersonName(people: RelationshipPerson[], personId: string) {
  return (
    people.find((person) => person.id === personId)?.displayName ??
    "Người không xác định"
  );
}

async function runCreateRelationship(
  proposal: ReturnType<typeof buildRelationshipProposal>,
  createParentChildRelationship: CreateParentChildRelationship | undefined,
  createPartnership: CreatePartnership | undefined,
): Promise<RelationshipMutationResult> {
  if (proposal.kind === "partnership") {
    if (!createPartnership) {
      return { ok: false, message: "Tài khoản này không thể tạo hôn phối." };
    }

    return createPartnership({
      firstPersonId: proposal.sourcePersonId,
      secondPersonId: proposal.targetPersonId,
    });
  }

  if (!createParentChildRelationship) {
    return {
      ok: false,
      message: "Tài khoản này không thể tạo quan hệ cha/mẹ – con.",
    };
  }

  return createParentChildRelationship({
    firstPersonId: proposal.sourcePersonId,
    secondPersonId: proposal.targetPersonId,
  });
}

function DirectRelationshipList({
  focalPerson,
  people,
  relationships,
}: Pick<
  PersonRelationshipSectionProps,
  "focalPerson" | "people" | "relationships"
>) {
  const directRelationships = relationships.filter(
    (relationship) =>
      relationship.sourcePersonId === focalPerson.id ||
      relationship.targetPersonId === focalPerson.id,
  );

  if (directRelationships.length === 0) {
    return (
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Chưa có quan hệ trực tiếp.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {directRelationships.map((relationship) => {
        const otherPersonId = getOtherPersonId(relationship, focalPerson.id);
        return (
          <div
            className="rounded-xl border border-border bg-background px-3 py-2"
            key={relationship.id}
          >
            <p className="text-sm font-medium text-card-foreground">
              {getPersonName(people, otherPersonId)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {getDirectRelationshipLabel(relationship, focalPerson.id)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function RelationshipIntentButtons({
  onSelect,
}: {
  onSelect: (intent: RelationshipIntent) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-2">
      <Button
        onClick={() => onSelect("parent")}
        type="button"
        variant="outline"
      >
        + Cha / mẹ
      </Button>
      <Button onClick={() => onSelect("child")} type="button" variant="outline">
        + Con
      </Button>
      <Button
        onClick={() => onSelect("partner")}
        type="button"
        variant="outline"
      >
        + Hôn phối
      </Button>
    </div>
  );
}

export function PersonRelationshipSection({
  createParentChildRelationship,
  createPartnership,
  focalPerson,
  onChanged,
  people,
  readOnly,
  relationships,
}: PersonRelationshipSectionProps) {
  const [intent, setIntent] = useState<RelationshipIntent | null>(null);
  const [targetPersonId, setTargetPersonId] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const proposal = useMemo(() => {
    if (!intent || !targetPersonId) return null;
    return buildRelationshipProposal(focalPerson.id, targetPersonId, intent);
  }, [focalPerson.id, intent, targetPersonId]);

  const validationError = useMemo(() => {
    if (!proposal) return null;
    return validateRelationshipProposal(relationships, proposal);
  }, [proposal, relationships]);

  function startIntent(nextIntent: RelationshipIntent) {
    setIntent(nextIntent);
    setTargetPersonId("");
    setServerError(null);
  }

  function cancelIntent() {
    setIntent(null);
    setTargetPersonId("");
    setServerError(null);
  }

  async function saveRelationship() {
    if (!proposal || validationError) return;

    setSaving(true);
    setServerError(null);
    const result = await runCreateRelationship(
      proposal,
      createParentChildRelationship,
      createPartnership,
    );
    setSaving(false);

    if (!result.ok) {
      setServerError(result.message);
      return;
    }

    cancelIntent();
    onChanged(focalPerson.id);
  }

  const availablePeople = people.filter(
    (person) => person.id !== focalPerson.id,
  );

  return (
    <section className="mt-6 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Quan hệ trực tiếp
      </p>
      <DirectRelationshipList
        focalPerson={focalPerson}
        people={people}
        relationships={relationships}
      />

      {readOnly ? null : intent ? (
        <div className="mt-4 rounded-2xl border border-border bg-background p-3">
          <p className="text-sm font-semibold text-card-foreground">
            {getIntentLabel(intent)}
          </p>
          <label className="mt-3 block text-sm font-medium text-card-foreground">
            Chọn người
            <select
              className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              onChange={(event) => {
                setTargetPersonId(event.target.value);
                setServerError(null);
              }}
              value={targetPersonId}
            >
              <option value="">Chọn một người…</option>
              {availablePeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName} · {formatYears(person)}
                </option>
              ))}
            </select>
          </label>

          {validationError || serverError ? (
            <p aria-live="polite" className="mt-2 text-sm text-destructive">
              {validationError ?? serverError}
            </p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <Button
              disabled={!proposal || Boolean(validationError) || saving}
              onClick={saveRelationship}
              type="button"
            >
              {saving ? "Đang lưu…" : "Tạo quan hệ"}
            </Button>
            <Button
              disabled={saving}
              onClick={cancelIntent}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <RelationshipIntentButtons onSelect={startIntent} />
      )}

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Chỉ lưu quan hệ gốc cha/mẹ–con hoặc hôn phối. Cách xưng hô được suy ra
        từ đường đi trong gia phả.
      </p>
    </section>
  );
}

function RelationshipEndpoints({
  people,
  relationship,
}: Pick<RelationshipInspectorProps, "people" | "relationship">) {
  const sourceName = getPersonName(people, relationship.sourcePersonId);
  const targetName = getPersonName(people, relationship.targetPersonId);

  if (relationship.kind === "partnership") {
    return (
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        {sourceName} ↔ {targetName}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2 text-sm">
      <p>
        <span className="text-muted-foreground">Cha / mẹ:</span>{" "}
        <strong className="text-card-foreground">{sourceName}</strong>
      </p>
      <p>
        <span className="text-muted-foreground">Con:</span>{" "}
        <strong className="text-card-foreground">{targetName}</strong>
      </p>
    </div>
  );
}

export function RelationshipInspector({
  onChanged,
  people,
  readOnly,
  relationship,
  removeRelationship,
}: RelationshipInspectorProps) {
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const title =
    relationship.kind === "partnership" ? "Hôn phối" : "Cha / mẹ → con";

  async function handleRemove() {
    if (!removeRelationship) return;

    const confirmed = window.confirm(
      "Xóa quan hệ này? Hai hồ sơ người sẽ được giữ nguyên.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setErrorMessage(null);
    const result = await removeRelationship({
      relationshipId: relationship.id,
    });
    setDeleting(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    onChanged(relationship.sourcePersonId);
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        Relationship
      </p>
      <h2 className="font-display mt-1 text-3xl text-card-foreground">
        {title}
      </h2>
      <RelationshipEndpoints people={people} relationship={relationship} />

      <p className="mt-5 rounded-xl bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
        ID: {relationship.id}
      </p>

      {errorMessage ? (
        <p aria-live="polite" className="mt-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {readOnly ? null : (
        <Button
          className="mt-5 w-full"
          disabled={deleting}
          onClick={handleRemove}
          type="button"
          variant="destructive"
        >
          {deleting ? "Đang xóa…" : "Xóa quan hệ"}
        </Button>
      )}
    </div>
  );
}
