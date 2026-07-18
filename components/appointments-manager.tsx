"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { loadAvailability, loadBlocks } from "@/lib/availability-data";
import {
  AppointmentRecord,
  AppointmentStatus,
  createAppointment,
  getAvailableSlots,
  loadAppointments,
  saveAppointments,
} from "@/lib/appointments-data";
import { loadProfessionals, loadServices, ProfessionalRecord, ServiceRecord } from "@/lib/local-data";

type FormState = {
  customerName: string;
  customerPhone: string;
  professionalId: string;
  serviceId: string;
  date: string;
  start: string;
  notes: string;
};

const emptyForm: FormState = {
  customerName: "",
  customerPhone: "",
  professionalId: "",
  serviceId: "",
  date: new Date().toISOString().slice(0, 10),
  start: "",
  notes: "",
};

const statusLabels: Record<AppointmentStatus, string> = {
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export function AppointmentsManager() {
  const [professionals, setProfessionals] = useState<ProfessionalRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AppointmentStatus>("all");

  useEffect(() => {
    const loadedProfessionals = loadProfessionals();
    setProfessionals(loadedProfessionals);
    setServices(loadServices(loadedProfessionals));
    setAppointments(loadAppointments());
  }, []);

  const availableServices = useMemo(
    () => services.filter((service) => service.active && service.professionalIds.includes(form.professionalId)),
    [services, form.professionalId],
  );

  const selectedProfessional = professionals.find((item) => item.id === form.professionalId);
  const selectedService = services.find((item) => item.id === form.serviceId);

  const slots = useMemo(() => {
    if (!selectedProfessional || !selectedService) return [];
    return getAvailableSlots({
      date: form.date,
      professional: selectedProfessional,
      service: selectedService,
      availability: loadAvailability(professionals.filter((item) => item.active)),
      blocks: loadBlocks(),
      appointments,
    });
  }, [appointments, form.date, professionals, selectedProfessional, selectedService]);

  const filtered = useMemo(() => appointments
    .filter((item) => statusFilter === "all" || item.status === statusFilter)
    .filter((item) => `${item.customerName} ${item.customerPhone} ${item.serviceName} ${item.professionalName}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`)), [appointments, search, statusFilter]);

  function persist(next: AppointmentRecord[]) {
    setAppointments(next);
    saveAppointments(next);
  }

  function openCreate() {
    const firstProfessional = professionals.find((item) => item.active);
    setForm({ ...emptyForm, professionalId: firstProfessional?.id || "" });
    setOpen(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedProfessional || !selectedService || !form.start || !form.customerName || !form.customerPhone) return;

    const record = createAppointment({
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      professionalId: selectedProfessional.id,
      professionalName: selectedProfessional.name,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      serviceDuration: selectedService.duration,
      servicePrice: selectedService.price,
      date: form.date,
      start: form.start,
      status: "confirmed",
      origin: "manual",
      notes: form.notes.trim(),
    });

    persist([...appointments, record]);
    setOpen(false);
  }

  function updateStatus(id: string, status: AppointmentStatus) {
    persist(appointments.map((item) => item.id === id ? { ...item, status } : item));
  }

  return <div className="content">
    <div className="page-heading">
      <div><h1>Agendamentos</h1><p>Crie, acompanhe e atualize os atendimentos do estabelecimento.</p></div>
      <button className="button button-primary" onClick={openCreate}>+ Novo agendamento</button>
    </div>

    <div className="manager-toolbar card">
      <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, serviço ou profissional" />
      <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | AppointmentStatus)}>
        <option value="all">Todos os status</option>
        {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </div>

    <div className="card panel table-wrap">
      {filtered.length ? <table className="table"><thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Status</th><th>Ações</th></tr></thead><tbody>
        {filtered.map((item) => <tr key={item.id}>
          <td><strong>{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}</strong><div className="table-muted">{item.start}–{item.end}</div></td>
          <td><strong>{item.customerName}</strong><div className="table-muted">{item.customerPhone}</div></td>
          <td>{item.serviceName}<div className="table-muted">{item.servicePrice} · {item.serviceDuration} min</div></td>
          <td>{item.professionalName}</td>
          <td><span className={`badge ${item.status === "confirmed" ? "badge-purple" : item.status === "completed" ? "badge-success" : ""}`}>{statusLabels[item.status]}</span></td>
          <td><select className="input compact-input" value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as AppointmentStatus)}>
            {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></td>
        </tr>)}
      </tbody></table> : <div className="empty-state"><h3>Nenhum agendamento encontrado</h3><p>Crie o primeiro atendimento manual ou altere os filtros.</p></div>}
    </div>

    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><div className="modal-card card appointment-modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-header"><div><h2>Novo agendamento</h2><p>Os horários exibidos já respeitam agenda, pausas e bloqueios.</p></div><button className="icon-button" onClick={() => setOpen(false)}>×</button></div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label>Cliente</label><input className="input" value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} placeholder="Nome completo" required /></div>
          <div className="field"><label>WhatsApp</label><input className="input" value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} placeholder="(11) 99999-9999" required /></div>
          <div className="field"><label>Profissional</label><select className="input" value={form.professionalId} onChange={(event) => setForm({ ...form, professionalId: event.target.value, serviceId: "", start: "" })} required><option value="">Selecione</option>{professionals.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
          <div className="field"><label>Serviço</label><select className="input" value={form.serviceId} onChange={(event) => setForm({ ...form, serviceId: event.target.value, start: "" })} required><option value="">Selecione</option>{availableServices.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.duration} min</option>)}</select></div>
          <div className="field"><label>Data</label><input className="input" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value, start: "" })} required /></div>
          <div className="field"><label>Horário</label><select className="input" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} required><option value="">{selectedService ? "Selecione um horário" : "Escolha o serviço primeiro"}</option>{slots.map((slot) => <option value={slot} key={slot}>{slot}</option>)}</select></div>
          <div className="field field-wide"><label>Observações</label><textarea className="input textarea-input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Informações importantes sobre o atendimento" /></div>
        </div>
        {selectedService && selectedProfessional && <div className="notice-box">Duração: {selectedService.duration} minutos · Profissional: {selectedProfessional.name} · {slots.length} horário(s) disponível(is).</div>}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={!form.start}>Confirmar agendamento</button></div>
      </form>
    </div></div>}
  </div>;
}
