import { AppointmentsManager } from "@/components/appointments-manager";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import "./appointments.css";

export default async function AppointmentsPage() {
  const business = await requireCurrentBusiness();
  return <AppointmentsManager businessId={business.id} />;
}
