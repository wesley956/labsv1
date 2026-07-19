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

export function AppointmentManagement({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
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
    const { error: rpcError } = await (supabase as any).rpc("cancel_public_appointment", { p_token: token, p_reason: reason.trim() });
    if (rpcError) setError(rpcError.message || "Não foi possível cancelar o agendamento.");
    else await load();
    setCancelling(false);
  }

  if (loading) return <main className="public-booking-shell"><section className="card public-unavailable"><h1>Carregando agendamento...</h1></section></main>;
  if (!data) return <main className="public-booking-shell"><section className="card public-unavailable"><h1>Agendamento não encontrado</h1><p>{error}</p></section></main>;

  const { appointment, business } = data;
  const cancelled = appointment.status === "cancelled";
  const pending = appointment.confirmation_state === "pending";

  return <main className="public-booking-shell" style={{ ["--public-accent" as string]: business.primary_color || "#7c3aed" }}>
    <section className="card public-booking-card" style={{ marginTop: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        {business.logo_url && <img src={business.logo_url} alt={`Logo de ${business.name}`} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 24, margin: "0 auto 14px" }} />}
        <span className="eyebrow">Gerenciar agendamento</span>
        <h1 style={{ margin: "8px 0" }}>{business.name}</h1>
        <p>Consulte o status e gerencie seu horário com segurança.</p>
      </div>

      {error && <div className="public-error">{error}</div>}

      <div className="success-summary" style={{ marginBottom: 20 }}>
        <strong>{appointment.service_name}</strong>
        <span>{formatDate(appointment.appointment_date)}</span>
        <span>{appointment.start_time} às {appointment.end_time}</span>
        <span>com {appointment.professional_name}</span>
        <b>{cancelled ? "Status: cancelado" : pending ? "Status: aguardando confirmação" : "Status: confirmado"}</b>
      </div>

      {!cancelled && appointment.can_cancel && <div className="field">
        <label>Motivo do cancelamento (opcional)</label>
        <textarea className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Conte brevemente o motivo" />
      </div>}

      {!cancelled && appointment.can_cancel && <button className="button button-secondary" style={{ width: "100%" }} disabled={cancelling} onClick={() => void cancelAppointment()}>{cancelling ? "Cancelando..." : "Cancelar agendamento"}</button>}

      {!cancelled && !appointment.can_cancel && <div className="notice-box"><strong>Cancelamento online indisponível</strong><p style={{ margin: "6px 0 0" }}>O prazo de {business.cancellation_notice_hours} hora(s) foi encerrado ou o estabelecimento desativou essa opção.</p></div>}

      {cancelled && <div className="notice-box"><strong>Agendamento cancelado</strong><p style={{ margin: "6px 0 0" }}>O horário foi liberado novamente na agenda.</p></div>}

      <a className="button button-primary" style={{ width: "100%", marginTop: 12, textAlign: "center" }} href={`/${business.slug}`}>Voltar para a página do estabelecimento</a>
    </section>
    <footer className="public-powered">Tecnologia de agendamento por <strong>Cruz Agenda</strong></footer>
  </main>;
}
