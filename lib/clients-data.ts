import { AppointmentRecord } from "./appointments-data";

export const CLIENTS_STORAGE_KEY = "cruz-agenda-clients-v1";

export type ClientRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

function id() {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function loadClients(): ClientRecord[] {
  const raw = window.localStorage.getItem(CLIENTS_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as ClientRecord[]) : [];
}

export function saveClients(items: ClientRecord[]) {
  window.localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(items));
}

export function syncClientsFromAppointments(clients: ClientRecord[], appointments: AppointmentRecord[]) {
  const next = [...clients];
  for (const appointment of appointments) {
    const phone = normalizePhone(appointment.customerPhone);
    const existing = next.find((client) => normalizePhone(client.phone) === phone && phone);
    if (existing) {
      existing.name = appointment.customerName || existing.name;
      existing.phone = appointment.customerPhone || existing.phone;
      existing.updatedAt = new Date().toISOString();
    } else if (appointment.customerName && appointment.customerPhone) {
      next.push({ id: id(), name: appointment.customerName, phone: appointment.customerPhone, email: "", notes: "", createdAt: appointment.createdAt, updatedAt: appointment.createdAt });
    }
  }
  saveClients(next);
  return next;
}

export function createClient(input: Pick<ClientRecord, "name" | "phone" | "email" | "notes">): ClientRecord {
  const now = new Date().toISOString();
  return { ...input, id: id(), createdAt: now, updatedAt: now };
}
