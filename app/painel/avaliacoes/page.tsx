import { ReviewsManager } from "@/components/reviews-manager";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";

export default async function ReviewsPage() {
  const business = await requireCurrentBusiness();
  const supabase = await createClient();
  const { data, error } = await supabase.from("reviews").select("id,customer_name,rating,comment,approved,created_at,appointments(service_name,professional_name,appointment_date)").eq("business_id", business.id).order("created_at", { ascending: false });
  if (error) throw new Error(`Não foi possível carregar as avaliações: ${error.message}`);
  return <ReviewsManager businessId={business.id} initialItems={(data ?? []) as any} />;
}
