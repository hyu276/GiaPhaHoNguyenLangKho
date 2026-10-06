/**
 * ADMIN_TREE_EDITOR
 *
 * Purpose: Provides the interactive genealogy canvas, contextual member drawer, filtering, layout, and relationship workflows.
 * Connections: React Flow, genealogy mutations, relationship editor, provenance panel, and persisted layout services.
 * Risk: High because this is the primary interactive editing surface for the genealogy graph.
 */
"use client";

import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useId,
  useState,
} from "react";
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
import { ProvenancePanel } from "@/features/tree/components/provenance-panel";
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
  revision: number;
  position: { x: number; y: number };
  layoutRevision: number | null;
};

export type EditorRelationship = {
  id: string;
  kind: "parent_child" | "partnership";
  sourcePersonId: string;
  targetPersonId: string;
  revision: number;
};

export type SaveLayoutInput = {
  personId: string;
  positionX: number;
  positionY: number;
  expectedRevision: number | null;
};

export type SaveLayoutResult =
  | { ok: true; revisions: Array<{ personId: string; revision: number }> }
  | { ok: false; message: string; kind?: "conflict" };
type PersonMutationResult =
  | { ok: true; personId: string; revision: number }
  | { ok: false; message: string; kind?: "conflict" };
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
  onDraftStateChange: (dirty: boolean, saving: boolean) => void;
  onClose: () => void;
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

function selectedRelationshipCount(
  selectedPerson: EditorPerson | null,
  relationships: EditorRelationship[],
) {
  if (!selectedPerson) return 0;
  return countConnectedRelationships(relationships, selectedPerson.id);
}

function editorWorkspaceClass(drawerOpen: boolean) {
  const base =
    "relative grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden";
  return drawerOpen ? `${base} md:grid-cols-[minmax(0,1fr)_24rem]` : base;
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
  if (readOnly) return "";

  switch (saveState.status) {
    case "saving":
      return "Đang lưu bố cục…";
    case "saved":
      return "Đã lưu bố cục";
    case "error":
      return saveState.message;
    default:
      return "";
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
      className={`min-w-48 select-none rounded-lg border bg-card px-4 py-3 ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      } ${data.archived ? "border-dashed opacity-65" : ""}`}
    >
      <Handle
        id="child"
        type="target"
        position={Position.Top}
        className="opacity-0"
      />
      <Handle
        id="partner-left-source"
        type="source"
        position={Position.Left}
        className="opacity-0"
      />
      <Handle
        id="partner-right-source"
        type="source"
        position={Position.Right}
        className="opacity-0"
      />
      <Handle
        id="partner-left-target"
        type="target"
        position={Position.Left}
        className="opacity-0"
      />
      <Handle
        id="partner-right-target"
        type="target"
        position={Position.Right}
        className="opacity-0"
      />
      <p className="text-sm font-semibold text-card-foreground">
        {data.displayName}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{data.years}</span>
        {data.visibility === "private" ? (
          <>
            <span aria-hidden="true">·</span>
            <span>Riêng tư</span>
          </>
        ) : null}
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
      <Handle
        id="parent"
        type="source"
        position={Position.Bottom}
        className="opacity-0"
      />
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
      ariaLabel:
        person.displayName +
        ", " +
        formatYears(person) +
        ", " +
        getVisibilityLabel(person.visibility),
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

function getPartnerHandles(
  relationship: EditorRelationship,
  positions: ReadonlyMap<string, LayoutPosition>,
) {
  const sourceX = positions.get(relationship.sourcePersonId)?.x ?? 0;
  const targetX = positions.get(relationship.targetPersonId)?.x ?? 0;
  return sourceX <= targetX
    ? {
        sourceHandle: "partner-right-source",
        targetHandle: "partner-left-target",
      }
    : {
        sourceHandle: "partner-left-source",
        targetHandle: "partner-right-target",
      };
}

function createEdges(
  relationships: EditorRelationship[],
  nodes: PersonNode[],
): RelationshipEdge[] {
  const positions = new Map(nodes.map((node) => [node.id, node.position]));
  return relationships.map((relationship) => {
    const partnerHandles = getPartnerHandles(relationship, positions);
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
      interactionWidth: 24,
    };

    if (relationship.kind === "partnership") {
      return {
        ...edge,
        ...partnerHandles,
        label: "Hôn phối",
        pathOptions: { borderRadius: 12, offset: 20 },
        style: {
          stroke: "var(--muted-foreground)",
          strokeWidth: 2,
          strokeDasharray: "6 5",
        },
        labelStyle: { fill: "var(--foreground)", fontSize: 11 },
        labelBgStyle: { fill: "var(--card)" },
      };
    }

    return {
      ...edge,
      sourceHandle: "parent",
      targetHandle: "child",
      pathOptions: { borderRadius: 12, offset: 24 },
      style: { stroke: "var(--muted-foreground)", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--muted-foreground)",
        width: 16,
        height: 16,
      },
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
  onStartCreate: () => void;
  onVisibilityFilterChange: (value: VisibilityFilter) => void;
  query: string;
  readOnly: boolean;
  statusMessage: string;
  visibilityFilter: VisibilityFilter;
};

function ToolbarStatus({ message }: { message: string }) {
  if (!message) return null;

  return (
    <span
      aria-live="polite"
      className="hidden text-xs text-muted-foreground md:inline"
    >
      {message}
    </span>
  );
}

function TreeFilterPanel({
  archiveFilter,
  lifeFilter,
  matchCount,
  onArchiveFilterChange,
  onClear,
  onLifeFilterChange,
  onQueryChange,
  onStartCreate,
  onVisibilityFilterChange,
  query,
  readOnly,
  statusMessage,
  visibilityFilter,
}: TreeFilterPanelProps) {
  const hasFilters =
    lifeFilter !== "all" ||
    visibilityFilter !== "all" ||
    (!readOnly && archiveFilter !== "active");

  return (
    <div className="relative z-40 shrink-0 flex flex-wrap items-center gap-2 border-b border-border bg-card px-2 py-2 sm:px-3">
      <label className="min-w-[13rem] flex-1">
        <span className="sr-only">Tìm thành viên</span>
        <input
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/20"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Tìm thành viên theo tên…"
          type="search"
          value={query}
        />
      </label>

      <details className="group">
        <summary className="flex h-9 cursor-pointer list-none items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted">
          Bộ lọc{hasFilters ? " · đang dùng" : ""}
        </summary>
        <div className="absolute left-2 top-full z-30 grid w-[min(16rem,calc(100vw-2rem))] sm:left-auto sm:right-3 gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
          <label className="text-xs font-medium text-muted-foreground">
            Tình trạng
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
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
            Quyền hiển thị
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
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

          {readOnly ? null : (
            <label className="text-xs font-medium text-muted-foreground">
              Hồ sơ
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                onChange={(event) =>
                  onArchiveFilterChange(
                    event.target.value as ArchiveFilterValue,
                  )
                }
                value={archiveFilter}
              >
                <option value="active">Đang sử dụng</option>
                <option value="all">Tất cả</option>
                <option value="archived">Đã lưu trữ</option>
              </select>
            </label>
          )}

          <Button onClick={onClear} size="sm" type="button" variant="outline">
            Đặt lại bộ lọc
          </Button>
        </div>
      </details>

      <span aria-live="polite" className="text-xs text-muted-foreground">
        {matchCount} thành viên
      </span>

      <ToolbarStatus message={statusMessage} />

      {readOnly ? null : (
        <Button className="ml-auto" onClick={onStartCreate} type="button">
          Thêm thành viên
        </Button>
      )}
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
        Người thân & nhánh
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          onClick={() => onFocusPerson(person.id)}
          type="button"
          variant="outline"
        >
          Đưa vào giữa
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
        Sắp xếp sơ đồ
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Các thao tác trong mục này chỉ thay đổi cách trình bày sơ đồ, không làm
        thay đổi quan hệ gia đình.
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
        {selectedPerson.visibility === "private" ? (
          <span className="text-xs font-medium text-muted-foreground">
            Riêng tư
          </span>
        ) : null}
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
    const result = await mutation({
      personId: person.id,
      expectedRevision: person.revision,
    });
    setSaving(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    onChanged(person.id, nextArchived);
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
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
  onDraftStateChange,
  onSaved,
}: Pick<
  SidebarProps,
  "createPerson" | "onCancelForm" | "onDraftStateChange" | "onSaved"
>) {
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
      onDraftStateChange={onDraftStateChange}
      onSave={handleSave}
      onSaved={onSaved}
      person={null}
    />
  );
}

function EditPersonPanel({
  onCancelForm,
  onDraftStateChange,
  onSaved,
  selectedPerson,
  updatePerson,
}: Pick<
  SidebarProps,
  | "onCancelForm"
  | "onDraftStateChange"
  | "onSaved"
  | "selectedPerson"
  | "updatePerson"
>) {
  async function handleSave(input: CreatePersonInput) {
    if (!updatePerson || !selectedPerson) {
      return { ok: false as const, message: "Chưa chọn người để cập nhật." };
    }

    return updatePerson({
      ...input,
      personId: selectedPerson.id,
      expectedRevision: selectedPerson.revision,
    });
  }

  return (
    <PersonEditorForm
      key={selectedPerson?.id ?? "missing"}
      onCancel={onCancelForm}
      onDraftStateChange={onDraftStateChange}
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
      <PersonRelationshipSection
        createParentChildRelationship={props.createParentChildRelationship}
        createPartnership={props.createPartnership}
        focalPerson={props.selectedPerson}
        onChanged={props.onRelationshipChanged}
        people={props.people}
        readOnly={relationshipReadOnly}
        relationships={props.relationships}
      />
      <ProvenancePanel
        key={`person-${props.selectedPerson.id}`}
        personId={props.selectedPerson.id}
        readOnly={props.readOnly}
        relationshipId={null}
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
    </>
  );
}

function EditorDrawer({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [title]);
  return (
    <aside
      aria-labelledby={titleId}
      className="absolute inset-0 z-30 min-h-0 overflow-y-auto overscroll-contain bg-card shadow-lg md:relative md:inset-auto md:z-auto md:w-auto md:border-l md:border-border md:shadow-none"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <h2
          id={titleId}
          ref={headingRef}
          tabIndex={-1}
          className="text-sm font-semibold text-card-foreground outline-none"
        >
          {title}
        </h2>
        <Button
          aria-label="Đóng bảng thông tin"
          onClick={onClose}
          size="sm"
          type="button"
          variant="ghost"
        >
          Đóng
        </Button>
      </div>
      <div className="p-4">{children}</div>
    </aside>
  );
}

function DefaultEditorSidebar(props: SidebarProps) {
  if (!props.selectedPerson) return null;

  return (
    <EditorDrawer onClose={props.onClose} title="Thông tin thành viên">
      <SelectedPersonSummary
        onStartEdit={props.onStartEdit}
        readOnly={props.readOnly}
        selectedPerson={props.selectedPerson}
      />
      <SelectedPersonDetails {...props} />
    </EditorDrawer>
  );
}

function EditorSidebar(props: SidebarProps) {
  if (props.selectedRelationship) {
    return (
      <EditorDrawer onClose={props.onClose} title="Quan hệ gia đình">
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
        <ProvenancePanel
          key={`relationship-${props.selectedRelationship.id}`}
          personId={null}
          readOnly={props.readOnly}
          relationshipId={props.selectedRelationship.id}
        />
      </EditorDrawer>
    );
  }

  if (props.formMode === "create") {
    return (
      <EditorDrawer onClose={props.onClose} title="Thêm thành viên">
        <CreatePersonPanel
          createPerson={props.createPerson}
          onCancelForm={props.onCancelForm}
          onDraftStateChange={props.onDraftStateChange}
          onSaved={props.onSaved}
        />
      </EditorDrawer>
    );
  }

  if (props.formMode === "edit") {
    return (
      <EditorDrawer onClose={props.onClose} title="Chỉnh sửa thành viên">
        <EditPersonPanel
          onCancelForm={props.onCancelForm}
          onDraftStateChange={props.onDraftStateChange}
          onSaved={props.onSaved}
          selectedPerson={props.selectedPerson}
          updatePerson={props.updatePerson}
        />
      </EditorDrawer>
    );
  }

  return <DefaultEditorSidebar {...props} />;
}

function samePosition(a: LayoutPosition, b: LayoutPosition | undefined) {
  return b !== undefined && a.x === b.x && a.y === b.y;
}

async function saveLayoutsSafely(
  save: SaveLayouts,
  inputs: SaveLayoutInput[],
): Promise<SaveLayoutResult> {
  try {
    return await save(inputs);
  } catch {
    return {
      ok: false,
      message:
        "Không thể lưu bố cục. Đã khôi phục vị trí trước đó; hãy thử kéo lại.",
    };
  }
}

function canStartLayoutMutation(
  readOnly: boolean,
  saveLayouts: SaveLayouts | undefined,
  requestedCount: number,
) {
  if (readOnly) return false;
  if (!saveLayouts) return false;
  if (requestedCount === 0) return false;
  return true;
}

function EmptyGraph({
  visibleCount,
  totalCount,
  onClear,
}: {
  visibleCount: number;
  totalCount: number;
  onClear: () => void;
}) {
  if (visibleCount > 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div
        role="status"
        className="pointer-events-auto max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm"
      >
        <h2 className="font-semibold">
          {totalCount
            ? "Không tìm thấy thành viên"
            : "Gia phả chưa có thành viên"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {totalCount
            ? "Thử tên khác hoặc bỏ bộ lọc để xem lại sơ đồ."
            : "Chọn Thêm thành viên để bắt đầu xây dựng gia phả."}
        </p>
        {totalCount > 0 ? (
          <Button className="mt-4" onClick={onClear} variant="outline">
            Hiện tất cả thành viên
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CanvasHistory({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  readOnly,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  readOnly: boolean;
}) {
  if (readOnly) return null;
  return (
    <div
      aria-label="Lịch sử bố cục"
      className="absolute bottom-4 left-16 flex gap-1 rounded-md border bg-card p-1 shadow-sm"
    >
      <Button size="sm" variant="ghost" disabled={!canUndo} onClick={onUndo}>
        Hoàn tác
      </Button>
      <Button size="sm" variant="ghost" disabled={!canRedo} onClick={onRedo}>
        Làm lại
      </Button>
    </div>
  );
}

function canDragNodes(readOnly: boolean, formMode: PersonFormMode) {
  return !readOnly && formMode === null;
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
  const [pendingFocusPersonId, setPendingFocusPersonId] = useState<
    string | null
  >(null);
  const flowInstance = useRef<ReactFlowInstance<
    PersonNode,
    RelationshipEdge
  > | null>(null);
  const layoutQueue = useRef(Promise.resolve(true));
  const pendingLayoutSaves = useRef(new Map<string, number>());
  const canvasRef = useRef<HTMLElement>(null);
  const draftState = useRef({ dirty: false, saving: false });
  const updateDraftState = useCallback((dirty: boolean, saving: boolean) => {
    draftState.current = { dirty, saving };
  }, []);
  const canLeaveForm = useCallback(() => {
    if (draftState.current.saving) return false;
    return (
      !draftState.current.dirty ||
      window.confirm("Hồ sơ có thay đổi chưa lưu. Bỏ thay đổi và tiếp tục?")
    );
  }, []);
  const closeDrawer = useCallback(() => {
    if (!canLeaveForm()) return;
    setSelectedPersonId(null);
    setSelectedRelationshipId(null);
    setFormMode(null);
  }, [canLeaveForm]);
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
  const [nodes, setNodes, onNodesChange] =
    useNodesState<PersonNode>(initialNodes);
  const edges = useMemo(
    () => createEdges(visibleRelationships, nodes),
    [visibleRelationships, nodes],
  );
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<
    string | null
  >(null);
  const [formMode, setFormMode] = useState<PersonFormMode>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const persistedPositions = useRef(
    new Map(people.map((person) => [person.id, person.position])),
  );
  const layoutRevisions = useRef(
    new Map(people.map((person) => [person.id, person.layoutRevision])),
  );

  const selectedPerson =
    people.find((person) => person.id === selectedPersonId) ?? null;
  const selectedRelationship =
    visibleRelationships.find(
      (relationship) => relationship.id === selectedRelationshipId,
    ) ?? null;
  const archivedCount = countArchivedPeople(people);
  const selectedRelationshipCountValue = selectedRelationshipCount(
    selectedPerson,
    relationships,
  );
  const statusMessage = getStatusMessage(readOnly, saveState);
  const layoutCanUndo =
    layoutHistory.length > 0 && saveState.status !== "saving";
  const layoutCanRedo =
    layoutFuture.length > 0 && saveState.status !== "saving";
  const drawerOpen = Boolean(
    selectedPerson || selectedRelationship || formMode !== null,
  );

  useEffect(() => {
    people.forEach((person) => {
      if (pendingLayoutSaves.current.has(person.id)) return;
      const knownRevision = layoutRevisions.current.get(person.id) ?? 0;
      if ((person.layoutRevision ?? 0) < knownRevision) return;
      persistedPositions.current.set(person.id, person.position);
      layoutRevisions.current.set(person.id, person.layoutRevision);
    });
    setNodes((current) => {
      const previous = new Map(current.map((node) => [node.id, node]));
      return createNodes(
        visiblePeople,
        lockedPersonIds,
        persistedPositions.current,
      ).map((node) => {
        const existing = previous.get(node.id);
        if (
          existing &&
          (existing.dragging || pendingLayoutSaves.current.has(node.id))
        ) {
          return {
            ...node,
            position: existing.position,
            dragging: Boolean(existing.dragging),
          };
        }
        return node;
      });
    });
  }, [people, visiblePeople, lockedPersonIds, setNodes]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector('dialog[open], [role="dialog"]')) return;

      closeDrawer();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeDrawer]);

  useEffect(() => {
    // Only an intentional selection may reveal a clipped node. Never refit on
    // drag, save/revalidation, filtering, or closing the inspector.
    if (!selectedPersonId) return;
    const frameId = window.requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const instance = flowInstance.current;
      const element = canvas?.querySelector(`[data-id="${selectedPersonId}"]`);
      if (!canvas || !instance || !element) return;
      const bounds = canvas.getBoundingClientRect();
      const node = element.getBoundingClientRect();
      const dx =
        Math.max(0, bounds.left + 16 - node.left) -
        Math.max(0, node.right - bounds.right + 16);
      const dy =
        Math.max(0, bounds.top + 16 - node.top) -
        Math.max(0, node.bottom - bounds.bottom + 16);
      const viewport = instance.getViewport();
      void instance.setViewport({
        ...viewport,
        x: viewport.x + dx,
        y: viewport.y + dy,
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedPersonId]);

  useEffect(() => {
    if (!pendingFocusPersonId) return;
    if (!visiblePeople.some((person) => person.id === pendingFocusPersonId)) {
      return;
    }

    flowInstance.current?.fitView({
      nodes: [{ id: pendingFocusPersonId }],
      duration: 250,
      maxZoom: 1.25,
      padding: 1.2,
    });

    const frameId = window.requestAnimationFrame(() => {
      setPendingFocusPersonId(null);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [pendingFocusPersonId, visiblePeople]);

  const performLayoutMutation = useCallback(
    async (
      requestedPositions: ReadonlyMap<string, LayoutPosition>,
      recordHistory: boolean,
      optimistic: boolean,
    ) => {
      if (!saveLayouts) return false;
      if (
        !canStartLayoutMutation(readOnly, saveLayouts, requestedPositions.size)
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
      setSaveState({ status: "saving", personId: firstPersonId });
      if (optimistic)
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            const position = after.get(node.id);
            return position ? { ...node, position } : node;
          }),
        );

      const result = await saveLayoutsSafely(
        saveLayouts,
        [...after].map(([personId, position]) => ({
          personId,
          positionX: position.x,
          positionY: position.y,
          expectedRevision: layoutRevisions.current.get(personId) ?? null,
        })),
      );

      if (!result.ok) {
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            const position = before.get(node.id);
            const requested = after.get(node.id);
            return position &&
              !node.dragging &&
              samePosition(node.position, requested)
              ? { ...node, position }
              : node;
          }),
        );
        setSaveState({
          status: "error",
          personId: firstPersonId,
          message: result.message,
        });
        return false;
      }

      after.forEach((position, personId) => {
        persistedPositions.current.set(personId, position);
      });
      result.revisions.forEach(({ personId, revision }) => {
        layoutRevisions.current.set(personId, revision);
      });

      if (recordHistory) {
        setLayoutHistory((current) =>
          [...current, { before, after }].slice(-50),
        );
        setLayoutFuture([]);
      }

      setSaveState({ status: "saved", personId: firstPersonId });
      return true;
    },
    [people, readOnly, saveLayouts, setNodes],
  );

  const applyLayoutPositions = useCallback(
    (
      positions: ReadonlyMap<string, LayoutPosition>,
      recordHistory = true,
      optimistic = true,
    ) => {
      const pending = pendingLayoutSaves.current;
      positions.forEach((_, id) => pending.set(id, (pending.get(id) ?? 0) + 1));
      const operation = layoutQueue.current
        .then(() => performLayoutMutation(positions, recordHistory, optimistic))
        .finally(() => {
          positions.forEach((_, id) => {
            const remaining = (pending.get(id) ?? 1) - 1;
            if (remaining) pending.set(id, remaining);
            else pending.delete(id);
          });
        });
      layoutQueue.current = operation;
      return operation;
    },
    [performLayoutMutation],
  );

  const persistNodePosition = useCallback(
    (node: PersonNode) => {
      if (node.data.archived || node.data.locked) return;
      void applyLayoutPositions(
        new Map([[node.id, { ...node.position }]]),
        true,
        false,
      );
    },
    [applyLayoutPositions],
  );

  function handleNodeSelect(personId: string) {
    if (!canLeaveForm()) return;
    setSelectedPersonId(personId);
    setSelectedRelationshipId(null);
    setFormMode(null);
  }

  function handleEdgeSelect(relationshipId: string) {
    if (!canLeaveForm()) return;
    setSelectedPersonId(null);
    setSelectedRelationshipId(relationshipId);
    setFormMode(null);
  }

  function handleSaved(personId: string) {
    updateDraftState(false, false);
    clearFilters();
    setCollapsedBranchIds(new Set());
    setPendingFocusPersonId(personId);
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
    setPendingFocusPersonId(personId);
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
    setCollapsedBranchIds(new Set());
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <TreeFilterPanel
        archiveFilter={archiveFilter}
        lifeFilter={lifeFilter}
        matchCount={visiblePeople.length}
        onArchiveFilterChange={setArchiveFilter}
        onClear={clearFilters}
        onLifeFilterChange={setLifeFilter}
        onQueryChange={setQuery}
        onStartCreate={() => {
          if (!canLeaveForm()) return;
          setSelectedPersonId(null);
          setSelectedRelationshipId(null);
          setFormMode("create");
        }}
        onVisibilityFilterChange={setVisibilityFilter}
        query={query}
        readOnly={readOnly}
        statusMessage={statusMessage}
        visibilityFilter={visibilityFilter}
      />

      <div className={editorWorkspaceClass(drawerOpen)}>
        <section
          aria-label="Sơ đồ gia phả tương tác"
          ref={canvasRef}
          onKeyUpCapture={(event) => {
            if (!event.key.startsWith("Arrow")) return;
            const target = event.target as HTMLElement;
            const id = target
              .closest(".react-flow__node")
              ?.getAttribute("data-id");
            const node = id ? flowInstance.current?.getNode(id) : undefined;
            if (node) persistNodePosition(node);
          }}
          onKeyDownCapture={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const target = event.target as HTMLElement;
            const node = target.closest(".react-flow__node");
            const id = node?.getAttribute("data-id");
            if (!id) return;
            event.preventDefault();
            event.stopPropagation();
            handleNodeSelect(id);
          }}
          className="relative min-h-0 min-w-0 overflow-hidden bg-card"
        >
          <ReactFlow<PersonNode, RelationshipEdge>
            nodes={nodes.map((node) => ({
              ...node,
              selected: node.dragging || node.id === selectedPersonId,
              draggable:
                Boolean(node.draggable) && canDragNodes(readOnly, formMode),
            }))}
            onInit={(instance) => {
              flowInstance.current = instance;
            }}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgeClick={(_, edge) => handleEdgeSelect(edge.id)}
            onNodeClick={(_, node) => handleNodeSelect(node.id)}
            onPaneClick={() => {
              if (formMode) return;
              setSelectedPersonId(null);
              setSelectedRelationshipId(null);
            }}
            onNodeDragStop={(_, node) => {
              persistNodePosition(node);
            }}
            nodesDraggable={canDragNodes(readOnly, formMode)}
            nodeDragThreshold={3}
            autoPanOnNodeDrag={false}
            autoPanOnNodeFocus={false}
            selectNodesOnDrag={false}
            panOnScroll
            panOnScrollSpeed={1}
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
            zoomActivationKeyCode={null}
            ariaLabelConfig={{
              "controls.zoomIn.ariaLabel": "Phóng to",
              "controls.zoomOut.ariaLabel": "Thu nhỏ",
              "controls.fitView.ariaLabel": "Xem toàn bộ sơ đồ",
              "minimap.ariaLabel": "Bản đồ thu nhỏ",
            }}
            nodesConnectable={false}
            nodesFocusable
            edgesFocusable
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.2}
            maxZoom={2}
          >
            <Background gap={32} size={1} />
            <Controls showInteractive={false} />
            <MiniMap className="!hidden sm:!block" pannable zoomable />
          </ReactFlow>
          <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-md border bg-card/95 px-3 py-2 text-xs text-muted-foreground">
            <p>Cuộn để di chuyển · Kéo thẻ để đổi vị trí · + / − để zoom</p>
            <p className="mt-1">
              Nét liền có mũi tên: cha/mẹ → con · Nét đứt: hôn phối
            </p>
          </div>
          <CanvasHistory
            readOnly={readOnly}
            canUndo={layoutCanUndo}
            canRedo={layoutCanRedo}
            onUndo={() => void undoLayout()}
            onRedo={() => void redoLayout()}
          />
          <EmptyGraph
            visibleCount={visiblePeople.length}
            totalCount={people.length}
            onClear={clearFilters}
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
          layoutCanRedo={layoutCanRedo}
          layoutCanUndo={layoutCanUndo}
          lockedPersonIds={lockedPersonIds}
          onAutoLayoutBranch={autoLayoutBranch}
          onCancelForm={() => {
            if (canLeaveForm()) setFormMode(null);
          }}
          onDraftStateChange={updateDraftState}
          onClose={closeDrawer}
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
          selectedRelationshipCount={selectedRelationshipCountValue}
          updatePerson={updatePerson}
        />
      </div>
    </div>
  );
}
