import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client with the project's secret key. It bypasses row-level security, so use it only for
 * work no signed-in user can do themselves: creating accounts from invites, and seeding.
 * Returns null when SUPABASE_SECRET_KEY isn't configured.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
