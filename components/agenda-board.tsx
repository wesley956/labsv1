"use client";

import { useEffect, useMemo, useState } from "react";
import { AppointmentRecord, loadAppointments } from "@/lib/appointments-data";
import { loadProfessionals, ProfessionalRecord } from "@/lib/local-data";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AgendaBoard() {
  const [date, setDate] = useState(today());
  const [professionals, setProfessionals] = useState<ProfessionalRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);

  useEffect(() => {
    setProfessionals(loadProfessionals().filter((item) => item.active));
    setAppointments(loadAppointments());
  }, []);

  const dayAppointments = useMemo(() => appointments
    .filter((item) => item.date === date && item.status !== "cancelled")
    .sort((a, b) => a.start.localeCompare(b.start)), [appointments, date]);

  const hours = Array.from({ length: 21 }, (_, index) => {
    const total = 8 * 60 + index * 30;
    return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
  });

  function moveDay(amount: number) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + amount);
    setDate(next.toISOString().slice(0, 10));
  }

  return <div className="content">
    <div className="page-heading">
      <div><h1>Agenda</h1><p>Visualize os atendimentos de toda a equipe em um único lugar.</p></div>
      <a className="button button-primary" href="/painel/agendamentos">+ Novo agendamento</a>
    </div>

    <div className="agenda-toolbar card">
      <div className="agenda-date-controls"><button className="icon-button" onClick={() => moveDay(-1)}>‹</button><input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /><button className="icon-button" onClick={() => moveDay(1)}>›</button></div>
      <strong>{new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</strong>
      <span className="table-muted">{dayAppointments.length} atendimento(s)</span>
    </div>

    {professionals.length ? <div className="card agenda-grid-wrap">
      <div className="agenda-grid" style={{ gridTemplateColumns: `82px repeat(${professionals.length}, minmax(180px, 1fr))` }}>
        <div className="agenda-corner">Horário</div>
        {professionals.map((professional) => <div className="agenda-professional" key={professional.id}><div className="profile-avatar small-avatar">{professional.name.slice(0, 1).toUpperCase()}</div><div><strong>{professional.name}</strong><span>{professional.specialty}</span></div></div>)}
        {hours.flatMap((hour) => [
          <div className="agenda-time" key={`time-${hour}`}>{hour}</div>,
          ...professionals.map((professional) => {
            const appointment = dayAppointments.find((item) => item.professionalId === professional.id && item.start === hour);
            return <div className="agenda-cell" key={`${professional.id}-${hour}`}>
              {appointment && <div className={`agenda-appointment status-${appointment.status}`}><strong>{appointment.customerName}</strong><span>{appointment.serviceName}</span><small>{appointment.start}–{appointment.end}</small></div>}
            </div>;
          }),
        ])}
      </div>
    </div> : <div className="card empty-state"><h3>Nenhum profissional ativo</h3><p>Cadastre ou reative um profissional para visualizar a agenda.</p></div>}
  </div>;
}
