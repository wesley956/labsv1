import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

let cachedAdminClient: ReturnType<typeof createClient> | null = null;

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseConfig.url || !serviceRoleKey) {
    throw new Error("Supabase administrativo não configurado.");
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(supabaseConfig.url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  return cachedAdminClient;
}
