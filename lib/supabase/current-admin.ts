import { redirect } from "next/navigation";
import { createClient } from "./server";

export type PlatformAdminRole = "super_admin" | "support";

export type CurrentPlatformAdmin = {
  userId: string;
  email: string;
  role: PlatformAdminRole;
};

export async function requirePlatformAdmin(): Promise<CurrentPlatformAdmin> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/admin/login");

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("role,active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (adminError) {
    throw new Error(`Não foi possível validar o acesso administrativo: ${adminError.message}`);
  }

  if (!admin) redirect("/admin/login?error=unauthorized");

  return {
    userId: user.id,
    email: user.email ?? "",
    role: admin.role as PlatformAdminRole,
  };
}
