import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  if (!supabaseConfig.url || !supabaseConfig.publishableKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          headersToSet?.forEach(({ name, value }) => response.headers.set(name, value));
        },
      },
    },
  );

  // Valida/renova a sessão. Não confie apenas em cookies sem esta chamada.
  await supabase.auth.getClaims();

  return response;
}
