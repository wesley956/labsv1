import { AvailabilityManager } from "@/components/availability-manager";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";
import "./availability.css";

export default async function AvailabilityPage() {
  const business = await requireCurrentBusiness();
  const supabase = await createClient();

  const [{ data: professionals, error: professionalsError }, { data: availability, error: availabilityError }, { data: blocks, error: blocksError }] = await Promise.all([
    supabase.from("professionals").select("id,name,specialty,active").eq("business_id", business.id).eq("active", true).order("name"),
    supabase.from("weekly_availability").select("id,professional_id,weekday,enabled,start_time,end_time").eq("business_id", business.id).order("weekday"),
    supabase.from("availability_blocks").select("id,professional_id,block_date,all_day,start_time,end_time,reason").eq("business_id", business.id).gte("block_date", new Date().toISOString().slice(0, 10)).order("block_date"),
  ]);

  const error = professionalsError ?? availabilityError ?? blocksError;
  if (error) throw new Error(`Não foi possível carregar a disponibilidade: ${error.message}`);

  return <AvailabilityManager businessId={business.id} initialProfessionals={professionals ?? []} initialAvailability={availability ?? []} initialBlocks={blocks ?? []} />;
}
