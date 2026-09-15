/**
 * SUPABASE_SERVER_CLIENT
 *
 * Purpose: Creates a cookie-aware Supabase client for trusted Next.js server execution.
 * Connections: Server Components, Server Actions, Route Handlers, and Supabase Auth.
 * Risk: High because incorrect cookie handling can invalidate or expose user sessions.
 */
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicEnvironment } from "@/lib/validation/environment";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicEnvironment();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. A future auth proxy owns refresh writes.
        }
      },
    },
  });
}
