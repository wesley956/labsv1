import { AgendaBoard } from "@/components/agenda-board";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import "./agenda.css";

export default async function AgendaPage() {
  const business = await requireCurrentBusiness();
  return <AgendaBoard businessId={business.id} />;
}
