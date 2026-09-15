import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_ROLE = "admin";

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/admin/login");
  }

  if (user.app_metadata.role !== ADMIN_ROLE) {
    redirect("/admin/login?error=forbidden");
  }

  return { supabase, user };
}
