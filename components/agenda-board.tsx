"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Professional = { id: string; name: string; specialty: string; active: boolean };
type Appointment = { id: string; professional_id: string; customer_name: string; service_name: string; start_time: string; end_time: string; status: "confirmed" | "completed" | "cancelled" | "no_show" };

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

export function AgendaBoard({ businessId }: { businessId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(localToday());
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      const [p, a] = await Promise.all([
        supabase.from("professionals").select("id,name,specialty,active").eq("business_id", businessId).eq("active", true).order("name"),
        supabase.from("appointments").select("id,professional_id,customer_name,service_name,start_time,end_time,status").eq("business_id", businessId).eq("appointment_date", date).neq("status", "cancelled").order("start_time"),
      ]);
      if (!active) return;
      if (p.error || a.error) setError((p.error || a.error)?.message ?? "Não foi possível carregar a agenda.");
      else { setProfessionals((p.data ?? []) as Professional[]); setAppointments((a.data ?? []) as Appointment[]); }
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

  return <div className="content">
    <div className="page-heading"><div><h1>Agenda</h1><p>Visualize os atendimentos de toda a equipe em um único lugar.</p></div><a className="button button-primary" href="/painel/agendamentos">+ Novo agendamento</a></div>
    {error && <div className="notice-box" style={{marginBottom:16}}>{error}</div>}
    <div className="agenda-toolbar card"><div className="agenda-date-controls"><button className="icon-button" onClick={()=>moveDay(-1)}>‹</button><input className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} /><button className="icon-button" onClick={()=>moveDay(1)}>›</button></div><strong>{new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</strong><span className="table-muted">{appointments.length} atendimento(s)</span></div>
    {loading ? <div className="card empty-state"><h3>Carregando agenda...</h3></div> : professionals.length ? <div className="card agenda-grid-wrap"><div className="agenda-grid" style={{gridTemplateColumns:`82px repeat(${professionals.length}, minmax(180px, 1fr))`}}><div className="agenda-corner">Horário</div>{professionals.map((professional)=><div className="agenda-professional" key={professional.id}><div className="profile-avatar small-avatar">{professional.name.slice(0,1).toUpperCase()}</div><div><strong>{professional.name}</strong><span>{professional.specialty}</span></div></div>)}{hours.flatMap((hour)=>[<div className="agenda-time" key={`time-${hour}`}>{hour}</div>,...professionals.map((professional)=>{const matches=appointments.filter((item)=>item.professional_id===professional.id&&item.start_time.slice(0,5)===hour);return <div className="agenda-cell" key={`${professional.id}-${hour}`}>{matches.map((appointment)=><div className={`agenda-appointment status-${appointment.status}`} key={appointment.id}><strong>{appointment.customer_name}</strong><span>{appointment.service_name}</span><small>{appointment.start_time.slice(0,5)}–{appointment.end_time.slice(0,5)}</small></div>)}</div>;})])}</div></div> : <div className="card empty-state"><h3>Nenhum profissional ativo</h3><p>Cadastre ou reative um profissional para visualizar a agenda.</p></div>}
  </div>;
}
