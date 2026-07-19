"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Professional = { id: string; name: string; specialty: string; active: boolean };
type Appointment = { id: string; professional_id: string; customer_name: string; customer_phone: string; service_name: string; appointment_date: string; start_time: string; end_time: string; status: "confirmed" | "completed" | "cancelled" | "no_show" };
type Business = { name: string; whatsapp_confirmation_template: string };

function localToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function baseHours() {
  return Array.from({ length: 21 }, (_, index) => {
    const total = 8 * 60 + index * 30;
    return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
  });
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function AgendaBoard({ businessId }: { businessId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(localToday());
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      const [p, a, b] = await Promise.all([
        supabase.from("professionals").select("id,name,specialty,active").eq("business_id", businessId).eq("active", true).order("name"),
        supabase.from("appointments").select("id,professional_id,customer_name,customer_phone,service_name,appointment_date,start_time,end_time,status").eq("business_id", businessId).eq("appointment_date", date).neq("status", "cancelled").order("start_time"),
        supabase.from("businesses").select("name,whatsapp_confirmation_template").eq("id", businessId).single(),
      ]);
      if (!active) return;
      if (p.error || a.error || b.error) setError((p.error || a.error || b.error)?.message ?? "Não foi possível carregar a agenda.");
      else {
        setProfessionals((p.data ?? []) as Professional[]);
        setAppointments((a.data ?? []) as Appointment[]);
        setBusiness(b.data as Business);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [businessId, date, supabase]);

  const hours = useMemo(() => {
    const appointmentStarts = appointments.map((item) => item.start_time.slice(0, 5));
    return [...new Set([...baseHours(), ...appointmentStarts])].sort();
  }, [appointments]);

  function moveDay(amount: number) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + amount);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, "0");
    const day = String(next.getDate()).padStart(2, "0");
    setDate(`${year}-${month}-${day}`);
  }

  function professionalName(appointment: Appointment) {
    return professionals.find((item) => item.id === appointment.professional_id)?.name ?? "Profissional";
  }

  function whatsappUrl(appointment: Appointment) {
    const template = business?.whatsapp_confirmation_template || "Olá, {cliente}! Seu horário para {servico} foi confirmado para o dia {data}, às {horario}, com {profissional}. Nós da {estabelecimento} aguardamos você ansiosamente!";
    const message = template
      .replaceAll("{cliente}", appointment.customer_name)
      .replaceAll("{servico}", appointment.service_name)
      .replaceAll("{data}", formatDate(appointment.appointment_date))
      .replaceAll("{horario}", appointment.start_time.slice(0, 5))
      .replaceAll("{profissional}", professionalName(appointment))
      .replaceAll("{estabelecimento}", business?.name ?? "nosso estabelecimento");
    let phone = digits(appointment.customer_phone || "");
    if (phone && phone.length <= 11) phone = `55${phone}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  return <div className="content">
    <div className="page-heading"><div><h1>Agenda</h1><p>Visualize os atendimentos de toda a equipe em um único lugar.</p></div><a className="button button-primary" href="/painel/agendamentos">+ Novo agendamento</a></div>
    {error && <div className="notice-box" style={{marginBottom:16}}>{error}</div>}
    <div className="agenda-toolbar card"><div className="agenda-date-controls"><button className="icon-button" onClick={()=>moveDay(-1)}>‹</button><input className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} /><button className="icon-button" onClick={()=>moveDay(1)}>›</button></div><strong>{new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</strong><span className="table-muted">{appointments.length} atendimento(s)</span></div>
    {loading ? <div className="card empty-state"><h3>Carregando agenda...</h3></div> : professionals.length ? <div className="card agenda-grid-wrap"><div className="agenda-grid" style={{gridTemplateColumns:`82px repeat(${professionals.length}, minmax(180px, 1fr))`}}><div className="agenda-corner">Horário</div>{professionals.map((professional)=><div className="agenda-professional" key={professional.id}><div className="profile-avatar small-avatar">{professional.name.slice(0,1).toUpperCase()}</div><div><strong>{professional.name}</strong><span>{professional.specialty}</span></div></div>)}{hours.flatMap((hour)=>[<div className="agenda-time" key={`time-${hour}`}>{hour}</div>,...professionals.map((professional)=>{const matches=appointments.filter((item)=>item.professional_id===professional.id&&item.start_time.slice(0,5)===hour);return <div className="agenda-cell" key={`${professional.id}-${hour}`}>{matches.map((appointment)=><button type="button" className={`agenda-appointment status-${appointment.status}`} style={{width:"100%",textAlign:"left",border:0,cursor:"pointer"}} key={appointment.id} onClick={()=>setSelected(appointment)}><strong>{appointment.customer_name}</strong><span>{appointment.service_name}</span><small>{appointment.start_time.slice(0,5)}–{appointment.end_time.slice(0,5)}</small></button>)}</div>;})])}</div></div> : <div className="card empty-state"><h3>Nenhum profissional ativo</h3><p>Cadastre ou reative um profissional para visualizar a agenda.</p></div>}

    {selected && <div role="presentation" onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.55)",display:"grid",placeItems:"center",padding:20}}>
      <section role="dialog" aria-modal="true" aria-labelledby="appointment-title" className="card" onClick={(event)=>event.stopPropagation()} style={{width:"min(100%,520px)",padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",marginBottom:20}}><div><span className="eyebrow">Detalhes do agendamento</span><h2 id="appointment-title" style={{margin:"8px 0 0"}}>{selected.customer_name}</h2></div><button className="icon-button" aria-label="Fechar" onClick={()=>setSelected(null)}>×</button></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12,marginBottom:20}}>
          <div className="notice-box"><small>Serviço</small><strong style={{display:"block",marginTop:4}}>{selected.service_name}</strong></div>
          <div className="notice-box"><small>Profissional</small><strong style={{display:"block",marginTop:4}}>{professionalName(selected)}</strong></div>
          <div className="notice-box"><small>Data</small><strong style={{display:"block",marginTop:4}}>{formatDate(selected.appointment_date)}</strong></div>
          <div className="notice-box"><small>Horário</small><strong style={{display:"block",marginTop:4}}>{selected.start_time.slice(0,5)}–{selected.end_time.slice(0,5)}</strong></div>
          <div className="notice-box" style={{gridColumn:"1 / -1"}}><small>WhatsApp do cliente</small><strong style={{display:"block",marginTop:4}}>{selected.customer_phone || "Não informado"}</strong></div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}><button className="button button-secondary" onClick={()=>setSelected(null)}>Fechar</button><a className="button button-primary" href={whatsappUrl(selected)} target="_blank" rel="noreferrer" aria-disabled={!selected.customer_phone} style={!selected.customer_phone ? {pointerEvents:"none",opacity:.5} : undefined}>Enviar confirmação no WhatsApp</a></div>
      </section>
    </div>}
  </div>;
}
