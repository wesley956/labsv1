export const ONBOARDING_STORAGE_KEY = "cruz-agenda-onboarding-v1";
export const PROFESSIONALS_STORAGE_KEY = "cruz-agenda-professionals-v1";
export const SERVICES_STORAGE_KEY = "cruz-agenda-services-v1";

export type ProfessionalRecord = {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  active: boolean;
};

export type ServiceRecord = {
  id: string;
  name: string;
  duration: number;
  price: string;
  professionalIds: string[];
  active: boolean;
};

type OnboardingDraft = {
  professional?: { name?: string; specialty?: string };
  services?: Array<{ name?: string; duration?: string; price?: string }>;
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadProfessionals(): ProfessionalRecord[] {
  const stored = window.localStorage.getItem(PROFESSIONALS_STORAGE_KEY);
  if (stored) return JSON.parse(stored) as ProfessionalRecord[];

  const onboarding = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  const draft = onboarding ? (JSON.parse(onboarding) as OnboardingDraft) : null;
  const first = draft?.professional;
  const initial: ProfessionalRecord[] = first?.name
    ? [{ id: makeId("professional"), name: first.name, specialty: first.specialty || "Profissional", phone: "", active: true }]
    : [];

  saveProfessionals(initial);
  return initial;
}

export function saveProfessionals(items: ProfessionalRecord[]) {
  window.localStorage.setItem(PROFESSIONALS_STORAGE_KEY, JSON.stringify(items));
}

export function loadServices(professionals: ProfessionalRecord[]): ServiceRecord[] {
  const stored = window.localStorage.getItem(SERVICES_STORAGE_KEY);
  if (stored) return JSON.parse(stored) as ServiceRecord[];

  const onboarding = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  const draft = onboarding ? (JSON.parse(onboarding) as OnboardingDraft) : null;
  const firstProfessionalId = professionals[0]?.id;
  const initial = (draft?.services || [])
    .filter((service) => service.name)
    .map((service) => ({
      id: makeId("service"),
      name: service.name || "Serviço",
      duration: Number(service.duration || 30),
      price: service.price || "R$ 0,00",
      professionalIds: firstProfessionalId ? [firstProfessionalId] : [],
      active: true,
    }));

  saveServices(initial);
  return initial;
}

export function saveServices(items: ServiceRecord[]) {
  window.localStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(items));
}

export function createLocalId(prefix: string) {
  return makeId(prefix);
}
