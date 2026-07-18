import { ONBOARDING_STORAGE_KEY, ProfessionalRecord } from "./local-data";

export const AVAILABILITY_STORAGE_KEY = "cruz-agenda-availability-v1";
export const BLOCKS_STORAGE_KEY = "cruz-agenda-availability-blocks-v1";

export type AvailabilityPeriod = {
  id: string;
  start: string;
  end: string;
};

export type WeeklyAvailability = {
  professionalId: string;
  weekday: number;
  label: string;
  enabled: boolean;
  periods: AvailabilityPeriod[];
};

export type AvailabilityBlock = {
  id: string;
  professionalId: string;
  date: string;
  allDay: boolean;
  start: string;
  end: string;
  reason: string;
};

type OnboardingDraft = {
  days?: Array<{ label?: string; enabled?: boolean; start?: string; end?: string }>;
};

const weekdayLabels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultSchedule(professionalId: string): WeeklyAvailability[] {
  return weekdayLabels.map((label, weekday) => ({
    professionalId,
    weekday,
    label,
    enabled: weekday !== 0,
    periods: weekday === 0 ? [] : [{ id: id("period"), start: "09:00", end: weekday === 6 ? "13:00" : "18:00" }],
  }));
}

function scheduleFromOnboarding(professionalId: string): WeeklyAvailability[] | null {
  const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  if (!raw) return null;

  const draft = JSON.parse(raw) as OnboardingDraft;
  if (!draft.days?.length) return null;

  return weekdayLabels.map((label, weekday) => {
    const source = draft.days?.find((day) => day.label === label);
    const enabled = Boolean(source?.enabled);
    return {
      professionalId,
      weekday,
      label,
      enabled,
      periods: enabled ? [{ id: id("period"), start: source?.start || "09:00", end: source?.end || "18:00" }] : [],
    };
  });
}

export function loadAvailability(professionals: ProfessionalRecord[]): WeeklyAvailability[] {
  const raw = window.localStorage.getItem(AVAILABILITY_STORAGE_KEY);
  const stored = raw ? (JSON.parse(raw) as WeeklyAvailability[]) : [];
  const activeIds = new Set(professionals.map((professional) => professional.id));
  const filtered = stored.filter((item) => activeIds.has(item.professionalId));

  for (const professional of professionals) {
    if (!filtered.some((item) => item.professionalId === professional.id)) {
      const imported = filtered.length === 0 ? scheduleFromOnboarding(professional.id) : null;
      filtered.push(...(imported || defaultSchedule(professional.id)));
    }
  }

  saveAvailability(filtered);
  return filtered;
}

export function saveAvailability(items: WeeklyAvailability[]) {
  window.localStorage.setItem(AVAILABILITY_STORAGE_KEY, JSON.stringify(items));
}

export function loadBlocks(): AvailabilityBlock[] {
  const raw = window.localStorage.getItem(BLOCKS_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AvailabilityBlock[]) : [];
}

export function saveBlocks(items: AvailabilityBlock[]) {
  window.localStorage.setItem(BLOCKS_STORAGE_KEY, JSON.stringify(items));
}

export function createAvailabilityId(prefix: string) {
  return id(prefix);
}
