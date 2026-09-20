"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
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
type SaveLayout = (input: SaveLayoutInput) => Promise<SaveLayoutResult>;
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
  saveLayout: SaveLayout | undefined;
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
  years: string;
  visibility: PersonVisibility;
};

type PersonNode = Node<PersonNodeData, "person">;
type RelationshipEdge = Edge<{ kind: EditorRelationship["kind"] }>;
type PersonFormMode = "create" | "edit" | null;

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
  onRelationshipChanged: (focusPersonId?: string) => void;
  onSaved: (personId: string) => void;
  onShowArchivedChange: (showArchived: boolean) => void;
  onStartCreate: () => void;
  onStartEdit: () => void;
  people: EditorPerson[];
  readOnly: boolean;
  relationships: EditorRelationship[];
  removeRelationship: RemoveRelationship | undefined;
  restorePerson: PersonStateMutation | undefined;
  selectedPerson: EditorPerson | null;
  selectedRelationship: EditorRelationship | null;
  selectedRelationshipCount: number;
  showArchived: boolean;
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

function getVisiblePeople(people: EditorPerson[], showArchived: boolean) {
  return showArchived ? people : people.filter((person) => !isArchived(person));
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
      return "Đang lưu vị trí…";
    case "saved":
      return "Đã lưu vị trí";
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
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = {
  person: PersonNodeCard,
};

function createNodes(people: EditorPerson[]): PersonNode[] {
  return people.map((person) => ({
    id: person.id,
    type: "person",
    position: person.position,
    deletable: false,
    draggable: !isArchived(person),
    data: {
      archived: isArchived(person),
      displayName: person.displayName,
      years: formatYears(person),
      visibility: person.visibility,
    },
  }));
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

function ArchiveFilter({
  archivedCount,
  onChange,
  readOnly,
  showArchived,
}: {
  archivedCount: number;
  onChange: (showArchived: boolean) => void;
  readOnly: boolean;
  showArchived: boolean;
}) {
  if (readOnly || archivedCount === 0) return null;

  return (
    <label className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
      <input
        checked={showArchived}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>Hiện hồ sơ đã lưu trữ ({archivedCount})</span>
    </label>
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
      <ArchiveFilter
        archivedCount={props.archivedCount}
        onChange={props.onShowArchivedChange}
        readOnly={props.readOnly}
        showArchived={props.showArchived}
      />

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

export function AdminTreeEditor({
  archivePerson,
  people,
  relationships,
  readOnly,
  saveLayout,
  createParentChildRelationship,
  createPartnership,
  createPerson,
  removeRelationship,
  restorePerson,
  updatePerson,
}: AdminTreeEditorProps) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const visiblePeople = useMemo(
    () => getVisiblePeople(people, showArchived),
    [people, showArchived],
  );
  const visibleRelationships = useMemo(
    () => getVisibleRelationships(relationships, visiblePeople),
    [relationships, visiblePeople],
  );
  const initialNodes = useMemo(
    () => createNodes(visiblePeople),
    [visiblePeople],
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
  const [, startTransition] = useTransition();
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
    setNodes(createNodes(visiblePeople));
    persistedPositions.current = new Map(
      people.map((person) => [person.id, person.position]),
    );
  }, [people, setNodes, visiblePeople]);

  const restorePosition = useCallback(
    (personId: string) => {
      const persisted = persistedPositions.current.get(personId);
      if (!persisted) return;

      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === personId ? { ...node, position: persisted } : node,
        ),
      );
    },
    [setNodes],
  );

  const persistNodePosition = useCallback(
    (node: PersonNode) => {
      if (readOnly || !saveLayout || node.data.archived) return;

      const previousPosition = persistedPositions.current.get(node.id);
      setSaveState({ status: "saving", personId: node.id });

      startTransition(async () => {
        const result = await saveLayout({
          personId: node.id,
          positionX: node.position.x,
          positionY: node.position.y,
        });

        if (!result.ok) {
          if (previousPosition) restorePosition(node.id);
          setSaveState({
            status: "error",
            personId: node.id,
            message: result.message,
          });
          return;
        }

        persistedPositions.current.set(node.id, node.position);
        setSaveState({ status: "saved", personId: node.id });
      });
    },
    [readOnly, restorePosition, saveLayout],
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
    setSelectedPersonId(archived && !showArchived ? null : personId);
    setFormMode(null);
    router.refresh();
  }

  function handleShowArchivedChange(nextShowArchived: boolean) {
    setSelectedPersonId(null);
    setSelectedRelationshipId(null);
    setFormMode(null);
    setShowArchived(nextShowArchived);
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="relative min-h-[65svh] overflow-hidden rounded-3xl border border-border bg-card">
        <ReactFlow<PersonNode, RelationshipEdge>
          nodes={nodes}
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
          className="pointer-events-none absolute left-4 top-4 rounded-full border border-border bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur"
        >
          {statusMessage}
        </div>
      </section>

      <EditorSidebar
        archivePerson={archivePerson}
        archivedCount={archivedCount}
        createParentChildRelationship={createParentChildRelationship}
        createPartnership={createPartnership}
        createPerson={createPerson}
        formMode={formMode}
        onCancelForm={() => setFormMode(null)}
        onPersonStateChanged={handlePersonStateChanged}
        onRelationshipChanged={handleRelationshipChanged}
        onSaved={handleSaved}
        onShowArchivedChange={handleShowArchivedChange}
        onStartCreate={() => setFormMode("create")}
        onStartEdit={() => setFormMode("edit")}
        people={visiblePeople}
        readOnly={readOnly}
        relationships={visibleRelationships}
        removeRelationship={removeRelationship}
        restorePerson={restorePerson}
        selectedPerson={selectedPerson}
        selectedRelationship={selectedRelationship}
        selectedRelationshipCount={selectedRelationshipCount}
        showArchived={showArchived}
        updatePerson={updatePerson}
      />
    </div>
  );
}
