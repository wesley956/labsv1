import { RemindersManager } from "@/components/reminders-manager";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";

export default async function RemindersPage() {
  const business = await requireCurrentBusiness();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const appointmentsResult = await supabase.from("appointments").select("id,customer_name,customer_phone,service_name,professional_name,appointment_date,start_time,status,reminder_24h_sent_at,reminder_2h_sent_at").eq("business_id", business.id).neq("status", "cancelled").gte("appointment_date", today).lte("appointment_date", future).order("appointment_date").order("start_time");
  const settingsResult = await supabase.from("businesses").select("name,reminder_24h_enabled,reminder_2h_enabled,reminder_24h_template,reminder_2h_template").eq("id", business.id).single();
  const error = appointmentsResult.error ?? settingsResult.error;
  if (error) throw new Error(`Não foi possível carregar os lembretes: ${error.message}`);
  return <RemindersManager businessId={business.id} appointments={appointmentsResult.data ?? []} settings={settingsResult.data} />;
}
