/**
 * ADMIN_TREE_PAGE
 *
 * Purpose: Renders the authenticated genealogy workspace with a calm product shell and progressive admin tools.
 * Connections: Supabase auth/data, genealogy editor, audit history, data-quality, duplicate review, and backup tools.
 * Risk: High because this route is the primary authenticated genealogy workspace.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  loadRecentMutationAudits,
  undoMutationAudit,
} from "@/app/admin/tree/audit-actions";
import {
  archivePerson,
  createPerson,
  restorePerson,
  updatePerson,
} from "@/app/admin/tree/actions";
import {
  createParentChildRelationship,
  createPartnership,
  removeRelationship,
} from "@/app/admin/tree/relationship-actions";
import { Button } from "@/components/ui/button";
import {
  AdminTreeEditor,
  type EditorPerson,
  type EditorRelationship,
  type SaveLayoutInput,
  type SaveLayoutResult,
} from "@/features/tree/components/admin-tree-editor";
import { AuditHistoryPanel } from "@/features/tree/components/audit-history-panel";
import { BulkUtilitiesPanel } from "@/features/tree/components/bulk-utilities-panel";
import { DataQualityPanel } from "@/features/tree/components/data-quality-panel";
import { DuplicateReviewPanel } from "@/features/tree/components/duplicate-review-panel";
import { getFallbackPosition } from "@/features/tree/tree-layout";
import { requireAdmin } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TreeViewerRole = "admin" | "spectator";
type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

const personRowSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  description: z.string().nullable(),
  birth_year: z.number().nullable(),
  death_year: z.number().nullable(),
  sex: z.enum(["male", "female"]).nullable(),
  visibility: z.enum(["public", "private"]),
  archived_at: z.string().nullable(),
  revision: z.number().int().min(1),
});

const relationshipRowSchema = z.object({
  id: z.string().uuid(),
  relationship_kind: z.enum(["parent_child", "partnership"]),
  source_person_id: z.string().uuid(),
  target_person_id: z.string().uuid(),
  revision: z.number().int().min(1),
});

const layoutRowSchema = z.object({
  person_id: z.string().uuid(),
  position_x: z.number().finite(),
  position_y: z.number().finite(),
  revision: z.number().int().min(1),
});

const saveLayoutSchema = z.object({
  personId: z.string().uuid(),
  positionX: z.number().finite().min(-1_000_000).max(1_000_000),
  positionY: z.number().finite().min(-1_000_000).max(1_000_000),
  expectedRevision: z.number().int().min(1).nullable(),
});

const saveLayoutsSchema = z.array(saveLayoutSchema).min(1).max(500);

function getTreeViewerRole(value: unknown): TreeViewerRole | null {
  return value === "admin" || value === "spectator" ? value : null;
}

function getViewerLabel(role: TreeViewerRole) {
  return role === "spectator" ? "Chỉ xem" : "Quản trị viên";
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

function getLayoutSaveFailure(error: { code?: string; message: string }) {
  const isConflict =
    error.code === "40001" || error.message.includes("stale layout revision");

  if (isConflict) {
    return {
      ok: false as const,
      kind: "conflict" as const,
      message:
        "Bố cục vừa được thay đổi ở một phiên khác. Hãy tải lại dữ liệu mới trước khi thử lại.",
    };
  }

  return {
    ok: false as const,
    message: "Không thể lưu bố cục. Sơ đồ đã khôi phục vị trí trước đó.",
  };
}

function parseSavedLayoutRevisions(data: unknown) {
  return z
    .array(
      z.object({
        person_id: z.string().uuid(),
        revision: z.number().int().min(1),
      }),
    )
    .parse(data || [])
    .map((row) => ({ personId: row.person_id, revision: row.revision }));
}

async function savePersonLayouts(
  inputs: SaveLayoutInput[],
): Promise<SaveLayoutResult> {
  "use server";

  const parsed = saveLayoutsSchema.safeParse(inputs);
  if (!parsed.success) {
    return { ok: false, message: "Vị trí không hợp lệ." };
  }

  const uniquePersonIds = new Set(parsed.data.map((input) => input.personId));
  if (uniquePersonIds.size !== parsed.data.length) {
    return { ok: false, message: "Danh sách vị trí chứa người bị lặp." };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("save_person_layouts_if_current", {
    p_layouts: parsed.data,
  });

  if (error) return getLayoutSaveFailure(error);

  const revisions = parseSavedLayoutRevisions(data);
  revalidatePath("/admin/tree");
  return { ok: true, revisions };
}

function getAdminMutations(role: TreeViewerRole) {
  if (role === "spectator") {
    return {
      archivePerson: undefined,
      createParentChildRelationship: undefined,
      createPartnership: undefined,
      createPerson: undefined,
      removeRelationship: undefined,
      restorePerson: undefined,
      updatePerson: undefined,
      saveLayouts: undefined,
    };
  }

  return {
    archivePerson,
    createParentChildRelationship,
    createPartnership,
    createPerson,
    removeRelationship,
    restorePerson,
    updatePerson,
    saveLayouts: savePersonLayouts,
  };
}

function getLayoutEntry(
  layoutByPersonId: Map<
    string,
    { position: { x: number; y: number }; revision: number }
  >,
  personId: string,
) {
  return layoutByPersonId.get(personId) || null;
}

async function loadEditorGraphData(supabase: SupabaseServerClient) {
  const [peopleResult, relationshipsResult, layoutsResult] = await Promise.all([
    supabase
      .from("people")
      .select(
        "id, display_name, description, birth_year, death_year, sex, visibility, archived_at, revision",
      )
      .order("display_name"),
    supabase
      .from("relationships")
      .select(
        "id, relationship_kind, source_person_id, target_person_id, revision",
      )
      .order("created_at"),
    supabase
      .from("person_layouts")
      .select("person_id, position_x, position_y, revision"),
  ]);

  if (peopleResult.error || relationshipsResult.error || layoutsResult.error) {
    throw new Error("Không thể tải dữ liệu sơ đồ gia phả.");
  }

  const peopleRows = z.array(personRowSchema).parse(peopleResult.data || []);
  const relationshipRows = z
    .array(relationshipRowSchema)
    .parse(relationshipsResult.data || []);
  const layoutRows = z.array(layoutRowSchema).parse(layoutsResult.data || []);
  const layoutByPersonId = new Map(
    layoutRows.map((layout) => [
      layout.person_id,
      {
        position: { x: layout.position_x, y: layout.position_y },
        revision: layout.revision,
      },
    ]),
  );

  const people: EditorPerson[] = peopleRows.map((person, index) => {
    const layout = getLayoutEntry(layoutByPersonId, person.id);
    return {
      id: person.id,
      displayName: person.display_name,
      description: person.description,
      birthYear: person.birth_year,
      deathYear: person.death_year,
      sex: person.sex,
      visibility: person.visibility,
      archivedAt: person.archived_at,
      revision: person.revision,
      position: layout ? layout.position : getFallbackPosition(index),
      layoutRevision: layout ? layout.revision : null,
    };
  });

  const relationships: EditorRelationship[] = relationshipRows.map(
    (relationship) => ({
      id: relationship.id,
      kind: relationship.relationship_kind,
      sourcePersonId: relationship.source_person_id,
      targetPersonId: relationship.target_person_id,
      revision: relationship.revision,
    }),
  );

  return { people, relationships };
}

function getPeopleCounts(people: EditorPerson[]) {
  const activePeopleCount = people.filter(
    (person) => person.archivedAt === null,
  ).length;

  return {
    activePeopleCount,
    archivedPeopleCount: people.length - activePeopleCount,
  };
}

async function getAuditHistory(readOnly: boolean) {
  if (readOnly) return null;
  return loadRecentMutationAudits({ limit: 30 });
}

function AuditHistoryEntry({
  auditResult,
}: {
  auditResult: Awaited<ReturnType<typeof loadRecentMutationAudits>> | null;
}) {
  if (!auditResult) return null;

  return (
    <AuditHistoryPanel
      audits={auditResult.ok ? auditResult.audits : []}
      loadError={auditResult.ok ? null : auditResult.message}
      undoMutation={undoMutationAudit}
    />
  );
}

async function signOut() {
  "use server";

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

function AdminToolsMenu({
  auditResult,
  readOnly,
}: {
  auditResult: Awaited<ReturnType<typeof loadRecentMutationAudits>> | null;
  readOnly: boolean;
}) {
  if (readOnly) return null;

  return (
    <details className="group relative">
      <summary className="flex h-9 cursor-pointer list-none items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25">
        Công cụ quản trị
      </summary>
      <div className="absolute right-0 top-11 z-50 grid w-[min(20rem,calc(100vw-1.5rem))] gap-1 rounded-lg border border-border bg-card p-2 shadow-lg">
        <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
          Kiểm tra, sao lưu và lịch sử dữ liệu.
        </p>
        <BulkUtilitiesPanel />
        <DataQualityPanel />
        <DuplicateReviewPanel />
        <AuditHistoryEntry auditResult={auditResult} />
      </div>
    </details>
  );
}

function AccountMenu({
  email,
  role,
}: {
  email: string | undefined;
  role: TreeViewerRole;
}) {
  return (
    <details className="group relative">
      <summary className="flex h-9 cursor-pointer list-none items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25">
        Tài khoản
      </summary>
      <div className="absolute right-0 top-11 z-50 w-[min(19rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {getViewerLabel(role)}
        </p>
        <p className="mt-2 truncate text-sm text-foreground">
          {email ?? "Tài khoản gia phả"}
        </p>
        <form action={signOut} className="mt-4">
          <Button className="w-full" type="submit" variant="outline">
            Đăng xuất
          </Button>
        </form>
      </div>
    </details>
  );
}

export default async function AdminTreePage() {
  const { supabase, user, role } = await requireTreeViewer();
  const readOnly = role === "spectator";
  const mutations = getAdminMutations(role);
  const auditResult = await getAuditHistory(readOnly);
  const { people, relationships } = await loadEditorGraphData(supabase);
  const { activePeopleCount, archivedPeopleCount } = getPeopleCounts(people);

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <header className="relative z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-5 lg:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-display text-2xl tracking-tight text-card-foreground sm:text-3xl">
              Gia phả họ Nguyễn Làng Khô
            </h1>
            <span className="text-xs font-medium text-muted-foreground">
              {getViewerLabel(role)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {activePeopleCount} thành viên · {relationships.length} quan hệ
            {archivedPeopleCount > 0
              ? ` · ${archivedPeopleCount} hồ sơ lưu trữ`
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AdminToolsMenu auditResult={auditResult} readOnly={readOnly} />
          <AccountMenu email={user.email} role={role} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 p-2 sm:p-3">
        <AdminTreeEditor
        archivePerson={mutations.archivePerson}
        createParentChildRelationship={mutations.createParentChildRelationship}
        createPartnership={mutations.createPartnership}
        createPerson={mutations.createPerson}
        people={people}
        readOnly={readOnly}
        relationships={relationships}
        removeRelationship={mutations.removeRelationship}
        restorePerson={mutations.restorePerson}
        saveLayouts={mutations.saveLayouts}
        updatePerson={mutations.updatePerson}
        />
      </div>
    </main>
  );
}
