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
import {
  PersonArchiveControls,
  type PersonStateMutation,
} from "@/features/tree/components/person-archive-controls";
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
  onPersonStateChanged: () => void;
};

type PersonNodeData = {
  displayName: string;
  years: string;
  visibility: PersonVisibility;
  archived: boolean;
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
  createParentChildRelationship: CreateParentChildRelationship | undefined;
  createPartnership: CreatePartnership | undefined;
  createPerson: CreatePerson | undefined;
  formMode: PersonFormMode;
  onCancelForm: () => void;
  onRelationshipChanged: (focusPersonId?: string) => void;
  onSaved: (personId: string) => void;
  onStartCreate: () => void;
  onStartEdit: () => void;
  people: EditorPerson[];
  readOnly: boolean;
  relationships: EditorRelationship[];
  removeRelationship: RemoveRelationship | undefined;
  restorePerson: PersonStateMutation | undefined;
  selectedPerson: EditorPerson | null;
  selectedRelationship: EditorRelationship | null;
  updatePerson: UpdatePerson | undefined;
};

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
      }`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <p className="text-sm font-semibold text-card-foreground">
        {data.displayName}
      </p>
      {data.archived ? (
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Đã lưu trữ
        </p>
      ) : null}
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{data.years}</span>
        <span aria-hidden="true">·</span>
        <span>{data.visibility === "private" ? "Riêng tư" : "Công khai"}</span>
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
    data: {
      displayName: person.displayName,
      years: formatYears(person),
      visibility: person.visibility,
      archived: person.archivedAt !== null,
    },
    className: person.archivedAt ? "opacity-55" : undefined,
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

      {readOnly || selectedPerson.archivedAt ? null : (
        <Button className="mt-6 w-full" onClick={onStartEdit} variant="outline">
          Sửa hồ sơ
        </Button>
      )}
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

function EditorSidebar(props: SidebarProps) {
  if (props.selectedRelationship) {
    return (
      <aside className="rounded-3xl border border-border bg-card p-5">
        <RelationshipInspector
          onChanged={props.onRelationshipChanged}
          people={props.people}
          readOnly={props.readOnly}
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
      {props.selectedPerson && !props.readOnly ? (
        <PersonArchiveControls
          archivePerson={props.archivePerson}
          onChanged={props.onPersonStateChanged}
          people={props.people}
          person={props.selectedPerson}
          relationships={props.relationships}
          restorePerson={props.restorePerson}
        />
      ) : null}
      {props.selectedPerson && !props.selectedPerson.archivedAt ? (
        <PersonRelationshipSection
          createParentChildRelationship={props.createParentChildRelationship}
          createPartnership={props.createPartnership}
          focalPerson={props.selectedPerson}
          onChanged={props.onRelationshipChanged}
          people={props.people}
          readOnly={props.readOnly}
          relationships={props.relationships}
        />
      ) : null}
    </aside>
  );
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
    () => people.filter((person) => showArchived || !person.archivedAt),
    [people, showArchived],
  );
  const visiblePersonIds = useMemo(
    () => new Set(visiblePeople.map((person) => person.id)),
    [visiblePeople],
  );
  const visibleRelationships = useMemo(
    () =>
      relationships.filter(
        (relationship) =>
          visiblePersonIds.has(relationship.sourcePersonId) &&
          visiblePersonIds.has(relationship.targetPersonId),
      ),
    [relationships, visiblePersonIds],
  );
  const initialNodes = useMemo(() => createNodes(visiblePeople), [visiblePeople]);
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
    relationships.find(
      (relationship) => relationship.id === selectedRelationshipId,
    ) ?? null;
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
      if (readOnly || !saveLayout) return;

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

  function handlePersonStateChanged() {
    setSelectedPersonId(null);
    setSelectedRelationshipId(null);
    setFormMode(null);
    router.refresh();
  }

  function toggleArchived() {
    const nextShowArchived = !showArchived;
    setShowArchived(nextShowArchived);
    setSelectedRelationshipId(null);

    if (!nextShowArchived && selectedPerson?.archivedAt) {
      setSelectedPersonId(null);
    }
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
        {readOnly ? null : (
          <Button
            className="absolute right-4 top-4"
            onClick={toggleArchived}
            type="button"
            variant="outline"
          >
            {showArchived ? "Ẩn đã lưu trữ" : "Hiện đã lưu trữ"}
          </Button>
        )}
      </section>

      <EditorSidebar
        archivePerson={archivePerson}
        createParentChildRelationship={createParentChildRelationship}
        createPartnership={createPartnership}
        createPerson={createPerson}
        formMode={formMode}
        onCancelForm={() => setFormMode(null)}
        onPersonStateChanged={handlePersonStateChanged}
        onRelationshipChanged={handleRelationshipChanged}
        onSaved={handleSaved}
        onStartCreate={() => setFormMode("create")}
        onStartEdit={() => setFormMode("edit")}
        people={people}
        readOnly={readOnly}
        relationships={relationships}
        removeRelationship={removeRelationship}
        restorePerson={restorePerson}
        selectedPerson={selectedPerson}
        selectedRelationship={selectedRelationship}
        updatePerson={updatePerson}
      />
    </div>
  );
}
