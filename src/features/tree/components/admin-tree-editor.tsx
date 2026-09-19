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
import type {
  CreatePersonInput,
  PersonVisibility,
  UpdatePersonInput,
} from "@/features/tree/person-input";

export type EditorPerson = {
  id: string;
  displayName: string;
  description: string | null;
  birthYear: number | null;
  deathYear: number | null;
  visibility: PersonVisibility;
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
  | { ok: true; personId: string }
  | { ok: false; message: string };
type SaveLayout = (input: SaveLayoutInput) => Promise<SaveLayoutResult>;
type CreatePerson = (input: CreatePersonInput) => Promise<PersonMutationResult>;
type UpdatePerson = (input: UpdatePersonInput) => Promise<PersonMutationResult>;

type AdminTreeEditorProps = {
  people: EditorPerson[];
  relationships: EditorRelationship[];
  readOnly: boolean;
  saveLayout: SaveLayout | undefined;
  createPerson: CreatePerson | undefined;
  updatePerson: UpdatePerson | undefined;
};

type PersonNodeData = {
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
      deletable: false,
    };

    if (relationship.kind === "partnership") {
      return {
        ...edge,
        label: "Hôn phối",
        style: { strokeDasharray: "6 5" },
      };
    }

    return edge;
  });
}

function getVisibilityLabel(visibility: PersonVisibility) {
  return visibility === "private" ? "Riêng tư" : "Công khai";
}

export function AdminTreeEditor({
  people,
  relationships,
  readOnly,
  saveLayout,
  createPerson,
  updatePerson,
}: AdminTreeEditorProps) {
  const router = useRouter();
  const initialNodes = useMemo(() => createNodes(people), [people]);
  const edges = useMemo(() => createEdges(relationships), [relationships]);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<PersonNode>(initialNodes);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<PersonFormMode>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [, startTransition] = useTransition();
  const persistedPositions = useRef(
    new Map(people.map((person) => [person.id, person.position])),
  );

  const selectedPerson = people.find(
    (person) => person.id === selectedPersonId,
  );
  const statusMessage = getStatusMessage(readOnly, saveState);
  const emptyDescription = getEmptyDescription(readOnly);

  useEffect(() => {
    setNodes(createNodes(people));
    persistedPositions.current = new Map(
      people.map((person) => [person.id, person.position]),
    );
  }, [people, setNodes]);

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
    setFormMode(null);
  }

  function handleSaved(personId: string) {
    setSelectedPersonId(personId);
    setFormMode(null);
    router.refresh();
  }

  async function handleCreate(input: CreatePersonInput) {
    if (!createPerson) {
      return {
        ok: false as const,
        message: "Tài khoản này không thể thêm người.",
      };
    }
    return createPerson(input);
  }

  async function handleUpdate(input: CreatePersonInput) {
    if (!updatePerson || !selectedPerson) {
      return { ok: false as const, message: "Chưa chọn người để cập nhật." };
    }
    return updatePerson({ ...input, personId: selectedPerson.id });
  }

  const formPerson = formMode === "edit" ? (selectedPerson ?? null) : null;
  const formSave = formMode === "edit" ? handleUpdate : handleCreate;

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="relative min-h-[65svh] overflow-hidden rounded-3xl border border-border bg-card">
        <ReactFlow<PersonNode, RelationshipEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => handleNodeSelect(node.id)}
          onNodeDragStop={(_, node) => {
            handleNodeSelect(node.id);
            persistNodePosition(node);
          }}
          nodesDraggable={!readOnly}
          nodesConnectable={false}
          edgesFocusable={false}
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

      <aside className="rounded-3xl border border-border bg-card p-5">
        {!readOnly && formMode === null ? (
          <Button className="w-full" onClick={() => setFormMode("create")}>
            Thêm người
          </Button>
        ) : null}

        {formMode ? (
          <PersonEditorForm
            key={`${formMode}:${formPerson?.id ?? "new"}`}
            onCancel={() => setFormMode(null)}
            onSave={formSave}
            onSaved={handleSaved}
            person={formPerson}
          />
        ) : (
          <>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Đang chọn
            </p>
            {selectedPerson ? (
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

                {!readOnly ? (
                  <Button
                    className="mt-6 w-full"
                    onClick={() => setFormMode("edit")}
                    variant="outline"
                  >
                    Sửa hồ sơ
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {emptyDescription}
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
