import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function createClient() {
  if (!supabaseConfig.url || !supabaseConfig.publishableKey) {
    throw new Error("Supabase ainda não configurado. Preencha o arquivo .env.local.");
  }

  const cookieStore = await cookies();

  return createServerClient(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components podem não permitir escrita de cookies.
          }
        },
      },
    },
  );
}
