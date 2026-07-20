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

type DeletedBusiness = {
  success: boolean;
  business_name: string;
  deleted_counts: {
    clients: number;
    professionals: number;
    services: number;
    appointments: number;
    reviews: number;
  };
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
  const [deleteTarget, setDeleteTarget] = useState<AdminBusiness | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

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

  async function cleanupBusinessImages(businessId: string) {
    const paths: string[] = [];

    for (const folder of ["branding", "professionals"]) {
      let offset = 0;

      while (true) {
        const { data, error: listError } = await supabase.storage.from("logos").list(`${businessId}/${folder}`, {
          limit: 100,
          offset,
          sortBy: { column: "name", order: "asc" },
        });

        if (listError) return listError.message;

        const entries = data ?? [];
        paths.push(...entries.filter((entry) => Boolean(entry.id)).map((entry) => `${businessId}/${folder}/${entry.name}`));

        if (entries.length < 100) break;
        offset += 100;
      }
    }

    for (let index = 0; index < paths.length; index += 100) {
      const { error: removeError } = await supabase.storage.from("logos").remove(paths.slice(index, index + 100));
      if (removeError) return removeError.message;
    }

    return "";
  }

  function openDelete(item: AdminBusiness) {
    if (!canWrite || savingId) return;
    setDeleteTarget(item);
    setDeleteConfirmation("");
    setError("");
    setSuccess("");
  }

  async function deleteBusiness() {
    const item = deleteTarget;
    if (!item || !canWrite || savingId) return;

    if (deleteConfirmation.trim() !== item.name.trim()) {
      setError("Digite exatamente o nome do estabelecimento para confirmar a exclusão.");
      return;
    }

    setSavingId(item.id);
    setError("");
    setSuccess("");

    const { data, error: requestError } = await supabase.rpc("delete_admin_business", {
      p_business_id: item.id,
      p_confirmation: deleteConfirmation,
    });

    if (requestError) {
      setSavingId("");
      setError(requestError.message);
      return;
    }

    const deleted = data as DeletedBusiness;
    setItems((current) => current.filter((row) => row.id !== item.id));
    setDeleteTarget(null);
    setDeleteConfirmation("");

    const cleanupError = await cleanupBusinessImages(item.id);
    setSavingId("");

    const counts = deleted.deleted_counts;
    const summary = `${counts.clients} cliente(s), ${counts.professionals} profissional(is), ${counts.services} serviço(s) e ${counts.appointments} agendamento(s)`;
    setSuccess(cleanupError
      ? `${deleted.business_name} foi excluído com seus dados (${summary}). Não foi possível concluir a limpeza das imagens: ${cleanupError}`
      : `${deleted.business_name} foi excluído permanentemente com seus dados (${summary}).`);
  }

  return (
    <>
      {!canWrite && <div className="notice-box admin-feedback"><strong>Acesso somente para consulta.</strong><p style={{ margin: "6px 0 0" }}>Apenas superadministradores podem alterar assinaturas ou excluir estabelecimentos.</p></div>}
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
                        <button className="primary" disabled={Boolean(savingId)} onClick={() => void updateSubscription(item, "active", { message: `Ativar a assinatura de ${item.name}?` })}>Ativar</button>
                        <button disabled={Boolean(savingId)} onClick={() => void updateSubscription(item, "trialing", { trialDays: 15, message: `Adicionar 15 dias de teste para ${item.name}?` })}>+15 dias</button>
                        <button disabled={Boolean(savingId)} onClick={() => void updateSubscription(item, "past_due", { graceDays: 7, message: `Marcar ${item.name} com pagamento pendente e liberar 7 dias de tolerância?` })}>Pendente</button>
                        <button className="danger" disabled={Boolean(savingId)} onClick={() => void updateSubscription(item, "suspended", { message: `Suspender o acesso de ${item.name}? Os dados serão preservados.` })}>Suspender</button>
                        <button className="danger" disabled={Boolean(savingId)} onClick={() => openDelete(item)}>{saving ? "Processando..." : "Excluir"}</button>
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

      {deleteTarget && <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(6,10,24,.72)" }} onMouseDown={() => !savingId && setDeleteTarget(null)}>
        <section className="card panel" style={{ width: "min(620px,100%)", maxHeight: "calc(100vh - 40px)", overflowY: "auto" }} onMouseDown={(event) => event.stopPropagation()}>
          <div className="panel-header">
            <div><h3>Excluir estabelecimento</h3><p className="table-muted" style={{ margin: "6px 0 0" }}>Esta ação é permanente e não possui desfazer.</p></div>
            <button className="icon-button" disabled={Boolean(savingId)} onClick={() => setDeleteTarget(null)} aria-label="Fechar">×</button>
          </div>

          <div className="notice-box" style={{ marginBottom: 18 }}>
            <strong>Todos os dados de {deleteTarget.name} serão apagados.</strong>
            <p style={{ margin: "8px 0 0" }}>{deleteTarget.clients_count} cliente(s), {deleteTarget.professionals_count} profissional(is), {deleteTarget.services_count} serviço(s), {deleteTarget.appointments_count} agendamento(s), disponibilidade, bloqueios, avaliações e imagens.</p>
            <p style={{ margin: "8px 0 0" }}>A conta de login do responsável não será apagada.</p>
          </div>

          <div className="field">
            <label htmlFor="delete-business-confirmation">Digite <strong>{deleteTarget.name}</strong> para confirmar</label>
            <input
              className="input"
              id="delete-business-confirmation"
              autoFocus
              autoComplete="off"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={deleteTarget.name}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
            <button className="button button-secondary" disabled={Boolean(savingId)} onClick={() => setDeleteTarget(null)}>Cancelar</button>
            <button
              className="button"
              style={{ color: "white", background: "var(--danger)" }}
              disabled={Boolean(savingId) || deleteConfirmation.trim() !== deleteTarget.name.trim()}
              onClick={() => void deleteBusiness()}
            >
              {savingId === deleteTarget.id ? "Excluindo permanentemente..." : "Excluir permanentemente"}
            </button>
          </div>
        </section>
      </div>}
    </>
  );
}