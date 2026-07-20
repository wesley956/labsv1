"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AdminPayment = {
  id: string;
  business_id: string;
  business_name: string;
  owner_email: string;
  provider: "manual" | "mercado_pago";
  provider_payment_id: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled" | "refunded" | "overdue";
  amount: number | string;
  due_at: string | null;
  paid_at: string | null;
  description: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
};

export type PaymentBusiness = {
  id: string;
  name: string;
  owner_email: string;
  monthly_price: number | string;
  subscription_status: string;
};

const statusLabels: Record<AdminPayment["status"], string> = {
  pending: "Pendente",
  approved: "Pago",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  overdue: "Vencido",
};

function money(value: number | string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function localDueIso(value: string) {
  return value ? new Date(`${value}T12:00:00-03:00`).toISOString() : null;
}

export function AdminPaymentsManager({
  initialItems,
  businesses,
  canWrite,
  initialBusinessId = "",
}: {
  initialItems: AdminPayment[];
  businesses: PaymentBusiness[];
  canWrite: boolean;
  initialBusinessId?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [businessId, setBusinessId] = useState(initialBusinessId || businesses[0]?.id || "");
  const selectedBusiness = businesses.find((item) => item.id === businessId);
  const [amount, setAmount] = useState(selectedBusiness ? String(selectedBusiness.monthly_price) : "29.90");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("Mensalidade Cruz Agenda");
  const [initialStatus, setInitialStatus] = useState<AdminPayment["status"]>("pending");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filtered = useMemo(() => items.filter((item) => {
    const matchQuery = `${item.business_name} ${item.owner_email} ${item.description}`.toLowerCase().includes(query.toLowerCase());
    return matchQuery && (filterStatus === "all" || item.status === filterStatus);
  }), [items, query, filterStatus]);

  function selectBusiness(id: string) {
    setBusinessId(id);
    const business = businesses.find((item) => item.id === id);
    if (business) setAmount(String(business.monthly_price));
  }

  async function createPayment() {
    if (!canWrite || saving || !businessId || Number(amount) <= 0) return;

    setSaving("new");
    setError("");
    setSuccess("");

    const { data, error: requestError } = await supabase.rpc("create_admin_payment", {
      p_business_id: businessId,
      p_amount: Number(amount),
      p_due_at: localDueIso(dueDate),
      p_description: description.trim(),
      p_status: initialStatus,
      p_provider: "manual",
      p_provider_payment_id: null,
    });

    setSaving("");

    if (requestError) {
      setError(requestError.message);
      return;
    }

    const created = data as AdminPayment;
    const business = businesses.find((item) => item.id === created.business_id);
    setItems((current) => [{
      ...created,
      owner_email: business?.owner_email ?? "",
      created_by_email: "",
    }, ...current]);
    setOpen(false);
    setDueDate("");
    setInitialStatus("pending");
    setSuccess(`${created.business_name}: pagamento registrado com sucesso.`);
  }

  async function updateStatus(item: AdminPayment, nextStatus: AdminPayment["status"]) {
    if (!canWrite || saving) return;
    if (!window.confirm(`Alterar o pagamento de ${item.business_name} para ${statusLabels[nextStatus]}?`)) return;

    setSaving(item.id);
    setError("");
    setSuccess("");

    const { data, error: requestError } = await supabase.rpc("update_admin_payment_status", {
      p_payment_id: item.id,
      p_status: nextStatus,
      p_paid_at: nextStatus === "approved" ? new Date().toISOString() : null,
    });

    setSaving("");

    if (requestError) {
      setError(requestError.message);
      return;
    }

    const updated = data as AdminPayment;
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, ...updated } : row));
    setSuccess(`${item.business_name}: pagamento alterado para ${statusLabels[nextStatus]}.`);
  }

  return (
    <>
      {!canWrite && <div className="notice-box admin-feedback"><strong>Acesso somente para consulta.</strong><p style={{ margin: "6px 0 0" }}>Somente superadministradores podem registrar ou alterar pagamentos.</p></div>}
      {error && <div className="notice-box admin-feedback" role="alert">{error}</div>}
      {success && <div className="notice-box admin-feedback">{success}</div>}

      <div className="admin-section-header">
        <div><h3>{items.length} pagamento{items.length === 1 ? "" : "s"}</h3><p>Registros manuais agora; Mercado Pago poderá preencher a mesma estrutura depois.</p></div>
        {canWrite && <button className="button button-primary" onClick={() => setOpen(true)}>+ Registrar pagamento</button>}
      </div>

      <div className="admin-toolbar">
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar estabelecimento, responsável ou descrição" />
        <select className="input" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
          <option value="all">Todos os status</option>
          {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Estabelecimento</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Origem</th><th>Ações</th></tr></thead>
          <tbody>
            {filtered.map((item) => <tr key={item.id}>
              <td><div className="admin-business-name"><strong>{item.business_name}</strong><small>{item.owner_email || "Sem e-mail"}</small><small>{item.description || "Sem descrição"}</small></div></td>
              <td><strong>{money(item.amount)}</strong></td>
              <td><div>{date(item.due_at)}</div>{item.paid_at && <small className="table-muted">Pago em {date(item.paid_at)}</small>}</td>
              <td><span className={`badge ${item.status === "approved" ? "badge-success" : "badge-purple"}`}>{statusLabels[item.status]}</span></td>
              <td><div className="table-muted">{item.provider === "manual" ? "Manual" : "Mercado Pago"}</div>{item.provider_payment_id && <small className="table-muted">#{item.provider_payment_id}</small>}</td>
              <td><div className="admin-actions">
                <a className="button button-secondary" href={`/admin/estabelecimentos/${item.business_id}`}>Detalhes</a>
                {canWrite && <>
                  <button className="primary" disabled={Boolean(saving) || item.status === "approved"} onClick={() => void updateStatus(item, "approved")}>{saving === item.id ? "Salvando..." : "Marcar pago"}</button>
                  <button disabled={Boolean(saving) || item.status === "overdue"} onClick={() => void updateStatus(item, "overdue")}>Vencido</button>
                  <button className="danger" disabled={Boolean(saving) || item.status === "cancelled"} onClick={() => void updateStatus(item, "cancelled")}>Cancelar</button>
                </>}
              </div></td>
            </tr>)}
            {!filtered.length && <tr><td colSpan={6}><div className="empty-state"><strong>Nenhum pagamento encontrado</strong><p>Registre a primeira cobrança ou altere os filtros.</p></div></td></tr>}
          </tbody>
        </table>
      </div>

      {open && <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(6,10,24,.72)" }} onMouseDown={() => !saving && setOpen(false)}>
        <section className="card panel" style={{ width: "min(620px,100%)" }} onMouseDown={(event) => event.stopPropagation()}>
          <div className="panel-header"><div><h3>Registrar pagamento</h3><p className="table-muted" style={{ margin: "6px 0 0" }}>Este registro é manual e ficará no histórico administrativo.</p></div><button className="icon-button" disabled={Boolean(saving)} onClick={() => setOpen(false)}>×</button></div>
          <div className="field"><label>Estabelecimento</label><select className="input" value={businessId} onChange={(event) => selectBusiness(event.target.value)}>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name} · {business.owner_email || "sem e-mail"}</option>)}</select></div>
          <div className="settings-grid">
            <div className="field"><label>Valor</label><input className="input" inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
            <div className="field"><label>Vencimento</label><input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
            <div className="field"><label>Status inicial</label><select className="input" value={initialStatus} onChange={(event) => setInitialStatus(event.target.value as AdminPayment["status"])}><option value="pending">Pendente</option><option value="approved">Pago</option><option value="overdue">Vencido</option></select></div>
            <div className="field field-wide"><label>Descrição</label><input className="input" maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}><button className="button button-secondary" disabled={Boolean(saving)} onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={Boolean(saving) || !businessId || Number(amount) <= 0} onClick={() => void createPayment()}>{saving === "new" ? "Registrando..." : "Registrar pagamento"}</button></div>
        </section>
      </div>}
    </>
  );
}
