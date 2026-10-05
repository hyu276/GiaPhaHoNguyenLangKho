"use client";

import {
  AdminTreeEditor,
  type EditorPerson,
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

export default function EditorHarness() {
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b p-4">
        Kiểm thử component quản trị thực — dữ liệu giả lập
      </header>
      <div className="flex min-h-0 flex-1 p-3">
        <AdminTreeEditor
          people={people}
          relationships={[]}
          readOnly={false}
          archivePerson={undefined}
          createParentChildRelationship={undefined}
          createPartnership={undefined}
          createPerson={async () => {
            throw new Error("Synthetic network failure");
          }}
          removeRelationship={undefined}
          restorePerson={undefined}
          saveLayouts={async (inputs) => ({
            ok: true,
            revisions: inputs.map((input) => ({
              personId: input.personId,
              revision: 2,
            })),
          })}
          updatePerson={async () => {
            throw new Error("Synthetic network failure");
          }}
        />
      </div>
    </main>
  );
}
