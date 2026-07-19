import { ClientsManager } from "@/components/clients-manager";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";
import "./clients.css";

export default async function ClientsPage() {
  const business = await requireCurrentBusiness();
  const supabase = await createClient();

  const [{ data: clients, error: clientsError }, { data: appointments, error: appointmentsError }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, phone, email, notes, created_at, updated_at")
      .eq("business_id", business.id)
      .order("name"),
    supabase
      .from("appointments")
      .select("id, client_id, starts_at, status, services(name), professionals(name)")
      .eq("business_id", business.id)
      .order("starts_at", { ascending: false }),
  ]);

  if (clientsError) throw new Error(`Não foi possível carregar os clientes: ${clientsError.message}`);
  if (appointmentsError) throw new Error(`Não foi possível carregar o histórico: ${appointmentsError.message}`);

  return <ClientsManager businessId={business.id} initialClients={clients ?? []} initialAppointments={appointments ?? []} />;
}
