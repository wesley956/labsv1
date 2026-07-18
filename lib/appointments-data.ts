import { AvailabilityBlock, WeeklyAvailability } from "./availability-data";
import { ProfessionalRecord, ServiceRecord } from "./local-data";

export const APPOINTMENTS_STORAGE_KEY = "cruz-agenda-appointments-v1";

export type AppointmentStatus = "confirmed" | "completed" | "cancelled" | "no_show";
export type AppointmentOrigin = "manual" | "public";

export type AppointmentRecord = {
  id: string;
  customerName: string;
  customerPhone: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  serviceDuration: number;
  servicePrice: string;
  date: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  origin: AppointmentOrigin;
  notes: string;
  createdAt: string;
};

function id() {
  return `appointment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadAppointments(): AppointmentRecord[] {
  const raw = window.localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AppointmentRecord[]) : [];
}

export function saveAppointments(items: AppointmentRecord[]) {
  window.localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(items));
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(value: number) {
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function intervalsOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

export function getAvailableSlots({
  date,
  professional,
  service,
  availability,
  blocks,
  appointments,
  step = 30,
}: {
  date: string;
  professional: ProfessionalRecord;
  service: ServiceRecord;
  availability: WeeklyAvailability[];
  blocks: AvailabilityBlock[];
  appointments: AppointmentRecord[];
  step?: number;
}) {
  if (!date || !professional.active || !service.active || !service.professionalIds.includes(professional.id)) return [];

  const weekday = new Date(`${date}T12:00:00`).getDay();
  const day = availability.find((item) => item.professionalId === professional.id && item.weekday === weekday);
  if (!day?.enabled) return [];

  const dayBlocks = blocks.filter((block) => block.professionalId === professional.id && block.date === date);
  if (dayBlocks.some((block) => block.allDay)) return [];

  const busyAppointments = appointments.filter((appointment) =>
    appointment.professionalId === professional.id &&
    appointment.date === date &&
    appointment.status !== "cancelled"
  );

  const slots: string[] = [];
  for (const period of day.periods) {
    const periodStart = timeToMinutes(period.start);
    const periodEnd = timeToMinutes(period.end);

    for (let start = periodStart; start + service.duration <= periodEnd; start += step) {
      const end = start + service.duration;
      const blocked = dayBlocks.some((block) =>
        !block.allDay && intervalsOverlap(start, end, timeToMinutes(block.start), timeToMinutes(block.end))
      );
      const occupied = busyAppointments.some((appointment) =>
        intervalsOverlap(start, end, timeToMinutes(appointment.start), timeToMinutes(appointment.end))
      );
      if (!blocked && !occupied) slots.push(minutesToTime(start));
    }
  }

  return slots;
}

export function createAppointment(input: Omit<AppointmentRecord, "id" | "end" | "createdAt">): AppointmentRecord {
  return {
    ...input,
    id: id(),
    end: minutesToTime(timeToMinutes(input.start) + input.serviceDuration),
    createdAt: new Date().toISOString(),
  };
}
