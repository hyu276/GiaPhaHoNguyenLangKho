import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  AdminTreeEditor,
  type EditorPerson,
  type EditorRelationship,
  type SaveLayoutInput,
  type SaveLayoutResult,
} from "@/features/tree/components/admin-tree-editor";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TreeViewerRole = "admin" | "spectator";

const personRowSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  birth_year: z.number().nullable(),
  death_year: z.number().nullable(),
});

const relationshipRowSchema = z.object({
  id: z.string().uuid(),
  relationship_kind: z.enum(["parent_child", "partnership"]),
  source_person_id: z.string().uuid(),
  target_person_id: z.string().uuid(),
});

const layoutRowSchema = z.object({
  person_id: z.string().uuid(),
  position_x: z.number().finite(),
  position_y: z.number().finite(),
});

const saveLayoutSchema = z.object({
  personId: z.string().uuid(),
  positionX: z.number().finite().min(-1_000_000).max(1_000_000),
  positionY: z.number().finite().min(-1_000_000).max(1_000_000),
});

function getTreeViewerRole(value: unknown): TreeViewerRole | null {
  return value === "admin" || value === "spectator" ? value : null;
}

function getFallbackPosition(index: number) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: 80 + column * 260, y: 80 + row * 180 };
}

async function requireTreeViewer() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/admin/login");
  }

  const role = getTreeViewerRole(user.app_metadata.role);
  if (!role) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=forbidden");
  }

  return { supabase, user, role };
}

async function savePersonLayout(
  input: SaveLayoutInput,
): Promise<SaveLayoutResult> {
  "use server";

  const parsed = saveLayoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Vị trí không hợp lệ." };
  }

  const { supabase, user } = await requireAdmin();
  const { error } = await supabase.from("person_layouts").upsert(
    {
      person_id: parsed.data.personId,
      position_x: parsed.data.positionX,
      position_y: parsed.data.positionY,
      updated_by: user.id,
    },
    { onConflict: "person_id" },
  );

  if (error) {
    return {
      ok: false,
      message: "Không thể lưu vị trí. Sơ đồ đã khôi phục vị trí trước đó.",
    };
  }

  revalidatePath("/admin/tree");
  return { ok: true };
}

async function signOut() {
  "use server";

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export default async function AdminTreePage() {
  const { supabase, user, role } = await requireTreeViewer();
  const readOnly = role === "spectator";

  const [peopleResult, relationshipsResult, layoutsResult] = await Promise.all([
    supabase
      .from("people")
      .select("id, display_name, birth_year, death_year")
      .order("display_name"),
    supabase
      .from("relationships")
      .select("id, relationship_kind, source_person_id, target_person_id")
      .order("created_at"),
    supabase.from("person_layouts").select("person_id, position_x, position_y"),
  ]);

  if (peopleResult.error || relationshipsResult.error || layoutsResult.error) {
    throw new Error("Không thể tải dữ liệu sơ đồ gia phả.");
  }

  const peopleRows = z.array(personRowSchema).parse(peopleResult.data ?? []);
  const relationshipRows = z
    .array(relationshipRowSchema)
    .parse(relationshipsResult.data ?? []);
  const layoutRows = z.array(layoutRowSchema).parse(layoutsResult.data ?? []);
  const layoutByPersonId = new Map(
    layoutRows.map((layout) => [
      layout.person_id,
      { x: layout.position_x, y: layout.position_y },
    ]),
  );

  const people: EditorPerson[] = peopleRows.map((person, index) => ({
    id: person.id,
    displayName: person.display_name,
    birthYear: person.birth_year,
    deathYear: person.death_year,
    position: layoutByPersonId.get(person.id) ?? getFallbackPosition(index),
  }));

  const relationships: EditorRelationship[] = relationshipRows.map(
    (relationship) => ({
      id: relationship.id,
      kind: relationship.relationship_kind,
      sourcePersonId: relationship.source_person_id,
      targetPersonId: relationship.target_person_id,
    }),
  );

  return (
    <main className="flex min-h-svh flex-col bg-background px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {readOnly ? "Spectator · chỉ xem" : "Admin editor"}
          </p>
          <h1 className="font-display mt-1 text-3xl text-card-foreground sm:text-4xl">
            Sơ đồ gia phả
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {people.length} người · {relationships.length} quan hệ ·{" "}
            {user.email}
          </p>
        </div>

        <form action={signOut}>
          <Button type="submit" variant="outline">
            Đăng xuất
          </Button>
        </form>
      </header>

      <AdminTreeEditor
        people={people}
        relationships={relationships}
        readOnly={readOnly}
        saveLayout={readOnly ? undefined : savePersonLayout}
      />
    </main>
  );
}
