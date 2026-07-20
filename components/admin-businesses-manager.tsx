"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AdminBusiness = {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  plan_name: string;
  monthly_price: number | string;
  subscription_status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_grace_ends_at: string | null;
  created_at: string;
  professionals_count: number;
  services_count: number;
  clients_count: number;
  appointments_count: number;
  future_appointments_count: number;
  last_appointment_at: string | null;
};

type UpdatedSubscription = {
  id: string;
  subscription_status: string;
  trial_ends_at: string | null;
  subscription_grace_ends_at: string | null;
};

const statusLabels: Record<string, string> = {
  trialing: "Em teste",
  active: "Ativo",
  past_due: "Pagamento pendente",
  suspended: "Suspenso",
  cancelled: "Cancelado",
};

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function money(value: number | string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export function AdminBusinessesManager({ initialItems, canWrite }: { initialItems: AdminBusiness[]; canWrite: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = `${item.name} ${item.slug} ${item.owner_email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "all" || item.subscription_status === status);
  }), [items, query, status]);

  async function updateSubscription(
    item: AdminBusiness,
    nextStatus: string,
    options: { trialDays?: number; graceDays?: number; message: string },
  ) {
    if (!canWrite || savingId) return;
    if (!window.confirm(options.message)) return;

    setSavingId(item.id);
    setError("");
    setSuccess("");

    const { data, error: requestError } = await supabase.rpc("update_admin_business_subscription", {
      p_business_id: item.id,
      p_status: nextStatus,
      p_trial_extension_days: options.trialDays ?? null,
      p_grace_days: options.graceDays ?? null,
    });

    setSavingId("");

    if (requestError) {
      setError(requestError.message);
      return;
    }

    const updated = data as UpdatedSubscription;
    setItems((current) => current.map((row) => row.id === item.id ? {
      ...row,
      subscription_status: updated.subscription_status,
      trial_ends_at: updated.trial_ends_at,
      subscription_grace_ends_at: updated.subscription_grace_ends_at,
    } : row));
    setSuccess(`${item.name}: assinatura atualizada com sucesso.`);
  }

  return (
    <>
      {!canWrite && <div className="notice-box admin-feedback"><strong>Acesso somente para consulta.</strong><p style={{ margin: "6px 0 0" }}>Apenas superadministradores podem alterar assinaturas.</p></div>}
      {error && <div className="notice-box admin-feedback" role="alert">{error}</div>}
      {success && <div className="notice-box admin-feedback">{success}</div>}

      <div className="admin-toolbar">
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar estabelecimento, slug ou responsável" />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Todos os status</option>
          {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Estabelecimento</th><th>Assinatura</th><th>Uso</th><th>Agenda</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const saving = savingId === item.id;
              return (
                <tr key={item.id}>
                  <td>
                    <div className="admin-business-name">
                      <strong>{item.name}</strong>
                      <small>{item.owner_email || "Sem e-mail"}</small>
                      <small>/{item.slug} · cadastro em {date(item.created_at)}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${item.subscription_status === "active" ? "badge-success" : "badge-purple"}`}>{statusLabels[item.subscription_status] ?? item.subscription_status}</span>
                    <div className="table-muted" style={{ marginTop: 7 }}>{item.plan_name} · {money(item.monthly_price)}</div>
                    <div className="table-muted">Teste até {date(item.trial_ends_at)}</div>
                    {item.subscription_grace_ends_at && <div className="table-muted">Tolerância até {date(item.subscription_grace_ends_at)}</div>}
                  </td>
                  <td>
                    <strong>{item.clients_count} clientes</strong>
                    <div className="table-muted">{item.professionals_count} profissionais · {item.services_count} serviços</div>
                  </td>
                  <td>
                    <strong>{item.appointments_count} agendamentos</strong>
                    <div className="table-muted">{item.future_appointments_count} futuros</div>
                    <div className="table-muted">Último: {date(item.last_appointment_at)}</div>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <a className="button button-secondary" href={`/${item.slug}`} target="_blank" rel="noreferrer">Abrir</a>
                      {canWrite && <>
                        <button className="primary" disabled={saving} onClick={() => void updateSubscription(item, "active", { message: `Ativar a assinatura de ${item.name}?` })}>Ativar</button>
                        <button disabled={saving} onClick={() => void updateSubscription(item, "trialing", { trialDays: 15, message: `Adicionar 15 dias de teste para ${item.name}?` })}>+15 dias</button>
                        <button disabled={saving} onClick={() => void updateSubscription(item, "past_due", { graceDays: 7, message: `Marcar ${item.name} com pagamento pendente e liberar 7 dias de tolerância?` })}>Pendente</button>
                        <button className="danger" disabled={saving} onClick={() => void updateSubscription(item, "suspended", { message: `Suspender o acesso de ${item.name}? Os dados serão preservados.` })}>Suspender</button>
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={5}><div className="empty-state"><strong>Nenhum estabelecimento encontrado</strong><p>Altere a busca ou o filtro de assinatura.</p></div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
