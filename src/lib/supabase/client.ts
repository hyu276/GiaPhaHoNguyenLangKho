/**
 * SUPABASE_BROWSER_CLIENT
 *
 * Purpose: Creates the browser-scoped Supabase client using only publishable credentials.
 * Connections: Client Components that require authenticated Supabase browser access.
 * Risk: High because this module participates directly in browser authentication state.
 */
import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnvironment } from "@/lib/validation/environment";

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabasePublicEnvironment();

  return createBrowserClient(url, publishableKey);
}
