import { redirect } from "next/navigation";
import { createClient } from "./server";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "suspended";

export type CurrentBusiness = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "staff";
  userId: string;
  userEmail: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  subscriptionGraceEndsAt: string | null;
  subscriptionAccessible: boolean;
};

function hasSubscriptionAccess(status: SubscriptionStatus, trialEndsAt: string | null, graceEndsAt: string | null) {
  const now = Date.now();
  if (status === "active") return true;
  if (status === "trialing") return Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > now);
  if (status === "past_due") return Boolean(graceEndsAt && new Date(graceEndsAt).getTime() > now);
  return false;
}

export async function requireCurrentBusiness(): Promise<CurrentBusiness> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("business_members")
    .select("role, businesses!inner(id, name, slug, subscription_status, trial_ends_at, subscription_grace_ends_at)")
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

  const subscriptionStatus = (business.subscription_status ?? "suspended") as SubscriptionStatus;
  const trialEndsAt = business.trial_ends_at ?? null;
  const subscriptionGraceEndsAt = business.subscription_grace_ends_at ?? null;

  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    role: membership.role,
    userId: user.id,
    userEmail: user.email ?? "",
    subscriptionStatus,
    trialEndsAt,
    subscriptionGraceEndsAt,
    subscriptionAccessible: hasSubscriptionAccess(subscriptionStatus, trialEndsAt, subscriptionGraceEndsAt),
  };
}
