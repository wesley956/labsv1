"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AppointmentData = {
  appointment: {
    id: string;
    customer_name: string;
    service_name: string;
    professional_name: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: string;
    confirmation_state: string;
    can_cancel: boolean;
  };
  business: {
    name: string;
    slug: string;
    logo_url: string;
    primary_color: string;
    cancellation_notice_hours: number;
    booking_window_days?: number;
  };
};

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AppointmentManagement({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [reason, setReason] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const { data: result, error: rpcError } = await (supabase as any).rpc("get_public_appointment_management", { p_token: token });
    if (rpcError || !result) setError("Não foi possível localizar este agendamento.");
    else setData(result as AppointmentData);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [token]);

  async function cancelAppointment() {
    if (!data?.appointment.can_cancel || cancelling) return;
    setCancelling(true);
    setError("");
    setSuccess("");
    const { error: rpcError } = await (supabase as any).rpc("cancel_public_appointment", { p_token: token, p_reason: reason.trim() });
    if (rpcError) setError(rpcError.message || "Não foi possível cancelar o agendamento.");
    else { setSuccess("Agendamento cancelado e horário liberado."); await load(); }
    setCancelling(false);
  }

  async function loadSlots(date: string) {
    setNewDate(date);
    setNewTime("");
    setSlots([]);
    if (!date) return;
    setLoadingSlots(true);
    setError("");
    const { data: result, error: rpcError } = await (supabase as any).rpc("get_public_reschedule_slots", { p_token: token, p_date: date });
    if (rpcError) setError(rpcError.message || "Não foi possível consultar os horários.");
    else setSlots((result ?? []).map((item: { slot: string } | string) => typeof item === "string" ? item : item.slot));
    setLoadingSlots(false);
  }

  async function rescheduleAppointment() {
    if (!newDate || !newTime || rescheduling) return;
    setRescheduling(true);
    setError("");
    setSuccess("");
    const { error: rpcError } = await (supabase as any).rpc("reschedule_public_appointment", { p_token: token, p_date: newDate, p_start: newTime });
    if (rpcError) setError(rpcError.message || "Não foi possível reagendar.");
    else {
      setSuccess("Agendamento reagendado com sucesso. Os lembretes serão atualizados para o novo horário.");
      setShowReschedule(false);
      setNewDate(""); setNewTime(""); setSlots([]);
      await load();
    }
    setRescheduling(false);
  }

  if (loading) return <main className="public-booking-shell"><section className="card public-unavailable"><h1>Carregando agendamento...</h1></section></main>;
  if (!data) return <main className="public-booking-shell"><section className="card public-unavailable"><h1>Agendamento não encontrado</h1><p>{error}</p></section></main>;

  const { appointment, business } = data;
  const cancelled = appointment.status === "cancelled";
  const pending = appointment.confirmation_state === "pending";
  const canManage = !cancelled && appointment.can_cancel;

  return <main className="public-booking-shell" style={{ ["--public-accent" as string]: business.primary_color || "#7c3aed" }}>
    <section className="card public-booking-card" style={{ marginTop: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        {business.logo_url && <img src={business.logo_url} alt={`Logo de ${business.name}`} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 24, margin: "0 auto 14px" }} />}
        <span className="eyebrow">Gerenciar agendamento</span>
        <h1 style={{ margin: "8px 0" }}>{business.name}</h1>
        <p>Consulte, reagende ou cancele seu horário com segurança.</p>
      </div>

      {error && <div className="public-error">{error}</div>}
      {success && <div className="notice-box" style={{ marginBottom: 16 }}><strong>{success}</strong></div>}

      <div className="success-summary" style={{ marginBottom: 20 }}>
        <strong>{appointment.service_name}</strong>
        <span>{formatDate(appointment.appointment_date)}</span>
        <span>{appointment.start_time.slice(0, 5)} às {appointment.end_time.slice(0, 5)}</span>
        <span>com {appointment.professional_name}</span>
        <b>{cancelled ? "Status: cancelado" : pending ? "Status: aguardando confirmação" : "Status: confirmado"}</b>
      </div>

      {canManage && !showReschedule && <div style={{ display: "grid", gap: 10 }}>
        <button className="button button-primary" onClick={() => setShowReschedule(true)}>Reagendar horário</button>
        <button className="button button-secondary" onClick={() => document.getElementById("cancel-area")?.scrollIntoView({ behavior: "smooth" })}>Preciso cancelar</button>
      </div>}

      {canManage && showReschedule && <section style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
        <div className="public-heading"><h2>Escolha o novo horário</h2><p>O serviço e a profissional permanecem os mesmos.</p></div>
        <div className="field"><label>Nova data</label><input className="input" type="date" min={localDate()} max={localDate(business.booking_window_days ?? 60)} value={newDate} onChange={(event) => void loadSlots(event.target.value)} /></div>
        {loadingSlots && <div className="public-empty"><strong>Consultando horários...</strong></div>}
        {!loadingSlots && newDate && slots.length === 0 && <div className="notice-box"><strong>Nenhum horário disponível nessa data.</strong></div>}
        {!loadingSlots && slots.length > 0 && <div className="slot-grid" style={{ marginTop: 14 }}>{slots.map((slot) => <button className={newTime === slot ? "selected" : ""} key={slot} onClick={() => setNewTime(slot)}>{slot}</button>)}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}><button className="button button-secondary" disabled={rescheduling} onClick={() => setShowReschedule(false)}>Voltar</button><button className="button button-primary" disabled={!newDate || !newTime || rescheduling} onClick={() => void rescheduleAppointment()}>{rescheduling ? "Reagendando..." : "Confirmar novo horário"}</button></div>
      </section>}

      {canManage && <section id="cancel-area" style={{ marginTop: 26, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
        <div className="field"><label>Motivo do cancelamento (opcional)</label><textarea className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Conte brevemente o motivo" /></div>
        <button className="button button-secondary" style={{ width: "100%" }} disabled={cancelling} onClick={() => void cancelAppointment()}>{cancelling ? "Cancelando..." : "Cancelar definitivamente"}</button>
      </section>}

      {!cancelled && !appointment.can_cancel && <div className="notice-box"><strong>Alterações online indisponíveis</strong><p style={{ margin: "6px 0 0" }}>O prazo de {business.cancellation_notice_hours} hora(s) foi encerrado ou o estabelecimento desativou essa opção.</p></div>}
      {cancelled && <div className="notice-box"><strong>Agendamento cancelado</strong><p style={{ margin: "6px 0 0" }}>O horário foi liberado novamente na agenda.</p></div>}

      <a className="button button-primary" style={{ width: "100%", marginTop: 12, textAlign: "center" }} href={`/${business.slug}`}>Voltar para a página do estabelecimento</a>
    </section>
    <footer className="public-powered">Tecnologia de agendamento por <strong>Cruz Agenda</strong></footer>
  </main>;
}
