import { createClient } from "@/lib/supabase/client";

export type OnboardingPayload = {
  business: { name: string; segment: string; phone: string; city: string; slug: string };
  professional: { name: string; specialty: string };
  services: { name: string; duration: string; price: string }[];
  days: { enabled: boolean; start: string; end: string }[];
};

function parsePrice(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const result = Number(normalized);
  return Number.isFinite(result) ? result : 0;
}

export async function persistOnboarding(payload: OnboardingPayload) {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente.");

  const { data: current } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userData.user.id)
    .maybeSingle();
  if (current) return current.id;

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .insert({
      owner_id: userData.user.id,
      name: payload.business.name.trim(),
      segment: payload.business.segment,
      phone: payload.business.phone.trim(),
      city: payload.business.city.trim(),
      slug: payload.business.slug.trim(),
      public_description: "Agende seu atendimento de forma rápida e segura.",
    })
    .select("id")
    .single();
  if (businessError) throw new Error(businessError.code === "23505" ? "Esse link público já está em uso." : businessError.message);

  const { data: professional, error: professionalError } = await supabase
    .from("professionals")
    .insert({
      business_id: business.id,
      name: payload.professional.name.trim(),
      specialty: payload.professional.specialty.trim(),
      phone: payload.business.phone.trim(),
    })
    .select("id")
    .single();
  if (professionalError) throw new Error(professionalError.message);

  const validServices = payload.services.filter((item) => item.name.trim());
  const { data: services, error: servicesError } = await supabase
    .from("services")
    .insert(validServices.map((item) => ({
      business_id: business.id,
      name: item.name.trim(),
      duration_minutes: Number(item.duration),
      price: parsePrice(item.price),
    })))
    .select("id");
  if (servicesError) throw new Error(servicesError.message);

  if (services?.length) {
    const { error: linksError } = await supabase.from("service_professionals").insert(
      services.map((item) => ({ business_id: business.id, professional_id: professional.id, service_id: item.id })),
    );
    if (linksError) throw new Error(linksError.message);
  }

  const availability = payload.days
    .map((day, index) => ({ day, weekday: (index + 1) % 7 }))
    .filter(({ day }) => day.enabled)
    .map(({ day, weekday }) => ({
      business_id: business.id,
      professional_id: professional.id,
      weekday,
      enabled: true,
      start_time: day.start,
      end_time: day.end,
    }));
  const { error: availabilityError } = await supabase.from("weekly_availability").insert(availability);
  if (availabilityError) throw new Error(availabilityError.message);

  return business.id;
}
