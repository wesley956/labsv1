import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

let cachedAdminClient: SupabaseClient<any> | null = null;

export function createAdminClient(): SupabaseClient<any> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseConfig.url || !serviceRoleKey) {
    throw new Error("Supabase administrativo não configurado.");
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient<any>(supabaseConfig.url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  return cachedAdminClient;
}
