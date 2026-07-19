"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "confirmed" | "completed" | "cancelled" | "no_show";
type Professional = { id: string; name: string; specialty: string; active: boolean };
type Service = { id: string; name: string; duration_minutes: number; price: number; active: boolean; professionalIds: string[] };
type Availability = { professional_id: string; weekday: number; enabled: boolean; start_time: string; end_time: string };
type Block = { professional_id: string; block_date: string; all_day: boolean; start_time: string | null; end_time: string | null };
type Appointment = {
  id: string; customer_name: string; customer_phone: string; professional_id: string; professional_name: string;
  service_id: string; service_name: string; service_duration_minutes: number; service_price: number;
  appointment_date: string; start_time: string; end_time: string; status: Status; notes: string;
};
type BookingRules = { slotStepMinutes: number; minimumNoticeHours: number; bookingWindowDays: number };
type FormState = { customerName: string; customerPhone: string; professionalId: string; serviceId: string; date: string; start: string; notes: string };

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

const emptyForm = (): FormState => ({ customerName: "", customerPhone: "", professionalId: "", serviceId: "", date: localDate(), start: "", notes: "" });
const labels: Record<Status, string> = { confirmed: "Confirmado", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu" };

function minutes(value: string) { const [h, m] = value.slice(0, 5).split(":").map(Number); return h * 60 + m; }
function clock(value: number) { return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`; }
function addMinutes(time: string, amount: number) { return clock(minutes(time) + amount); }
function normalizedPhone(value: string) { return value.replace(/\D/g, ""); }
function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }

export function AppointmentsManager({ businessId }: { businessId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [rules, setRules] = useState<BookingRules>({ slotStepMinutes: 30, minimumNoticeHours: 0, bookingWindowDays: 120 });
  const [form, setForm] = useState<FormState>(emptyForm());
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    const [p, s, links, a, b, ap, business] = await Promise.all([
      supabase.from("professionals").select("id,name,specialty,active").eq("business_id", businessId).order("name"),
      supabase.from("services").select("id,name,duration_minutes,price,active").eq("business_id", businessId).order("name"),
      supabase.from("service_professionals").select("service_id,professional_id").eq("business_id", businessId),
      supabase.from("weekly_availability").select("professional_id,weekday,enabled,start_time,end_time").eq("business_id", businessId),
      supabase.from("availability_blocks").select("professional_id,block_date,all_day,start_time,end_time").eq("business_id", businessId),
      supabase.from("appointments").select("id,customer_name,customer_phone,professional_id,professional_name,service_id,service_name,service_duration_minutes,service_price,appointment_date,start_time,end_time,status,notes").eq("business_id", businessId),
      supabase.from("businesses").select("slot_step_minutes,minimum_notice_hours,booking_window_days").eq("id", businessId).single(),
    ]);
    const firstError = p.error || s.error || links.error || a.error || b.error || ap.error || business.error;
    if (firstError) setError(firstError.message);
    else {
      setProfessionals((p.data ?? []) as Professional[]);
      setServices((s.data ?? []).map((service) => ({ ...service, professionalIds: (links.data ?? []).filter((link) => link.service_id === service.id).map((link) => link.professional_id) })) as Service[]);
      setAvailability((a.data ?? []) as Availability[]);
      setBlocks((b.data ?? []) as Block[]);
      setAppointments((ap.data ?? []) as Appointment[]);
      setRules({
        slotStepMinutes: business.data.slot_step_minutes,
        minimumNoticeHours: business.data.minimum_notice_hours,
        bookingWindowDays: business.data.booking_window_days,
      });
    }
    setLoading(false);
  }, [businessId, supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedProfessional = professionals.find((item) => item.id === form.professionalId);
  const selectedService = services.find((item) => item.id === form.serviceId);
  const availableServices = services.filter((service) => service.active && service.professionalIds.includes(form.professionalId));
  const maxDate = useMemo(() => {
    const date = new Date(`${localDate()}T12:00:00`);
    date.setDate(date.getDate() + rules.bookingWindowDays);
    return date.toISOString().slice(0, 10);
  }, [rules.bookingWindowDays]);

  const slots = useMemo(() => {
    if (!selectedProfessional || !selectedService || !form.date) return [];
    const weekday = new Date(`${form.date}T12:00:00`).getDay();
    const periods = availability.filter((item) => item.professional_id === selectedProfessional.id && item.weekday === weekday && item.enabled);
    const dayBlocks = blocks.filter((item) => item.professional_id === selectedProfessional.id && item.block_date === form.date);
    if (dayBlocks.some((item) => item.all_day)) return [];
    const busy = appointments.filter((item) => item.professional_id === selectedProfessional.id && item.appointment_date === form.date && item.status !== "cancelled");
    const earliest = Date.now() + rules.minimumNoticeHours * 60 * 60 * 1000;
    const result: string[] = [];
    for (const period of periods) {
      for (let start = minutes(period.start_time); start + selectedService.duration_minutes <= minutes(period.end_time); start += rules.slotStepMinutes) {
        const end = start + selectedService.duration_minutes;
        const slotDate = new Date(`${form.date}T${clock(start)}:00`).getTime();
        const overlapsAppointment = busy.some((item) => start < minutes(item.end_time) && end > minutes(item.start_time));
        const overlapsBlock = dayBlocks.some((item) => !item.all_day && item.start_time && item.end_time && start < minutes(item.end_time) && end > minutes(item.start_time));
        if (slotDate >= earliest && !overlapsAppointment && !overlapsBlock) result.push(clock(start));
      }
    }
    return [...new Set(result)].sort();
  }, [appointments, availability, blocks, form.date, rules.minimumNoticeHours, rules.slotStepMinutes, selectedProfessional, selectedService]);

  const filtered = appointments
    .filter((item) => statusFilter === "all" || item.status === statusFilter)
    .filter((item) => `${item.customer_name} ${item.customer_phone} ${item.service_name} ${item.professional_name}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => `${b.appointment_date}${b.start_time}`.localeCompare(`${a.appointment_date}${a.start_time}`));

  function openCreate() {
    const first = professionals.find((item) => item.active);
    setForm({ ...emptyForm(), professionalId: first?.id ?? "" }); setError(""); setOpen(true);
  }

  async function findOrCreateClient(name: string, rawPhone: string) {
    const phone = normalizedPhone(rawPhone);
    if (phone.length < 10) throw new Error("Informe um WhatsApp válido com DDD.");

    const { data: existing, error: findError } = await supabase.from("clients").select("id").eq("business_id", businessId).eq("phone_normalized", phone).maybeSingle();
    if (findError) throw findError;
    if (existing) {
      const { error: syncError } = await supabase.from("clients").update({ name, phone: rawPhone.trim() }).eq("id", existing.id).eq("business_id", businessId);
      if (syncError) throw syncError;
      return existing.id as string;
    }

    const { data: created, error: createError } = await supabase.from("clients").insert({ business_id: businessId, name, phone: rawPhone.trim(), phone_normalized: phone }).select("id").single();
    if (!createError && created) return created.id as string;
    if (createError?.code !== "23505") throw createError;

    const { data: raced, error: racedError } = await supabase.from("clients").select("id").eq("business_id", businessId).eq("phone_normalized", phone).single();
    if (racedError) throw racedError;
    return raced.id as string;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedProfessional || !selectedService || !form.start || !form.customerName.trim() || !form.customerPhone.trim()) return;
    setSaving(true); setError("");

    try {
      const end = addMinutes(form.start, selectedService.duration_minutes);
      const { data: conflicts, error: conflictError } = await supabase.from("appointments").select("id").eq("business_id", businessId).eq("professional_id", selectedProfessional.id).eq("appointment_date", form.date).neq("status", "cancelled").lt("start_time", end).gt("end_time", form.start).limit(1);
      if (conflictError) throw conflictError;
      if (conflicts?.length) throw new Error("Esse horário acabou de ser ocupado. Escolha outro horário.");

      const clientId = await findOrCreateClient(form.customerName.trim(), form.customerPhone);
      const { error: insertError } = await supabase.from("appointments").insert({
        business_id: businessId, client_id: clientId, customer_name: form.customerName.trim(), customer_phone: form.customerPhone.trim(),
        professional_id: selectedProfessional.id, professional_name: selectedProfessional.name, service_id: selectedService.id, service_name: selectedService.name,
        service_duration_minutes: selectedService.duration_minutes, service_price: selectedService.price, appointment_date: form.date,
        start_time: form.start, end_time: end, status: "confirmed", origin: "manual", notes: form.notes.trim(),
      });
      if (insertError) throw insertError;

      setOpen(false);
      setForm(emptyForm());
      await loadData();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível criar o agendamento.";
      setError(message.includes("appointments_no_overlap") ? "Esse horário acabou de ser ocupado. Escolha outro horário." : message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: Status) {
    const previous = appointments;
    setAppointments((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    const { error: updateError } = await supabase.from("appointments").update({ status }).eq("id", id).eq("business_id", businessId);
    if (updateError) { setAppointments(previous); setError(updateError.message); }
  }

  return <div className="content">
    <div className="page-heading"><div><h1>Agendamentos</h1><p>Crie, acompanhe e atualize os atendimentos do estabelecimento.</p></div><button className="button button-primary" onClick={openCreate}>+ Novo agendamento</button></div>
    {error && <div className="notice-box" style={{marginBottom:16}}>{error}</div>}
    <div className="manager-toolbar card"><input className="input" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar cliente, serviço ou profissional" /><select className="input" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value as "all"|Status)}><option value="all">Todos os status</option>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></div>
    <div className="card panel table-wrap">{loading ? <div className="empty-state"><h3>Carregando agendamentos...</h3></div> : filtered.length ? <table className="table"><thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filtered.map((item)=><tr key={item.id}><td><strong>{new Date(`${item.appointment_date}T12:00:00`).toLocaleDateString("pt-BR")}</strong><div className="table-muted">{item.start_time.slice(0,5)}–{item.end_time.slice(0,5)}</div></td><td><strong>{item.customer_name}</strong><div className="table-muted">{item.customer_phone}</div></td><td>{item.service_name}<div className="table-muted">{money(item.service_price)} · {item.service_duration_minutes} min</div></td><td>{item.professional_name}</td><td><span className={`badge ${item.status === "completed" ? "badge-success" : "badge-purple"}`}>{labels[item.status]}</span></td><td><select className="input compact-input" value={item.status} onChange={(e)=>void updateStatus(item.id,e.target.value as Status)}>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></td></tr>)}</tbody></table> : <div className="empty-state"><h3>Nenhum agendamento encontrado</h3><p>Crie o primeiro atendimento manual ou altere os filtros.</p></div>}</div>
    {open && <div className="modal-backdrop" onMouseDown={()=>!saving&&setOpen(false)}><div className="modal-card card appointment-modal" onMouseDown={(e)=>e.stopPropagation()}><div className="modal-header"><div><h2>Novo agendamento</h2><p>Os horários respeitam agenda, pausas, bloqueios e outros atendimentos.</p></div><button className="icon-button" disabled={saving} onClick={()=>setOpen(false)}>×</button></div><form onSubmit={submit}><div className="form-grid"><div className="field"><label>Cliente</label><input className="input" value={form.customerName} onChange={(e)=>setForm({...form,customerName:e.target.value})} required /></div><div className="field"><label>WhatsApp</label><input className="input" value={form.customerPhone} onChange={(e)=>setForm({...form,customerPhone:e.target.value})} required /></div><div className="field"><label>Profissional</label><select className="input" value={form.professionalId} onChange={(e)=>setForm({...form,professionalId:e.target.value,serviceId:"",start:""})} required><option value="">Selecione</option>{professionals.filter((item)=>item.active).map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="field"><label>Serviço</label><select className="input" value={form.serviceId} onChange={(e)=>setForm({...form,serviceId:e.target.value,start:""})} required><option value="">Selecione</option>{availableServices.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.duration_minutes} min</option>)}</select></div><div className="field"><label>Data</label><input className="input" type="date" min={localDate()} max={maxDate} value={form.date} onChange={(e)=>setForm({...form,date:e.target.value,start:""})} required /></div><div className="field"><label>Horário</label><select className="input" value={form.start} onChange={(e)=>setForm({...form,start:e.target.value})} required><option value="">{selectedService ? "Selecione um horário" : "Escolha o serviço primeiro"}</option>{slots.map((slot)=><option value={slot} key={slot}>{slot}</option>)}</select></div><div className="field field-wide"><label>Observações</label><textarea className="input textarea-input" value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} /></div></div>{selectedService&&selectedProfessional&&<div className="notice-box">Duração: {selectedService.duration_minutes} minutos · Profissional: {selectedProfessional.name} · {slots.length} horário(s) disponível(is).</div>}<div className="modal-actions"><button type="button" className="button button-secondary" disabled={saving} onClick={()=>setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={!form.start||saving}>{saving?"Salvando...":"Confirmar agendamento"}</button></div></form></div></div>}
  </div>;
}
