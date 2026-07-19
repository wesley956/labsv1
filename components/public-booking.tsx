"use client";

import { useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

type Step = "service" | "professional" | "date" | "time" | "customer" | "review" | "success";
type Professional = { id: string; name: string; specialty: string; active: boolean };
type Service = { id: string; name: string; duration_minutes: number; price: number; active: boolean; professionalIds: string[] };
type Availability = { professional_id: string; weekday: number; enabled: boolean; start_time: string; end_time: string };
type Block = { professional_id: string; block_date: string; all_day: boolean; start_time: string | null; end_time: string | null };
type Appointment = { professional_id: string; appointment_date: string; start_time: string; end_time: string; status: string };

const order: Step[] = ["service", "professional", "date", "time", "customer", "review", "success"];
const labels: Record<Step, string> = { service: "Serviço", professional: "Profissional", date: "Data", time: "Horário", customer: "Seus dados", review: "Revisar", success: "Confirmado" };

function localDate(offset = 0) { const date = new Date(); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${value}T12:00:00`)); }
function minutes(value: string) { const [h,m] = value.slice(0,5).split(":").map(Number); return h * 60 + m; }
function clock(value: number) { return `${String(Math.floor(value / 60)).padStart(2,"0")}:${String(value % 60).padStart(2,"0")}`; }
function endTime(start: string, duration: number) { return clock(minutes(start) + duration); }
function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function normalizedPhone(value: string) { return value.replace(/\D/g, ""); }

export function PublicBooking({ businessId, businessName, slug }: { businessId: string; businessName: string; slug: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<Step>("service");
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true); setError("");
    const [p,s,l,a,b,ap] = await Promise.all([
      supabase.from("professionals").select("id,name,specialty,active").eq("business_id", businessId).eq("active", true).order("name"),
      supabase.from("services").select("id,name,duration_minutes,price,active").eq("business_id", businessId).eq("active", true).order("name"),
      supabase.from("service_professionals").select("service_id,professional_id").eq("business_id", businessId),
      supabase.from("weekly_availability").select("professional_id,weekday,enabled,start_time,end_time").eq("business_id", businessId),
      supabase.from("availability_blocks").select("professional_id,block_date,all_day,start_time,end_time").eq("business_id", businessId),
      supabase.from("appointments").select("professional_id,appointment_date,start_time,end_time,status").eq("business_id", businessId).gte("appointment_date", localDate()),
    ]);
    const firstError = p.error || s.error || l.error || a.error || b.error || ap.error;
    if (firstError) setError("Não foi possível carregar a agenda no momento.");
    else {
      setProfessionals((p.data ?? []) as Professional[]);
      setServices((s.data ?? []).map((item) => ({ ...item, professionalIds: (l.data ?? []).filter((link) => link.service_id === item.id).map((link) => link.professional_id) })) as Service[]);
      setAvailability((a.data ?? []) as Availability[]); setBlocks((b.data ?? []) as Block[]); setAppointments((ap.data ?? []) as Appointment[]);
    }
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, [businessId]);

  const selectedService = services.find((item) => item.id === serviceId);
  const selectedProfessional = professionals.find((item) => item.id === professionalId);
  const eligibleProfessionals = professionals.filter((item) => selectedService?.professionalIds.includes(item.id));

  const slots = useMemo(() => {
    if (!selectedService || !selectedProfessional || !date) return [];
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const periods = availability.filter((item) => item.professional_id === professionalId && item.weekday === weekday && item.enabled);
    const dayBlocks = blocks.filter((item) => item.professional_id === professionalId && item.block_date === date);
    if (dayBlocks.some((item) => item.all_day)) return [];
    const busy = appointments.filter((item) => item.professional_id === professionalId && item.appointment_date === date && item.status !== "cancelled");
    const minimum = Date.now() + 60 * 60 * 1000;
    const result: string[] = [];
    for (const period of periods) {
      for (let start = minutes(period.start_time); start + selectedService.duration_minutes <= minutes(period.end_time); start += 15) {
        const end = start + selectedService.duration_minutes;
        const value = clock(start);
        const overlapsAppointment = busy.some((item) => start < minutes(item.end_time) && end > minutes(item.start_time));
        const overlapsBlock = dayBlocks.some((item) => !item.all_day && item.start_time && item.end_time && start < minutes(item.end_time) && end > minutes(item.start_time));
        const respectsNotice = new Date(`${date}T${value}:00`).getTime() >= minimum;
        if (!overlapsAppointment && !overlapsBlock && respectsNotice) result.push(value);
      }
    }
    return [...new Set(result)].sort();
  }, [appointments, availability, blocks, date, professionalId, selectedProfessional, selectedService]);

  function go(next: Step) { setError(""); setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function confirm() {
    if (!selectedService || !selectedProfessional || !date || !time || !name.trim() || normalizedPhone(phone).length < 10) return;
    setSaving(true); setError("");
    const end = endTime(time, selectedService.duration_minutes);
    const { data: conflicts, error: conflictError } = await supabase.from("appointments").select("id").eq("business_id", businessId).eq("professional_id", professionalId).eq("appointment_date", date).neq("status", "cancelled").lt("start_time", end).gt("end_time", time).limit(1);
    if (conflictError || conflicts?.length) { setError("Esse horário acabou de ficar indisponível. Escolha outro horário."); setSaving(false); go("time"); return; }

    const normalized = normalizedPhone(phone);
    let clientId: string | null = null;
    const { data: existing } = await supabase.from("clients").select("id").eq("business_id", businessId).eq("phone_normalized", normalized).maybeSingle();
    if (existing) clientId = existing.id;
    else {
      const { data: created, error: clientError } = await supabase.from("clients").insert({ business_id: businessId, name: name.trim(), phone: phone.trim(), phone_normalized: normalized }).select("id").single();
      if (clientError) { setError("Não foi possível salvar seus dados."); setSaving(false); return; }
      clientId = created.id;
    }

    const { error: insertError } = await supabase.from("appointments").insert({
      business_id: businessId, client_id: clientId, customer_name: name.trim(), customer_phone: phone.trim(), professional_id: professionalId,
      professional_name: selectedProfessional.name, service_id: serviceId, service_name: selectedService.name, service_duration_minutes: selectedService.duration_minutes,
      service_price: selectedService.price, appointment_date: date, start_time: time, end_time: end, status: "confirmed", origin: "public", notes: "",
    });
    if (insertError) setError("Não foi possível confirmar o agendamento. Tente novamente.");
    else { await loadData(); go("success"); }
    setSaving(false);
  }

  const progress = Math.min(100, ((order.indexOf(step) + 1) / 6) * 100);

  return <main className="public-booking-shell">
    <header className="public-header"><Brand href={`/${slug}`} /><span>Agendamento online</span></header>
    <section className="public-business"><div className="public-business-avatar">{businessName.slice(0,1).toUpperCase()}</div><div><h1>{businessName}</h1><p>Escolha o melhor horário para você.</p></div></section>
    {step !== "success" && <><div className="public-progress"><div style={{width:`${progress}%`}} /></div><div className="public-step-title"><small>Etapa {order.indexOf(step)+1} de 6</small><strong>{labels[step]}</strong></div></>}
    <section className="public-booking-card card">
      {error && <div className="public-error">{error}</div>}
      {loading ? <div className="public-empty"><strong>Carregando agenda...</strong></div> : <>
        {step === "service" && <><div className="public-heading"><h2>Qual serviço você deseja?</h2><p>Escolha uma opção para continuar.</p></div><div className="choice-list">{services.map((service)=><button className={`choice-card ${serviceId===service.id?"selected":""}`} key={service.id} onClick={()=>{setServiceId(service.id);setProfessionalId("");setDate("");setTime("");}}><div><strong>{service.name}</strong><span>{service.duration_minutes} min</span></div><b>{money(service.price)}</b></button>)}</div>{!services.length&&<div className="public-empty"><strong>Nenhum serviço disponível</strong></div>}<footer><span/><button className="button button-primary" disabled={!serviceId} onClick={()=>go("professional")}>Continuar</button></footer></>}
        {step === "professional" && <><div className="public-heading"><h2>Com quem você deseja agendar?</h2></div><div className="professional-choice-grid">{eligibleProfessionals.map((professional)=><button className={`professional-choice ${professionalId===professional.id?"selected":""}`} key={professional.id} onClick={()=>{setProfessionalId(professional.id);setDate("");setTime("");}}><span>{professional.name.slice(0,1)}</span><strong>{professional.name}</strong><small>{professional.specialty}</small></button>)}</div><footer><button className="button button-secondary" onClick={()=>go("service")}>Voltar</button><button className="button button-primary" disabled={!professionalId} onClick={()=>go("date")}>Continuar</button></footer></>}
        {step === "date" && <><div className="public-heading"><h2>Escolha a data</h2><p>Agendamentos disponíveis para os próximos 60 dias.</p></div><div className="field"><label>Data do atendimento</label><input className="input" type="date" min={localDate()} max={localDate(60)} value={date} onChange={(e)=>{setDate(e.target.value);setTime("");}} /></div>{date&&<div className="date-preview">{formatDate(date)}</div>}<footer><button className="button button-secondary" onClick={()=>go("professional")}>Voltar</button><button className="button button-primary" disabled={!date} onClick={()=>go("time")}>Ver horários</button></footer></>}
        {step === "time" && <><div className="public-heading"><h2>Escolha um horário</h2><p>{date&&formatDate(date)}</p></div><div className="slot-grid">{slots.map((slot)=><button className={time===slot?"selected":""} key={slot} onClick={()=>setTime(slot)}>{slot}</button>)}</div>{!slots.length&&<div className="public-empty"><strong>Nenhum horário disponível</strong><p>Escolha outra data.</p></div>}<footer><button className="button button-secondary" onClick={()=>go("date")}>Voltar</button><button className="button button-primary" disabled={!time} onClick={()=>go("customer")}>Continuar</button></footer></>}
        {step === "customer" && <><div className="public-heading"><h2>Seus dados</h2><p>Usaremos seu WhatsApp para identificar o agendamento.</p></div><div className="field"><label>Nome</label><input className="input" value={name} onChange={(e)=>setName(e.target.value)} /></div><div className="field"><label>WhatsApp</label><input className="input" inputMode="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} /></div><footer><button className="button button-secondary" onClick={()=>go("time")}>Voltar</button><button className="button button-primary" disabled={!name.trim()||normalizedPhone(phone).length<10} onClick={()=>go("review")}>Revisar</button></footer></>}
        {step === "review" && <><div className="public-heading"><h2>Revise seu agendamento</h2></div><div className="booking-review"><div><small>Serviço</small><strong>{selectedService?.name}</strong><span>{selectedService&&money(selectedService.price)} · {selectedService?.duration_minutes} min</span></div><div><small>Profissional</small><strong>{selectedProfessional?.name}</strong></div><div><small>Data e horário</small><strong>{date&&formatDate(date)}</strong><span>{time} às {selectedService&&endTime(time,selectedService.duration_minutes)}</span></div><div><small>Cliente</small><strong>{name}</strong><span>{phone}</span></div></div><footer><button className="button button-secondary" disabled={saving} onClick={()=>go("customer")}>Voltar</button><button className="button button-primary" disabled={saving} onClick={()=>void confirm()}>{saving?"Confirmando...":"Confirmar agendamento"}</button></footer></>}
        {step === "success" && <div className="booking-success"><div className="booking-success-icon">✓</div><span className="eyebrow">Agendamento confirmado</span><h2>Está tudo certo, {name.split(" ")[0]}!</h2><p>Seu horário foi reservado com sucesso.</p><div className="success-summary"><strong>{selectedService?.name}</strong><span>{date&&formatDate(date)} às {time}</span><span>com {selectedProfessional?.name}</span></div><button className="button button-secondary" onClick={()=>{setServiceId("");setProfessionalId("");setDate("");setTime("");setName("");setPhone("");go("service");}}>Fazer outro agendamento</button></div>}
      </>}
    </section>
    <footer className="public-powered">Agendamento seguro por <strong>Cruz Agenda</strong></footer>
  </main>;
}
