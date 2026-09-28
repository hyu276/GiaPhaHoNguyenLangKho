"use server";

import { revalidatePath } from "next/cache";

import {
  buildPersonMergePreview,
  type DuplicatePerson,
  type DuplicateRelationship,
  findDuplicateSuggestions,
  type PersonMergePreview,
} from "@/features/tree/duplicate-domain";
import {
  executePersonMergeInputSchema,
  type ExecutePersonMergeInput,
  personMergePairInputSchema,
  type PersonMergePairInput,
} from "@/features/tree/duplicate-input";
import { requireAdmin } from "@/lib/auth/admin";

type AdminContext = Awaited<ReturnType<typeof requireAdmin>>;
type SupabaseAdminClient = AdminContext["supabase"];

type PersonRow = {
  id: string;
  display_name: string;
  description: string | null;
  birth_year: number | null;
  death_year: number | null;
  sex: DuplicatePerson["sex"];
  visibility: DuplicatePerson["visibility"];
  archived_at: string | null;
  merged_into_person_id: string | null;
};

type RelationshipRow = {
  id: string;
  relationship_kind: DuplicateRelationship["relationshipKind"];
  source_person_id: string;
  target_person_id: string;
};

export type DuplicateSuggestionLoadResult =
  | {
      ok: true;
      people: DuplicatePerson[];
      suggestions: ReturnType<typeof findDuplicateSuggestions>;
    }
  | { ok: false; message: string };

export type PersonMergePreviewResult =
  | {
      ok: true;
      targetPerson: DuplicatePerson;
      sourcePerson: DuplicatePerson;
      preview: PersonMergePreview;
      sourcePersonCitationCount: number;
      sourceRelationshipCitationCount: number;
    }
  | { ok: false; message: string };

export type ExecutePersonMergeResult =
  { ok: true; auditId: string } | { ok: false; message: string };

function validationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Dữ liệu merge không hợp lệ.";
}

function mapPerson(row: PersonRow): DuplicatePerson {
  return {
    id: row.id,
    displayName: row.display_name,
    description: row.description,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    sex: row.sex,
    visibility: row.visibility,
    archivedAt: row.archived_at,
    mergedIntoPersonId: row.merged_into_person_id,
  };
}

function mapRelationship(row: RelationshipRow): DuplicateRelationship {
  return {
    id: row.id,
    relationshipKind: row.relationship_kind,
    sourcePersonId: row.source_person_id,
    targetPersonId: row.target_person_id,
  };
}

async function loadActivePeople(supabase: SupabaseAdminClient) {
  const result = await supabase
    .from("people")
    .select(
      "id, display_name, description, birth_year, death_year, sex, visibility, archived_at, merged_into_person_id",
    )
    .is("archived_at", null)
    .is("merged_into_person_id", null)
    .order("display_name");

  if (result.error) return null;
  return (result.data ?? []).map((row) => mapPerson(row as PersonRow));
}

async function loadRelationships(supabase: SupabaseAdminClient) {
  const result = await supabase
    .from("relationships")
    .select("id, relationship_kind, source_person_id, target_person_id");

  if (result.error) return null;
  return (result.data ?? []).map((row) =>
    mapRelationship(row as RelationshipRow),
  );
}

function findPerson(people: DuplicatePerson[], personId: string) {
  return people.find((person) => person.id === personId) ?? null;
}

async function countSourcePersonCitations(
  supabase: SupabaseAdminClient,
  sourcePersonId: string,
) {
  const result = await supabase
    .from("genealogy_citations")
    .select("id", { count: "exact", head: true })
    .eq("person_id", sourcePersonId);

  return result.error ? null : (result.count ?? 0);
}

async function countSourceRelationshipCitations(
  supabase: SupabaseAdminClient,
  relationshipIds: string[],
) {
  if (relationshipIds.length === 0) return 0;

  const result = await supabase
    .from("genealogy_citations")
    .select("id", { count: "exact", head: true })
    .in("relationship_id", relationshipIds);

  return result.error ? null : (result.count ?? 0);
}

async function loadMergePreviewData(
  supabase: SupabaseAdminClient,
  input: PersonMergePairInput,
): Promise<PersonMergePreviewResult> {
  const [people, relationships] = await Promise.all([
    loadActivePeople(supabase),
    loadRelationships(supabase),
  ]);

  if (!people || !relationships) {
    return { ok: false, message: "Không thể tải dữ liệu review merge." };
  }

  const targetPerson = findPerson(people, input.targetPersonId);
  const sourcePerson = findPerson(people, input.sourcePersonId);
  if (!targetPerson || !sourcePerson) {
    return {
      ok: false,
      message: "Target hoặc source không còn là hồ sơ active chưa merge.",
    };
  }

  const preview = buildPersonMergePreview(
    relationships,
    targetPerson.id,
    sourcePerson.id,
  );
  const sourceRelationshipIds = preview.relationshipChanges.map(
    (change) => change.relationshipId,
  );
  const [sourcePersonCitationCount, sourceRelationshipCitationCount] =
    await Promise.all([
      countSourcePersonCitations(supabase, sourcePerson.id),
      countSourceRelationshipCitations(supabase, sourceRelationshipIds),
    ]);

  if (
    sourcePersonCitationCount === null ||
    sourceRelationshipCitationCount === null
  ) {
    return { ok: false, message: "Không thể tải impact citation." };
  }

  return {
    ok: true,
    targetPerson,
    sourcePerson,
    preview,
    sourcePersonCitationCount,
    sourceRelationshipCitationCount,
  };
}

function mergeDatabaseMessage(message: string | undefined) {
  if (!message) return "Không thể merge hai hồ sơ.";

  if (message.includes("direct relationship")) {
    return "Hai hồ sơ đang có quan hệ trực tiếp; cần review thủ công trước khi merge.";
  }

  if (message.includes("ancestry cycle")) {
    return "Merge sẽ tạo vòng lặp tổ tiên nên đã bị hủy toàn bộ.";
  }

  if (message.includes("active unmerged person")) {
    return "Target hoặc source không còn ở trạng thái có thể merge.";
  }

  return "Merge không thể hoàn tất; transaction đã được rollback.";
}

export async function loadDuplicateSuggestions(): Promise<DuplicateSuggestionLoadResult> {
  const { supabase } = await requireAdmin();
  const people = await loadActivePeople(supabase);

  if (!people) {
    return { ok: false, message: "Không thể tải danh sách duplicate review." };
  }

  return {
    ok: true,
    people,
    suggestions: findDuplicateSuggestions(people),
  };
}

export async function loadPersonMergePreview(
  input: PersonMergePairInput,
): Promise<PersonMergePreviewResult> {
  const parsed = personMergePairInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  return loadMergePreviewData(supabase, parsed.data);
}

export async function executeDuplicatePersonMerge(
  input: ExecutePersonMergeInput,
): Promise<ExecutePersonMergeResult> {
  const parsed = executePersonMergeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  const previewResult = await loadMergePreviewData(supabase, parsed.data);
  if (!previewResult.ok) return previewResult;

  if (previewResult.preview.blockers.length > 0) {
    return {
      ok: false,
      message: "Merge đang có blocker; không có thay đổi nào được thực hiện.",
    };
  }

  const { data, error } = await supabase.rpc("merge_genealogy_people", {
    p_target_person_id: parsed.data.targetPersonId,
    p_source_person_id: parsed.data.sourcePersonId,
  });

  if (error || typeof data !== "string") {
    return {
      ok: false,
      message: mergeDatabaseMessage(error?.message),
    };
  }

  revalidatePath("/admin/tree");
  return { ok: true, auditId: data };
}
