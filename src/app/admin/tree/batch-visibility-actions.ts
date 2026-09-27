"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  batchVisibilityInputSchema,
  type BatchVisibilityInput,
} from "@/features/tree/bulk-utils";
import { requireAdmin } from "@/lib/auth/admin";

export type BatchVisibilityCandidate = {
  id: string;
  displayName: string;
  visibility: "public" | "private";
  birthYear: number | null;
  deathYear: number | null;
  revision: number;
};

export type BatchVisibilityLoadResult =
  | { ok: true; people: BatchVisibilityCandidate[] }
  | { ok: false; message: string };

export type BatchVisibilityResult =
  | { ok: true; revisions: Array<{ personId: string; revision: number }> }
  | { ok: false; message: string; kind?: "conflict" };

const candidateSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  visibility: z.enum(["public", "private"]),
  birth_year: z.number().nullable(),
  death_year: z.number().nullable(),
  revision: z.number().int().min(1),
});

const revisionResultSchema = z.array(
  z.object({
    person_id: z.string().uuid(),
    revision: z.number().int().min(1),
  }),
);

function validationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "Batch visibility không hợp lệ.";
}

function batchFailure(error: { code?: string; message?: string } | null) {
  if (
    error?.code === "40001" ||
    error?.message?.includes("stale person revision")
  ) {
    return {
      ok: false as const,
      kind: "conflict" as const,
      message:
        "Một hoặc nhiều hồ sơ đã thay đổi sau khi mở impact review. Toàn bộ batch đã rollback; hãy tải lại danh sách.",
    };
  }

  if (error?.message?.includes("person not active unmerged")) {
    return {
      ok: false as const,
      message:
        "Batch chứa hồ sơ đã archived/merged hoặc không còn khả dụng. Không có thay đổi nào được áp dụng.",
    };
  }

  return {
    ok: false as const,
    message: "Không thể áp dụng batch visibility. Toàn bộ batch đã rollback.",
  };
}

export async function loadBatchVisibilityCandidates(): Promise<BatchVisibilityLoadResult> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("people")
    .select(
      "id, display_name, visibility, birth_year, death_year, revision",
    )
    .is("archived_at", null)
    .is("merged_into_person_id", null)
    .order("display_name");

  if (error) {
    return { ok: false, message: "Không thể tải hồ sơ cho batch visibility." };
  }

  const people = z.array(candidateSchema).parse(data ?? []).map((person) => ({
    id: person.id,
    displayName: person.display_name,
    visibility: person.visibility,
    birthYear: person.birth_year,
    deathYear: person.death_year,
    revision: person.revision,
  }));

  return { ok: true, people };
}

export async function executeBatchVisibility(
  input: BatchVisibilityInput,
): Promise<BatchVisibilityResult> {
  const parsed = batchVisibilityInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: validationMessage(parsed.error) };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc(
    "set_people_visibility_if_current",
    {
      p_visibility: parsed.data.visibility,
      p_people: parsed.data.people,
    },
  );

  if (error) return batchFailure(error);

  const revisions = revisionResultSchema.parse(data ?? []).map((row) => ({
    personId: row.person_id,
    revision: row.revision,
  }));

  revalidatePath("/admin/tree");
  return { ok: true, revisions };
}
