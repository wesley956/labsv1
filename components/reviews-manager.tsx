"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AppointmentSummary = {
  service_name: string;
  professional_name: string;
  appointment_date: string;
};

type Review = {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  approved: boolean;
  created_at: string;
  appointments: AppointmentSummary | AppointmentSummary[] | null;
};

type Filter = "all" | "pending" | "approved";

function appointmentOf(review: Review): AppointmentSummary | null {
  if (Array.isArray(review.appointments)) return review.appointments[0] ?? null;
  return review.appointments;
}

export function ReviewsManager({ businessId, initialItems }: { businessId: string; initialItems: Review[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>("all");
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");

  const approvedCount = items.filter((item) => item.approved).length;
  const pendingCount = items.length - approvedCount;
  const average = items.length ? items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length : 0;
  const filtered = items.filter((item) => filter === "all" || (filter === "approved" ? item.approved : !item.approved));

  async function toggle(item: Review) {
    if (updatingId) return;
    setError("");
    setUpdatingId(item.id);

    const { data, error: requestError } = await supabase
      .from("reviews")
      .update({ approved: !item.approved, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("business_id", businessId)
      .select("id,customer_name,rating,comment,approved,created_at,appointments(service_name,professional_name,appointment_date)")
      .single();

    setUpdatingId("");

    if (requestError) {
      setError(requestError.message);
      return;
    }

    const updated = data as unknown as Review;
    setItems((current) => current.map((row) => (row.id === item.id ? updated : row)));
  }

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <h1>Avaliações</h1>
          <p>Revise os comentários antes de permitir sua publicação.</p>
        </div>
      </div>

      {error && <div className="notice-box" style={{ marginBottom: 16 }}>{error}</div>}

      <section className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="card stat-card"><span>Total recebido</span><strong>{items.length}</strong><small className="table-muted">Avaliações enviadas</small></div>
        <div className="card stat-card"><span>Aguardando revisão</span><strong>{pendingCount}</strong><small className="table-muted">Ainda não aparecem publicamente</small></div>
        <div className="card stat-card"><span>Aprovadas</span><strong>{approvedCount}</strong><small className="table-muted">Liberadas pela equipe</small></div>
        <div className="card stat-card"><span>Nota média</span><strong>{average ? average.toFixed(1).replace(".", ",") : "—"}</strong><small className="table-muted">De 5 estrelas</small></div>
      </section>

      <section className="card panel">
        <div className="manager-toolbar" style={{ marginBottom: 16 }}>
          <select className="input" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
            <option value="all">Todas as avaliações</option>
            <option value="pending">Aguardando revisão</option>
            <option value="approved">Aprovadas</option>
          </select>
          <span className="table-muted">{filtered.length} resultado(s)</span>
        </div>

        <div className="appointment-list">
          {filtered.map((item) => {
            const appointment = appointmentOf(item);
            const updating = updatingId === item.id;
            return (
              <div className="appointment-item" key={item.id}>
                <strong>
                  {"★".repeat(item.rating)}{"☆".repeat(Math.max(0, 5 - item.rating))}
                  <br />
                  <small>{new Date(item.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small>
                </strong>
                <div>
                  <b>{item.customer_name}</b>
                  <br />
                  <small>{appointment ? `${appointment.service_name} · ${appointment.professional_name}` : "Atendimento não localizado"}</small>
                  {item.comment ? <p style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{item.comment}</p> : <p className="table-muted" style={{ margin: "8px 0 0" }}>Cliente enviou apenas a nota.</p>}
                </div>
                <button className={`button ${item.approved ? "button-secondary" : "button-primary"}`} disabled={Boolean(updatingId)} onClick={() => void toggle(item)}>
                  {updating ? "Salvando..." : item.approved ? "Ocultar" : "Aprovar"}
                </button>
              </div>
            );
          })}

          {!filtered.length && (
            <div className="empty-state">
              <strong>{items.length ? "Nenhuma avaliação neste filtro" : "Nenhuma avaliação recebida"}</strong>
              <p>{items.length ? "Altere o filtro para ver outras avaliações." : "As avaliações enviadas pelos clientes aparecerão aqui."}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
