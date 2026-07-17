import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

export function createClient() {
  if (!supabaseConfig.url || !supabaseConfig.publishableKey) {
    throw new Error("Supabase ainda não configurado. Preencha o arquivo .env.local.");
  }

  return createBrowserClient(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
  );
}
