"use client";

import { useRef, useState } from "react";

import {
  AdminTreeEditor,
  type EditorPerson,
  type SaveLayoutInput,
} from "@/features/tree/components/admin-tree-editor";

const people: EditorPerson[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "Thành viên kiểm thử A",
    description: null,
    birthYear: 1950,
    deathYear: null,
    sex: "male",
    visibility: "private",
    archivedAt: null,
    revision: 1,
    position: { x: 800, y: 100 },
    layoutRevision: 1,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    displayName: "Thành viên kiểm thử B",
    description: null,
    birthYear: 1980,
    deathYear: null,
    sex: "female",
    visibility: "private",
    archivedAt: null,
    revision: 1,
    position: { x: 100, y: 500 },
    layoutRevision: 1,
  },
];

const partner: EditorPerson = {
  ...people[0]!,
  id: "33333333-3333-4333-8333-333333333333",
  displayName: "Thành viên kiểm thử C",
  position: { x: 430, y: 100 },
};
const initialPeople = [...people, partner];

export default function EditorHarness() {
  const [currentPeople, setPeople] = useState(initialPeople);
  const persisted = useRef(initialPeople);
  const [savedInputs, setSavedInputs] = useState<SaveLayoutInput[][]>([]);
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b p-4">
        Kiểm thử component quản trị thực — dữ liệu giả lập
        <button
          type="button"
          onClick={() => {
            const extra = Array.from(
              { length: 147 },
              (_, index): EditorPerson => ({
                ...partner,
                id: `synthetic-${index}`,
                displayName: `Thành viên tổng hợp ${index + 1}`,
                position: {
                  x: (index % 12) * 280,
                  y: 800 + Math.floor(index / 12) * 180,
                },
              }),
            );
            persisted.current = [...initialPeople, ...extra];
            setPeople(persisted.current);
          }}
        >
          Nạp 150 thành viên giả lập
        </button>
        <output aria-label="Các lần lưu bố cục" className="sr-only">
          {JSON.stringify(savedInputs)}
        </output>
      </header>
      <div className="flex min-h-0 flex-1 p-3">
        <AdminTreeEditor
          people={currentPeople}
          relationships={[
            ...currentPeople.slice(3).map((person, index) => ({
              id: `synthetic-relation-${index}`,
              kind: "parent_child" as const,
              sourcePersonId: currentPeople[Math.floor(index / 2)]!.id,
              targetPersonId: person.id,
              revision: 1,
            })),
            {
              id: "parent-child",
              kind: "parent_child",
              sourcePersonId: people[0]!.id,
              targetPersonId: people[1]!.id,
              revision: 1,
            },
            {
              id: "partnership",
              kind: "partnership",
              sourcePersonId: partner.id,
              targetPersonId: people[0]!.id,
              revision: 1,
            },
          ]}
          readOnly={false}
          archivePerson={undefined}
          createParentChildRelationship={undefined}
          createPartnership={undefined}
          createPerson={async () => {
            throw new Error("Synthetic network failure");
          }}
          removeRelationship={undefined}
          restorePerson={undefined}
          saveLayouts={async (inputs) => {
            await new Promise((resolve) => setTimeout(resolve, 650));
            if (new URLSearchParams(location.search).has("fail-layout"))
              throw new Error("Synthetic layout failure");
            const stale = inputs.some(
              (input) =>
                persisted.current.find((person) => person.id === input.personId)
                  ?.layoutRevision !== input.expectedRevision,
            );
            if (stale)
              return {
                ok: false,
                message: "Synthetic revision conflict",
                kind: "conflict",
              };
            persisted.current = persisted.current.map((person) => {
              const input = inputs.find(
                (entry) => entry.personId === person.id,
              );
              return input
                ? {
                    ...person,
                    position: { x: input.positionX, y: input.positionY },
                    layoutRevision: (person.layoutRevision ?? 0) + 1,
                  }
                : person;
            });
            // Reproduce Next server-action revalidation before its response resolves.
            setPeople([...persisted.current]);
            setSavedInputs((previous) => [...previous, inputs]);
            await new Promise((resolve) => setTimeout(resolve, 50));
            return {
              ok: true,
              revisions: inputs.map((input) => ({
                personId: input.personId,
                revision: (input.expectedRevision ?? 0) + 1,
              })),
            };
          }}
          updatePerson={async () => {
            throw new Error("Synthetic network failure");
          }}
        />
      </div>
    </main>
  );
}
