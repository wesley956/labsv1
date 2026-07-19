import { ProfessionalsManager } from "@/components/professionals-manager";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";

export default async function ProfessionalsPage() {
  const business = await requireCurrentBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("professionals")
    .select("id, name, specialty, phone, active")
    .eq("business_id", business.id)
    .order("name");

  if (error) {
    throw new Error(`Não foi possível carregar os profissionais: ${error.message}`);
  }

  return <ProfessionalsManager businessId={business.id} initialItems={data ?? []} />;
}
