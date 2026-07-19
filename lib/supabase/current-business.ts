import { redirect } from "next/navigation";
import { createClient } from "./server";

export type CurrentBusiness = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "staff";
  userId: string;
  userEmail: string;
};

export async function requireCurrentBusiness(): Promise<CurrentBusiness> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("business_members")
    .select("role, businesses!inner(id, name, slug)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Não foi possível carregar o estabelecimento: ${membershipError.message}`);
  }

  if (!membership) redirect("/onboarding");

  const business = Array.isArray(membership.businesses)
    ? membership.businesses[0]
    : membership.businesses;

  if (!business) redirect("/onboarding");

  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    role: membership.role,
    userId: user.id,
    userEmail: user.email ?? "",
  };
}
