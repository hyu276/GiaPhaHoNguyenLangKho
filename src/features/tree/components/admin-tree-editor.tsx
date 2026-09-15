"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
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

export type EditorPerson = {
  id: string;
  displayName: string;
  birthYear: number | null;
  deathYear: number | null;
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

type AdminTreeEditorProps = {
  people: EditorPerson[];
  relationships: EditorRelationship[];
  saveLayout: (input: SaveLayoutInput) => Promise<SaveLayoutResult>;
};

type PersonNodeData = {
  displayName: string;
  years: string;
};

type PersonNode = Node<PersonNodeData, "person">;
type RelationshipEdge = Edge<{ kind: EditorRelationship["kind"] }>;

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
      <p className="mt-1 text-xs text-muted-foreground">{data.years}</p>
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

export function AdminTreeEditor({
  people,
  relationships,
  saveLayout,
}: AdminTreeEditorProps) {
  const initialNodes = useMemo(() => createNodes(people), [people]);
  const edges = useMemo(() => createEdges(relationships), [relationships]);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<PersonNode>(initialNodes);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [, startTransition] = useTransition();
  const persistedPositions = useRef(
    new Map(people.map((person) => [person.id, person.position])),
  );

  const selectedPerson = people.find(
    (person) => person.id === selectedPersonId,
  );

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
    [restorePosition, saveLayout],
  );

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="relative min-h-[65svh] overflow-hidden rounded-3xl border border-border bg-card">
        <ReactFlow<PersonNode, RelationshipEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => setSelectedPersonId(node.id)}
          onNodeDragStop={(_, node) => {
            setSelectedPersonId(node.id);
            persistNodePosition(node);
          }}
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
          {saveState.status === "saving"
            ? "Đang lưu vị trí…"
            : saveState.status === "saved"
              ? "Đã lưu vị trí"
              : saveState.status === "error"
                ? saveState.message
                : "Chọn và kéo một người để thay đổi vị trí"}
        </div>
      </section>

      <aside className="rounded-3xl border border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Đang chọn
        </p>
        {selectedPerson ? (
          <div className="mt-4">
            <h2 className="font-display text-3xl text-card-foreground">
              {selectedPerson.displayName}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatYears(selectedPerson)}
            </p>
            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              Kéo thẻ người trên sơ đồ. Vị trí được lưu khi thao tác kéo kết
              thúc và sẽ được tải lại từ database ở lần mở trang tiếp theo.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Chọn một người trên sơ đồ để xem thông tin và bắt đầu chỉnh vị trí.
          </p>
        )}
      </aside>
    </div>
  );
}
