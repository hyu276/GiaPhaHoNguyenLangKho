/**
 * ENVIRONMENT_VALIDATION
 *
 * Purpose: Validates public Supabase configuration before a client is constructed.
 * Connections: Browser and server Supabase client factories.
 * Risk: Medium because invalid environment configuration blocks data access.
 */
import { z } from "zod";

const supabasePublicEnvironmentSchema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(1),
});

export function getSupabasePublicEnvironment() {
  const result = supabasePublicEnvironmentSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    throw new Error(
      "Supabase public environment variables are missing or invalid.",
    );
  }

  return result.data;
}
