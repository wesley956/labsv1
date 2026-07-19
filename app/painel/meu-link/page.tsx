import { PublicLinkManager } from "@/components/public-link-manager";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import "./public-link.css";

export default async function PublicLinkPage() {
  const business = await requireCurrentBusiness();
  return <PublicLinkManager businessName={business.name} slug={business.slug} />;
}
