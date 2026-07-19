import { ServicesManager } from "@/components/services-manager";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";

export default async function ServicesPage() {
  const business = await requireCurrentBusiness();
  const supabase = await createClient();

  const [{ data: professionals, error: professionalsError }, { data: services, error: servicesError }] = await Promise.all([
    supabase.from("professionals").select("id,name,specialty,active").eq("business_id", business.id).order("name"),
    supabase.from("services").select("id,name,duration_minutes,price,active,service_professionals(professional_id)").eq("business_id", business.id).order("name"),
  ]);

  if (professionalsError) throw new Error(`Não foi possível carregar os profissionais: ${professionalsError.message}`);
  if (servicesError) throw new Error(`Não foi possível carregar os serviços: ${servicesError.message}`);

  return <ServicesManager businessId={business.id} initialProfessionals={professionals ?? []} initialServices={(services ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    duration: service.duration_minutes,
    price: Number(service.price),
    active: service.active,
    professionalIds: service.service_professionals.map((item) => item.professional_id),
  }))} />;
}
