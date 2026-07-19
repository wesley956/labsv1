import { SettingsManager } from "@/components/settings-manager";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import "./settings.css";

export default async function SettingsPage() {
  const business = await requireCurrentBusiness();
  return <SettingsManager businessId={business.id} />;
}
