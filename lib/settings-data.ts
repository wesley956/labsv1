import { ONBOARDING_STORAGE_KEY } from "./local-data";

export const SETTINGS_STORAGE_KEY = "cruz-agenda-settings-v1";

export type ThemePreference = "system" | "light" | "dark";

export type BusinessSettings = {
  businessName: string;
  segment: string;
  phone: string;
  city: string;
  address: string;
  slug: string;
  publicDescription: string;
  minimumNoticeHours: number;
  bookingWindowDays: number;
  slotStepMinutes: number;
  allowClientCancellation: boolean;
  cancellationNoticeHours: number;
  theme: ThemePreference;
  showPricesPublicly: boolean;
  showProfessionalSpecialty: boolean;
};

type OnboardingDraft = {
  business?: {
    name?: string;
    segment?: string;
    phone?: string;
    city?: string;
    slug?: string;
  };
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function defaultSettings(): BusinessSettings {
  return {
    businessName: "Studio Bella",
    segment: "Beleza e estética",
    phone: "",
    city: "",
    address: "",
    slug: "studio-bella",
    publicDescription: "Agende seu atendimento de forma rápida e segura.",
    minimumNoticeHours: 2,
    bookingWindowDays: 60,
    slotStepMinutes: 30,
    allowClientCancellation: true,
    cancellationNoticeHours: 4,
    theme: "system",
    showPricesPublicly: true,
    showProfessionalSpecialty: true,
  };
}

export function loadSettings(): BusinessSettings {
  const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (stored) return { ...defaultSettings(), ...(JSON.parse(stored) as Partial<BusinessSettings>) };

  const onboardingRaw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  const draft = onboardingRaw ? (JSON.parse(onboardingRaw) as OnboardingDraft) : null;
  const business = draft?.business;
  const initial = {
    ...defaultSettings(),
    businessName: business?.name || "Studio Bella",
    segment: business?.segment || "Beleza e estética",
    phone: business?.phone || "",
    city: business?.city || "",
    slug: business?.slug || slugify(business?.name || "Studio Bella"),
  };
  saveSettings(initial);
  return initial;
}

export function saveSettings(settings: BusinessSettings) {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

  const onboardingRaw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  const onboarding = onboardingRaw ? JSON.parse(onboardingRaw) : {};
  const next = {
    ...onboarding,
    business: {
      ...(onboarding.business || {}),
      name: settings.businessName,
      segment: settings.segment,
      phone: settings.phone,
      city: settings.city,
      slug: settings.slug,
    },
  };
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next));
}

export function normalizeSlug(value: string) {
  return slugify(value);
}
