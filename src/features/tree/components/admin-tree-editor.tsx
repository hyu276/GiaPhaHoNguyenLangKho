"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  useNodesState,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { PersonEditorForm } from "@/features/tree/components/person-editor-form";
import {
  PersonRelationshipSection,
  RelationshipInspector,
  type CreateParentChildRelationship,
  type CreatePartnership,
  type RemoveRelationship,
} from "@/features/tree/components/relationship-editor-panel";
import type {
  CreatePersonInput,
  PersonSex,
  PersonStateInput,
  PersonVisibility,
  UpdatePersonInput,
} from "@/features/tree/person-input";
import {
  getAutoLayoutPositions,
  getBranchPersonIds,
  getFallbackLayoutPositions,
  type LayoutPosition,
} from "@/features/tree/tree-layout";
import {
  filterPeople,
  getDirectRelativeIds,
  getHiddenBranchIds,
  type ArchiveFilter as ArchiveFilterValue,
  type LifeFilter,
  type VisibilityFilter,
} from "@/features/tree/tree-navigation";

export type EditorPerson = {
  id: string;
  displayName: string;
  description: string | null;
  birthYear: number | null;
  deathYear: number | null;
  sex: PersonSex | null;
  visibility: PersonVisibility;
  archivedAt: string | null;
  position: { x: number; y: number };
};

export type EditorRelationship = {
  id: string;
  kind: "parent_child" | "partnership";
  sourcePersonId: string;
  targetPersonId: string;
};

export type SaveLayoutInput = {
  personId: string;
  positionX: number;
  positionY: number;
};

export type SaveLayoutResult = { ok: true } | { ok: false; message: string };
type PersonMutationResult =
  { ok: true; personId: string } | { ok: false; message: string };
type SaveLayouts = (inputs: SaveLayoutInput[]) => Promise<SaveLayoutResult>;
type CreatePerson = (input: CreatePersonInput) => Promise<PersonMutationResult>;
type UpdatePerson = (input: UpdatePersonInput) => Promise<PersonMutationResult>;
type PersonStateMutation = (
  input: PersonStateInput,
) => Promise<PersonMutationResult>;

type AdminTreeEditorProps = {
  archivePerson: PersonStateMutation | undefined;
  people: EditorPerson[];
  relationships: EditorRelationship[];
  readOnly: boolean;
  saveLayouts: SaveLayouts | undefined;
  createParentChildRelationship: CreateParentChildRelationship | undefined;
  createPartnership: CreatePartnership | undefined;
  createPerson: CreatePerson | undefined;
  removeRelationship: RemoveRelationship | undefined;
  restorePerson: PersonStateMutation | undefined;
  updatePerson: UpdatePerson | undefined;
};

type PersonNodeData = {
  archived: boolean;
  displayName: string;
  locked: boolean;
  years: string;
  visibility: PersonVisibility;
};

type PersonNode = Node<PersonNodeData, "person">;
type RelationshipEdge = Edge<{ kind: EditorRelationship["kind"] }>;
type PersonFormMode = "create" | "edit" | null;

type LayoutHistoryEntry = {
  before: Map<string, LayoutPosition>;
  after: Map<string, LayoutPosition>;
};

type SaveState =
  | { status: "idle" }
  | { status: "saving"; personId: string }
  | { status: "saved"; personId: string }
  | { status: "error"; personId: string; message: string };

type SidebarProps = {
  archivePerson: PersonStateMutation | undefined;
  archivedCount: number;
  createParentChildRelationship: CreateParentChildRelationship | undefined;
  createPartnership: CreatePartnership | undefined;
  createPerson: CreatePerson | undefined;
  formMode: PersonFormMode;
  onCancelForm: () => void;
  onPersonStateChanged: (personId: string, archived: boolean) => void;
  onFocusPerson: (personId: string) => void;
  layoutCanRedo: boolean;
  layoutCanUndo: boolean;
  lockedPersonIds: ReadonlySet<string>;
  onAutoLayoutBranch: (personId: string) => void;
  onJumpToPerson: (personId: string) => void;
  onRedoLayout: () => void;
  onRelationshipChanged: (focusPersonId?: string) => void;
  onResetBranchLayout: (personId: string) => void;
  onResetPersonPosition: (personId: string) => void;
  onSaved: (personId: string) => void;
  onStartCreate: () => void;
  onStartEdit: () => void;
  onToggleBranch: (personId: string) => void;
  onToggleLayoutLock: (personId: string) => void;
  onUndoLayout: () => void;
  people: EditorPerson[];
  readOnly: boolean;
  relationships: EditorRelationship[];
  removeRelationship: RemoveRelationship | undefined;
  restorePerson: PersonStateMutation | undefined;
  selectedPerson: EditorPerson | null;
  selectedRelationship: EditorRelationship | null;
  selectedRelationshipCount: number;
  collapsedBranchIds: ReadonlySet<string>;
  updatePerson: UpdatePerson | undefined;
};

function isArchived(person: EditorPerson) {
  return person.archivedAt !== null;
}

function countArchivedPeople(people: EditorPerson[]) {
  return people.filter(isArchived).length;
}

function countConnectedRelationships(
  relationships: EditorRelationship[],
  personId: string,
) {
  return relationships.filter(
    (relationship) =>
      relationship.sourcePersonId === personId ||
      relationship.targetPersonId === personId,
  ).length;
}

function getVisibleRelationships(
  relationships: EditorRelationship[],
  visiblePeople: EditorPerson[],
) {
  const visiblePersonIds = new Set(visiblePeople.map((person) => person.id));
  return relationships.filter(
    (relationship) =>
      visiblePersonIds.has(relationship.sourcePersonId) &&
      visiblePersonIds.has(relationship.targetPersonId),
  );
}

function relationshipTouchesArchivedPerson(
  relationship: EditorRelationship,
  people: EditorPerson[],
) {
  const archivedPersonIds = new Set(
    people.filter(isArchived).map((person) => person.id),
  );
  return (
    archivedPersonIds.has(relationship.sourcePersonId) ||
    archivedPersonIds.has(relationship.targetPersonId)
  );
}

function formatYears(person: EditorPerson) {
  const birth = person.birthYear?.toString() ?? "?";
  const death = person.deathYear?.toString() ?? "nay";
  return `${birth} – ${death}`;
}

function getStatusMessage(readOnly: boolean, saveState: SaveState) {
  if (readOnly) return "Chế độ spectator: chỉ xem";

  switch (saveState.status) {
    case "saving":
      return "Đang lưu bố cục…";
    case "saved":
      return "Đã lưu bố cục";
    case "error":
      return saveState.message;
    default:
      return "Chọn một người để xem hồ sơ hoặc kéo để đổi vị trí";
  }
}

function getEmptyDescription(readOnly: boolean) {
  return readOnly
    ? "Chọn một người trên sơ đồ để xem thông tin."
    : "Chọn một người để xem/sửa hồ sơ, hoặc thêm người mới.";
}

function PersonNodeCard({ data, selected }: NodeProps<PersonNode>) {
  return (
    <div
      className={`min-w-48 rounded-2xl border bg-card px-4 py-3 shadow-sm transition-[transform,opacity] ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      } ${data.archived ? "border-dashed opacity-65" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <p className="text-sm font-semibold text-card-foreground">
        {data.displayName}
      </p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{data.years}</span>
        <span aria-hidden="true">·</span>
        <span>{data.visibility === "private" ? "Riêng tư" : "Công khai"}</span>
        {data.archived ? (
          <>
            <span aria-hidden="true">·</span>
            <span>Đã lưu trữ</span>
          </>
        ) : null}
        {data.locked ? (
          <>
            <span aria-hidden="true">·</span>
            <span>Khóa vị trí</span>
          </>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = {
  person: PersonNodeCard,
};

function createNodes(
  people: EditorPerson[],
  lockedPersonIds: ReadonlySet<string>,
  positions?: ReadonlyMap<string, LayoutPosition>,
): PersonNode[] {
  return people.map((person) => {
    const locked = lockedPersonIds.has(person.id);

    return {
      id: person.id,
      type: "person",
      position: positions?.get(person.id) ?? person.position,
      deletable: false,
      draggable: !isArchived(person) && !locked,
      data: {
        archived: isArchived(person),
        displayName: person.displayName,
        locked,
        years: formatYears(person),
        visibility: person.visibility,
      },
    };
  });
}

function createEdges(relationships: EditorRelationship[]): RelationshipEdge[] {
  return relationships.map((relationship) => {
    const edge: RelationshipEdge = {
      id: relationship.id,
      source: relationship.sourcePersonId,
      target: relationship.targetPersonId,
      type: "smoothstep",
      data: { kind: relationship.kind },
      animated: false,
      ariaLabel:
        relationship.kind === "partnership"
          ? "Quan hệ hôn phối"
          : "Quan hệ cha mẹ con",
      deletable: false,
    };

    if (relationship.kind === "partnership") {
      return {
        ...edge,
        label: "Hôn phối",
        style: { strokeDasharray: "6 5" },
      };
    }

    return {
      ...edge,
      markerEnd: { type: MarkerType.ArrowClosed },
    };
  });
}

function getVisibilityLabel(visibility: PersonVisibility) {
  return visibility === "private" ? "Riêng tư" : "Công khai";
}

function EmptySelection({ readOnly }: { readOnly: boolean }) {
  return (
    <p className="mt-4 text-sm leading-6 text-muted-foreground">
      {getEmptyDescription(readOnly)}
    </p>
  );
}

type TreeFilterPanelProps = {
  archiveFilter: ArchiveFilterValue;
  lifeFilter: LifeFilter;
  matchCount: number;
  onArchiveFilterChange: (value: ArchiveFilterValue) => void;
  onClear: () => void;
  onLifeFilterChange: (value: LifeFilter) => void;
  onQueryChange: (value: string) => void;
  onVisibilityFilterChange: (value: VisibilityFilter) => void;
  query: string;
  readOnly: boolean;
  visibilityFilter: VisibilityFilter;
};

function TreeFilterPanel({
  archiveFilter,
  lifeFilter,
  matchCount,
  onArchiveFilterChange,
  onClear,
  onLifeFilterChange,
  onQueryChange,
  onVisibilityFilterChange,
  query,
  readOnly,
  visibilityFilter,
}: TreeFilterPanelProps) {
  return (
    <div className="absolute left-4 top-16 z-10 w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur">
      <label className="block text-xs font-semibold text-card-foreground">
        Tìm theo tên
        <input
          className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Nhập họ tên…"
          type="search"
          value={query}
        />
      </label>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          Sinh trạng
          <select
            className="mt-1 w-full rounded-xl border border-input bg-background px-2 py-2 text-xs text-foreground"
            onChange={(event) =>
              onLifeFilterChange(event.target.value as LifeFilter)
            }
            value={lifeFilter}
          >
            <option value="all">Tất cả</option>
            <option value="living">Còn sống</option>
            <option value="deceased">Đã mất</option>
          </select>
        </label>

        <label className="text-xs font-medium text-muted-foreground">
          Hiển thị
          <select
            className="mt-1 w-full rounded-xl border border-input bg-background px-2 py-2 text-xs text-foreground"
            onChange={(event) =>
              onVisibilityFilterChange(event.target.value as VisibilityFilter)
            }
            value={visibilityFilter}
          >
            <option value="all">Tất cả</option>
            <option value="public">Công khai</option>
            <option value="private">Riêng tư</option>
          </select>
        </label>
      </div>

      {readOnly ? null : (
        <label className="mt-2 block text-xs font-medium text-muted-foreground">
          Lưu trữ
          <select
            className="mt-1 w-full rounded-xl border border-input bg-background px-2 py-2 text-xs text-foreground"
            onChange={(event) =>
              onArchiveFilterChange(event.target.value as ArchiveFilterValue)
            }
            value={archiveFilter}
          >
            <option value="active">Đang hoạt động</option>
            <option value="all">Tất cả</option>
            <option value="archived">Đã lưu trữ</option>
          </select>
        </label>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span aria-live="polite" className="text-xs text-muted-foreground">
          {matchCount} người phù hợp
        </span>
        <Button onClick={onClear} size="sm" type="button" variant="ghost">
          Xóa lọc
        </Button>
      </div>
    </div>
  );
}

function RelativeGroup({
  label,
  onJumpToPerson,
  people,
  personIds,
}: {
  label: string;
  onJumpToPerson: (personId: string) => void;
  people: EditorPerson[];
  personIds: string[];
}) {
  if (personIds.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {personIds.map((personId) => {
          const person = people.find((candidate) => candidate.id === personId);
          if (!person) return null;
          return (
            <Button
              key={personId}
              onClick={() => onJumpToPerson(personId)}
              size="sm"
              type="button"
              variant="outline"
            >
              {person.displayName}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function BranchNavigationControls({
  collapsed,
  onFocusPerson,
  onJumpToPerson,
  onToggleBranch,
  people,
  person,
  relationships,
}: {
  collapsed: boolean;
  onFocusPerson: (personId: string) => void;
  onJumpToPerson: (personId: string) => void;
  onToggleBranch: (personId: string) => void;
  people: EditorPerson[];
  person: EditorPerson;
  relationships: EditorRelationship[];
}) {
  const relatives = getDirectRelativeIds(relationships, person.id);

  return (
    <section className="mt-5 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Điều hướng nhánh
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          onClick={() => onFocusPerson(person.id)}
          type="button"
          variant="outline"
        >
          Focus người
        </Button>
        <Button
          onClick={() => onToggleBranch(person.id)}
          type="button"
          variant="outline"
        >
          {collapsed ? "Mở nhánh con" : "Thu nhánh con"}
        </Button>
      </div>
      <RelativeGroup
        label="Cha / mẹ"
        onJumpToPerson={onJumpToPerson}
        people={people}
        personIds={relatives.parents}
      />
      <RelativeGroup
        label="Con"
        onJumpToPerson={onJumpToPerson}
        people={people}
        personIds={relatives.children}
      />
      <RelativeGroup
        label="Hôn phối"
        onJumpToPerson={onJumpToPerson}
        people={people}
        personIds={relatives.partners}
      />
    </section>
  );
}

function LayoutAdministrationControls({
  canRedo,
  canUndo,
  locked,
  onAutoLayoutBranch,
  onRedo,
  onResetBranch,
  onResetPerson,
  onToggleLock,
  onUndo,
  person,
  readOnly,
}: {
  canRedo: boolean;
  canUndo: boolean;
  locked: boolean;
  onAutoLayoutBranch: (personId: string) => void;
  onRedo: () => void;
  onResetBranch: (personId: string) => void;
  onResetPerson: (personId: string) => void;
  onToggleLock: (personId: string) => void;
  onUndo: () => void;
  person: EditorPerson;
  readOnly: boolean;
}) {
  if (readOnly) return null;

  const archived = isArchived(person);

  return (
    <section className="mt-5 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Quản trị bố cục
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Khóa vị trí áp dụng trong phiên editor. Reset và auto-layout chỉ thay
        đổi tọa độ trình bày, không thay đổi quan hệ gia phả.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          disabled={archived}
          onClick={() => onToggleLock(person.id)}
          type="button"
          variant="outline"
        >
          {locked ? "Mở khóa vị trí" : "Khóa vị trí"}
        </Button>
        <Button
          disabled={archived || locked}
          onClick={() => onResetPerson(person.id)}
          type="button"
          variant="outline"
        >
          Đặt lại vị trí
        </Button>
        <Button
          disabled={archived}
          onClick={() => onResetBranch(person.id)}
          type="button"
          variant="outline"
        >
          Đặt lại nhánh
        </Button>
        <Button
          disabled={archived}
          onClick={() => onAutoLayoutBranch(person.id)}
          type="button"
          variant="outline"
        >
          Tự sắp xếp nhánh
        </Button>
        <Button
          disabled={!canUndo}
          onClick={onUndo}
          type="button"
          variant="outline"
        >
          Hoàn tác vị trí
        </Button>
        <Button
          disabled={!canRedo}
          onClick={onRedo}
          type="button"
          variant="outline"
        >
          Làm lại vị trí
        </Button>
      </div>
    </section>
  );
}

function SelectedPersonSummary({
  onStartEdit,
  readOnly,
  selectedPerson,
}: {
  onStartEdit: () => void;
  readOnly: boolean;
  selectedPerson: EditorPerson | null;
}) {
  if (!selectedPerson) return <EmptySelection readOnly={readOnly} />;

  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl text-card-foreground">
            {selectedPerson.displayName}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatYears(selectedPerson)}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {getVisibilityLabel(selectedPerson.visibility)}
        </span>
      </div>

      <p className="mt-6 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {selectedPerson.description ?? "Chưa có mô tả."}
      </p>

      {readOnly || isArchived(selectedPerson) ? null : (
        <Button className="mt-6 w-full" onClick={onStartEdit} variant="outline">
          Sửa hồ sơ
        </Button>
      )}
    </div>
  );
}

function getPersonStateMutation(
  archived: boolean,
  archivePerson: PersonStateMutation | undefined,
  restorePerson: PersonStateMutation | undefined,
) {
  return archived ? restorePerson : archivePerson;
}

function getArchiveTitle(archived: boolean) {
  return archived ? "Hồ sơ đã lưu trữ" : "Ảnh hưởng khi lưu trữ";
}

function getArchiveDescription(archived: boolean, relationshipCount: number) {
  if (archived) {
    return "Hồ sơ đang bị ẩn khỏi chế độ xem thông thường. Quan hệ và vị trí sơ đồ vẫn được giữ nguyên.";
  }

  return `${relationshipCount} quan hệ trực tiếp và vị trí sơ đồ sẽ được giữ nguyên; chỉ hồ sơ bị ẩn khỏi chế độ xem thông thường.`;
}

function getArchiveButtonLabel(archived: boolean, saving: boolean) {
  if (saving) return "Đang xử lý…";
  return archived ? "Khôi phục hồ sơ" : "Lưu trữ hồ sơ";
}

function confirmArchive(
  nextArchived: boolean,
  person: EditorPerson,
  relationshipCount: number,
) {
  if (!nextArchived) return true;

  return window.confirm(
    `Lưu trữ ${person.displayName}? ${relationshipCount} quan hệ trực tiếp và vị trí sơ đồ sẽ được giữ nguyên.`,
  );
}

function PersonArchiveControls({
  archivePerson,
  onChanged,
  person,
  relationshipCount,
  restorePerson,
}: {
  archivePerson: PersonStateMutation | undefined;
  onChanged: (personId: string, archived: boolean) => void;
  person: EditorPerson;
  relationshipCount: number;
  restorePerson: PersonStateMutation | undefined;
}) {
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const archived = isArchived(person);
  const mutation = getPersonStateMutation(
    archived,
    archivePerson,
    restorePerson,
  );

  async function submit(nextArchived: boolean) {
    if (!mutation) return;
    if (!confirmArchive(nextArchived, person, relationshipCount)) return;

    setSaving(true);
    setErrorMessage(null);
    const result = await mutation({ personId: person.id });
    setSaving(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    onChanged(person.id, nextArchived);
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-muted/35 p-3">
      <p className="text-xs font-semibold text-card-foreground">
        {getArchiveTitle(archived)}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {getArchiveDescription(archived, relationshipCount)}
      </p>
      <Button
        className="mt-3 w-full"
        disabled={saving || !mutation}
        onClick={() => submit(!archived)}
        type="button"
        variant="outline"
      >
        {getArchiveButtonLabel(archived, saving)}
      </Button>
      {errorMessage ? (
        <p className="mt-2 text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}

function CreatePersonPanel({
  createPerson,
  onCancelForm,
  onSaved,
}: Pick<SidebarProps, "createPerson" | "onCancelForm" | "onSaved">) {
  async function handleSave(input: CreatePersonInput) {
    if (!createPerson) {
      return {
        ok: false as const,
        message: "Tài khoản này không thể thêm người.",
      };
    }

    return createPerson(input);
  }

  return (
    <PersonEditorForm
      onCancel={onCancelForm}
      onSave={handleSave}
      onSaved={onSaved}
      person={null}
    />
  );
}

function EditPersonPanel({
  onCancelForm,
  onSaved,
  selectedPerson,
  updatePerson,
}: Pick<
  SidebarProps,
  "onCancelForm" | "onSaved" | "selectedPerson" | "updatePerson"
>) {
  async function handleSave(input: CreatePersonInput) {
    if (!updatePerson || !selectedPerson) {
      return { ok: false as const, message: "Chưa chọn người để cập nhật." };
    }

    return updatePerson({ ...input, personId: selectedPerson.id });
  }

  return (
    <PersonEditorForm
      key={selectedPerson?.id ?? "missing"}
      onCancel={onCancelForm}
      onSave={handleSave}
      onSaved={onSaved}
      person={selectedPerson}
    />
  );
}

function SelectedPersonDetails(props: SidebarProps) {
  if (!props.selectedPerson) return null;

  const relationshipReadOnly =
    props.readOnly || isArchived(props.selectedPerson);

  return (
    <>
      <BranchNavigationControls
        collapsed={props.collapsedBranchIds.has(props.selectedPerson.id)}
        onFocusPerson={props.onFocusPerson}
        onJumpToPerson={props.onJumpToPerson}
        onToggleBranch={props.onToggleBranch}
        people={props.people}
        person={props.selectedPerson}
        relationships={props.relationships}
      />
      <LayoutAdministrationControls
        canRedo={props.layoutCanRedo}
        canUndo={props.layoutCanUndo}
        locked={props.lockedPersonIds.has(props.selectedPerson.id)}
        onAutoLayoutBranch={props.onAutoLayoutBranch}
        onRedo={props.onRedoLayout}
        onResetBranch={props.onResetBranchLayout}
        onResetPerson={props.onResetPersonPosition}
        onToggleLock={props.onToggleLayoutLock}
        onUndo={props.onUndoLayout}
        person={props.selectedPerson}
        readOnly={props.readOnly}
      />
      {props.readOnly ? null : (
        <PersonArchiveControls
          archivePerson={props.archivePerson}
          onChanged={props.onPersonStateChanged}
          person={props.selectedPerson}
          relationshipCount={props.selectedRelationshipCount}
          restorePerson={props.restorePerson}
        />
      )}
      <PersonRelationshipSection
        createParentChildRelationship={props.createParentChildRelationship}
        createPartnership={props.createPartnership}
        focalPerson={props.selectedPerson}
        onChanged={props.onRelationshipChanged}
        people={props.people}
        readOnly={relationshipReadOnly}
        relationships={props.relationships}
      />
    </>
  );
}

function DefaultEditorSidebar(props: SidebarProps) {
  return (
    <aside className="rounded-3xl border border-border bg-card p-5">
      {props.readOnly ? null : (
        <Button className="w-full" onClick={props.onStartCreate}>
          Thêm người
        </Button>
      )}
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Đang chọn
      </p>
      <SelectedPersonSummary
        onStartEdit={props.onStartEdit}
        readOnly={props.readOnly}
        selectedPerson={props.selectedPerson}
      />
      <SelectedPersonDetails {...props} />
    </aside>
  );
}

function EditorSidebar(props: SidebarProps) {
  if (props.selectedRelationship) {
    return (
      <aside className="rounded-3xl border border-border bg-card p-5">
        <RelationshipInspector
          onChanged={props.onRelationshipChanged}
          people={props.people}
          readOnly={
            props.readOnly ||
            relationshipTouchesArchivedPerson(
              props.selectedRelationship,
              props.people,
            )
          }
          relationship={props.selectedRelationship}
          removeRelationship={props.removeRelationship}
        />
      </aside>
    );
  }

  if (props.formMode === "create") {
    return (
      <aside className="rounded-3xl border border-border bg-card p-5">
        <CreatePersonPanel
          createPerson={props.createPerson}
          onCancelForm={props.onCancelForm}
          onSaved={props.onSaved}
        />
      </aside>
    );
  }

  if (props.formMode === "edit") {
    return (
      <aside className="rounded-3xl border border-border bg-card p-5">
        <EditPersonPanel
          onCancelForm={props.onCancelForm}
          onSaved={props.onSaved}
          selectedPerson={props.selectedPerson}
          updatePerson={props.updatePerson}
        />
      </aside>
    );
  }

  return <DefaultEditorSidebar {...props} />;
}

function canStartLayoutMutation(
  readOnly: boolean,
  saveLayouts: SaveLayouts | undefined,
  requestedCount: number,
  mutationInFlight: boolean,
) {
  if (readOnly) return false;
  if (!saveLayouts) return false;
  if (requestedCount === 0) return false;
  return !mutationInFlight;
}

export function AdminTreeEditor({
  archivePerson,
  people,
  relationships,
  readOnly,
  saveLayouts,
  createParentChildRelationship,
  createPartnership,
  createPerson,
  removeRelationship,
  restorePerson,
  updatePerson,
}: AdminTreeEditorProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [lifeFilter, setLifeFilter] = useState<LifeFilter>("all");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [archiveFilter, setArchiveFilter] =
    useState<ArchiveFilterValue>("active");
  const [collapsedBranchIds, setCollapsedBranchIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lockedPersonIds, setLockedPersonIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [layoutHistory, setLayoutHistory] = useState<LayoutHistoryEntry[]>([]);
  const [layoutFuture, setLayoutFuture] = useState<LayoutHistoryEntry[]>([]);
  const flowInstance = useRef<ReactFlowInstance<
    PersonNode,
    RelationshipEdge
  > | null>(null);
  const layoutMutationInFlight = useRef(false);
  const filteredPeople = useMemo(
    () =>
      filterPeople(people, {
        query,
        life: lifeFilter,
        visibility: visibilityFilter,
        archive: readOnly ? "active" : archiveFilter,
      }),
    [archiveFilter, lifeFilter, people, query, readOnly, visibilityFilter],
  );
  const hiddenBranchIds = useMemo(
    () => getHiddenBranchIds(relationships, collapsedBranchIds),
    [collapsedBranchIds, relationships],
  );
  const visiblePeople = useMemo(
    () => filteredPeople.filter((person) => !hiddenBranchIds.has(person.id)),
    [filteredPeople, hiddenBranchIds],
  );
  const visibleRelationships = useMemo(
    () => getVisibleRelationships(relationships, visiblePeople),
    [relationships, visiblePeople],
  );
  const initialNodes = useMemo(
    () => createNodes(visiblePeople, lockedPersonIds),
    [lockedPersonIds, visiblePeople],
  );
  const edges = useMemo(
    () => createEdges(visibleRelationships),
    [visibleRelationships],
  );
  const [nodes, setNodes, onNodesChange] =
    useNodesState<PersonNode>(initialNodes);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<
    string | null
  >(null);
  const [formMode, setFormMode] = useState<PersonFormMode>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const persistedPositions = useRef(
    new Map(people.map((person) => [person.id, person.position])),
  );

  const selectedPerson =
    people.find((person) => person.id === selectedPersonId) ?? null;
  const selectedRelationship =
    visibleRelationships.find(
      (relationship) => relationship.id === selectedRelationshipId,
    ) ?? null;
  const archivedCount = countArchivedPeople(people);
  const selectedRelationshipCount = selectedPerson
    ? countConnectedRelationships(relationships, selectedPerson.id)
    : 0;
  const statusMessage = getStatusMessage(readOnly, saveState);

  useEffect(() => {
    persistedPositions.current = new Map(
      people.map((person) => [person.id, person.position]),
    );
  }, [people]);

  useEffect(() => {
    setNodes(
      createNodes(visiblePeople, lockedPersonIds, persistedPositions.current),
    );
  }, [lockedPersonIds, setNodes, visiblePeople]);

  const applyLayoutPositions = useCallback(
    async (
      requestedPositions: ReadonlyMap<string, LayoutPosition>,
      recordHistory = true,
    ) => {
      if (!saveLayouts) return false;
      if (
        !canStartLayoutMutation(
          readOnly,
          saveLayouts,
          requestedPositions.size,
          layoutMutationInFlight.current,
        )
      ) {
        return false;
      }

      const before = new Map<string, LayoutPosition>();
      const after = new Map<string, LayoutPosition>();

      requestedPositions.forEach((position, personId) => {
        const person = people.find((candidate) => candidate.id === personId);
        if (!person || isArchived(person)) return;

        const currentPosition =
          persistedPositions.current.get(personId) ?? person.position;
        if (
          currentPosition.x === position.x &&
          currentPosition.y === position.y
        ) {
          return;
        }

        before.set(personId, currentPosition);
        after.set(personId, position);
      });

      if (after.size === 0) return true;

      const firstPersonId = after.keys().next().value as string;
      layoutMutationInFlight.current = true;
      setSaveState({ status: "saving", personId: firstPersonId });
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const position = after.get(node.id);
          return position ? { ...node, position } : node;
        }),
      );

      const result = await saveLayouts(
        [...after].map(([personId, position]) => ({
          personId,
          positionX: position.x,
          positionY: position.y,
        })),
      );

      if (!result.ok) {
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            const position = before.get(node.id);
            return position ? { ...node, position } : node;
          }),
        );
        setSaveState({
          status: "error",
          personId: firstPersonId,
          message: result.message,
        });
        layoutMutationInFlight.current = false;
        return false;
      }

      after.forEach((position, personId) => {
        persistedPositions.current.set(personId, position);
      });

      if (recordHistory) {
        setLayoutHistory((current) =>
          [...current, { before, after }].slice(-50),
        );
        setLayoutFuture([]);
      }

      setSaveState({ status: "saved", personId: firstPersonId });
      layoutMutationInFlight.current = false;
      return true;
    },
    [people, readOnly, saveLayouts, setNodes],
  );

  const persistNodePosition = useCallback(
    (node: PersonNode) => {
      if (node.data.archived || node.data.locked) return;
      void applyLayoutPositions(new Map([[node.id, node.position]]));
    },
    [applyLayoutPositions],
  );

  function handleNodeSelect(personId: string) {
    setSelectedPersonId(personId);
    setSelectedRelationshipId(null);
    setFormMode(null);
  }

  function handleEdgeSelect(relationshipId: string) {
    setSelectedPersonId(null);
    setSelectedRelationshipId(relationshipId);
    setFormMode(null);
  }

  function handleSaved(personId: string) {
    setSelectedPersonId(personId);
    setSelectedRelationshipId(null);
    setFormMode(null);
    router.refresh();
  }

  function handleRelationshipChanged(focusPersonId?: string) {
    setSelectedRelationshipId(null);
    setSelectedPersonId(focusPersonId ?? null);
    setFormMode(null);
    router.refresh();
  }

  function handlePersonStateChanged(personId: string, archived: boolean) {
    setSelectedRelationshipId(null);
    setSelectedPersonId(
      archived && archiveFilter === "active" ? null : personId,
    );
    setFormMode(null);
    router.refresh();
  }

  function focusPerson(personId: string) {
    handleNodeSelect(personId);
    flowInstance.current?.fitView({
      nodes: [{ id: personId }],
      duration: 250,
      maxZoom: 1.25,
      padding: 1.2,
    });
  }

  function revealAndFocusPerson(personId: string) {
    const person = people.find((candidate) => candidate.id === personId);
    if (!person) return;

    setQuery("");
    setLifeFilter("all");
    setVisibilityFilter("all");
    setArchiveFilter(isArchived(person) ? "all" : "active");
    setCollapsedBranchIds(new Set());
    handleNodeSelect(personId);
    window.requestAnimationFrame(() => {
      flowInstance.current?.fitView({
        nodes: [{ id: personId }],
        duration: 250,
        maxZoom: 1.25,
        padding: 1.2,
      });
    });
  }

  function toggleBranch(personId: string) {
    setCollapsedBranchIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  function toggleLayoutLock(personId: string) {
    const person = people.find((candidate) => candidate.id === personId);
    if (!person || isArchived(person)) return;

    setLockedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  function removeArchivedPositions(positions: Map<string, LayoutPosition>) {
    people.forEach((person) => {
      if (isArchived(person)) positions.delete(person.id);
    });
    return positions;
  }

  function resetPersonPosition(personId: string) {
    const positions = getFallbackLayoutPositions(
      people,
      new Set([personId]),
      lockedPersonIds,
    );
    void applyLayoutPositions(removeArchivedPositions(positions));
  }

  function resetBranchLayout(personId: string) {
    const branchIds = getBranchPersonIds(relationships, personId);
    const positions = getFallbackLayoutPositions(
      people,
      branchIds,
      lockedPersonIds,
    );
    void applyLayoutPositions(removeArchivedPositions(positions));
  }

  function autoLayoutBranch(personId: string) {
    const positions = getAutoLayoutPositions(
      people,
      relationships,
      personId,
      persistedPositions.current,
      lockedPersonIds,
    );
    void applyLayoutPositions(removeArchivedPositions(positions));
  }

  async function undoLayout() {
    const entry = layoutHistory.at(-1);
    if (!entry) return;

    const saved = await applyLayoutPositions(entry.before, false);
    if (!saved) return;

    setLayoutHistory((current) => current.slice(0, -1));
    setLayoutFuture((current) => [...current, entry].slice(-50));
  }

  async function redoLayout() {
    const entry = layoutFuture.at(-1);
    if (!entry) return;

    const saved = await applyLayoutPositions(entry.after, false);
    if (!saved) return;

    setLayoutFuture((current) => current.slice(0, -1));
    setLayoutHistory((current) => [...current, entry].slice(-50));
  }

  function clearFilters() {
    setQuery("");
    setLifeFilter("all");
    setVisibilityFilter("all");
    setArchiveFilter("active");
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="relative min-h-[65svh] overflow-hidden rounded-3xl border border-border bg-card">
        <ReactFlow<PersonNode, RelationshipEdge>
          nodes={nodes}
          onInit={(instance) => {
            flowInstance.current = instance;
          }}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgeClick={(_, edge) => handleEdgeSelect(edge.id)}
          onNodeClick={(_, node) => handleNodeSelect(node.id)}
          onNodeDragStop={(_, node) => {
            handleNodeSelect(node.id);
            persistNodePosition(node);
          }}
          nodesDraggable={!readOnly}
          nodesConnectable={false}
          edgesFocusable
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>

        <div
          aria-live="polite"
          className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-border bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur"
        >
          {statusMessage}
        </div>
        <TreeFilterPanel
          archiveFilter={archiveFilter}
          lifeFilter={lifeFilter}
          matchCount={visiblePeople.length}
          onArchiveFilterChange={setArchiveFilter}
          onClear={clearFilters}
          onLifeFilterChange={setLifeFilter}
          onQueryChange={setQuery}
          onVisibilityFilterChange={setVisibilityFilter}
          query={query}
          readOnly={readOnly}
          visibilityFilter={visibilityFilter}
        />
      </section>

      <EditorSidebar
        archivePerson={archivePerson}
        archivedCount={archivedCount}
        collapsedBranchIds={collapsedBranchIds}
        createParentChildRelationship={createParentChildRelationship}
        createPartnership={createPartnership}
        createPerson={createPerson}
        formMode={formMode}
        layoutCanRedo={layoutFuture.length > 0 && saveState.status !== "saving"}
        layoutCanUndo={
          layoutHistory.length > 0 && saveState.status !== "saving"
        }
        lockedPersonIds={lockedPersonIds}
        onAutoLayoutBranch={autoLayoutBranch}
        onCancelForm={() => setFormMode(null)}
        onFocusPerson={focusPerson}
        onJumpToPerson={revealAndFocusPerson}
        onPersonStateChanged={handlePersonStateChanged}
        onRedoLayout={() => void redoLayout()}
        onRelationshipChanged={handleRelationshipChanged}
        onResetBranchLayout={resetBranchLayout}
        onResetPersonPosition={resetPersonPosition}
        onSaved={handleSaved}
        onStartCreate={() => setFormMode("create")}
        onStartEdit={() => setFormMode("edit")}
        onToggleBranch={toggleBranch}
        onToggleLayoutLock={toggleLayoutLock}
        onUndoLayout={() => void undoLayout()}
        people={people}
        readOnly={readOnly}
        relationships={relationships}
        removeRelationship={removeRelationship}
        restorePerson={restorePerson}
        selectedPerson={selectedPerson}
        selectedRelationship={selectedRelationship}
        selectedRelationshipCount={selectedRelationshipCount}
        updatePerson={updatePerson}
      />
    </div>
  );
}
