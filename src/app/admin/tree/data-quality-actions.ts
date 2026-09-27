"use server";

import {
  buildDataQualityReport,
  type DataQualityReport,
} from "@/features/tree/data-quality";
import type {
  DuplicatePerson,
  DuplicateRelationship,
} from "@/features/tree/duplicate-domain";
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

type CitationRelationshipRow = {
  relationship_id: string | null;
};

export type DataQualityLoadResult =
  | {
      ok: true;
      report: DataQualityReport;
      people: Array<{ id: string; displayName: string }>;
      relationships: DuplicateRelationship[];
    }
  | { ok: false; message: string };

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

async function loadQualityPeople(supabase: SupabaseAdminClient) {
  const result = await supabase
    .from("people")
    .select(
      "id, display_name, description, birth_year, death_year, sex, visibility, archived_at, merged_into_person_id",
    )
    .order("display_name");

  if (result.error) return null;
  return (result.data ?? []).map((row) => mapPerson(row as PersonRow));
}

async function loadQualityRelationships(supabase: SupabaseAdminClient) {
  const result = await supabase
    .from("relationships")
    .select("id, relationship_kind, source_person_id, target_person_id");

  if (result.error) return null;
  return (result.data ?? []).map((row) =>
    mapRelationship(row as RelationshipRow),
  );
}

async function loadCitedRelationshipIds(supabase: SupabaseAdminClient) {
  const result = await supabase
    .from("genealogy_citations")
    .select("relationship_id");

  if (result.error) return null;

  return new Set(
    ((result.data ?? []) as CitationRelationshipRow[])
      .map((row) => row.relationship_id)
      .filter((id): id is string => id !== null),
  );
}

export async function loadDataQualityReport(): Promise<DataQualityLoadResult> {
  const { supabase } = await requireAdmin();
  const [people, relationships, citedRelationshipIds] = await Promise.all([
    loadQualityPeople(supabase),
    loadQualityRelationships(supabase),
    loadCitedRelationshipIds(supabase),
  ]);

  if (!people || !relationships || !citedRelationshipIds) {
    return {
      ok: false,
      message: "Không thể tải dữ liệu kiểm tra chất lượng.",
    };
  }

  const report = buildDataQualityReport({
    people,
    relationships,
    citedRelationshipIds,
  });

  return {
    ok: true,
    report,
    people: people.map((person) => ({
      id: person.id,
      displayName: person.displayName,
    })),
    relationships,
  };
}
