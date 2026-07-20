"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AdminActivityItem = {
  id: number;
  action: string;
  admin_user_id: string | null;
  admin_email: string;
  business_id: string | null;
  business_name: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminActivityResult = {
  total: number;
  items: AdminActivityItem[];
};

export type ActivityBusiness = { id: string; name: string };

const actionLabels: Record<string, string> = {
  subscription_updated: "Assinatura atualizada",
  business_deleted: "Estabelecimento excluído",
  admin_account_updated: "Conta administrativa atualizada",
  payment_created: "Pagamento registrado",
  payment_status_updated: "Status de pagamento atualizado",
};

function title(item: AdminActivityItem) {
  return actionLabels[item.action] ?? item.action.replaceAll("_", " ");
}

function metadataSummary(item: AdminActivityItem) {
  const metadata = item.metadata ?? {};
  if (item.action === "subscription_updated") return `${String(metadata.old_status ?? "—")} → ${String(metadata.new_status ?? "—")}`;
  if (item.action === "payment_created") return `Valor: R$ ${Number(metadata.amount ?? 0).toFixed(2).replace(".", ",")} · ${String(metadata.status ?? "")}`;
  if (item.action === "payment_status_updated") return `${String(metadata.old_status ?? "—")} → ${String(metadata.new_status ?? "—")}`;
  if (item.action === "admin_account_updated") return `${String(metadata.target_email ?? "Conta")} · ${String(metadata.new_role ?? "")}`;
  if (item.action === "business_deleted") return `${String(metadata.clients_count ?? 0)} clientes · ${String(metadata.appointments_count ?? 0)} agendamentos`;
  return "";
}

export function AdminActivityManager({ initialResult, businesses }: { initialResult: AdminActivityResult; businesses: ActivityBusiness[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialResult.items);
  const [total, setTotal] = useState(initialResult.total);
  const [businessId, setBusinessId] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(reset: boolean) {
    if (loading) return;
    setLoading(true);
    setError("");

    const offset = reset ? 0 : items.length;
    const { data, error: requestError } = await supabase.rpc("get_admin_activity", {
      p_business_id: businessId || null,
      p_action: action || null,
      p_limit: 50,
      p_offset: offset,
    });

    setLoading(false);

    if (requestError) {
      setError(requestError.message);
      return;
    }

    const result = data as AdminActivityResult;
    setItems((current) => reset ? result.items : [...current, ...result.items]);
    setTotal(result.total);
  }

  return (
    <>
      {error && <div className="notice-box admin-feedback" role="alert">{error}</div>}
      <div className="admin-toolbar" style={{ gridTemplateColumns: "minmax(0,1fr) 240px auto" }}>
        <select className="input" value={businessId} onChange={(event) => setBusinessId(event.target.value)}>
          <option value="">Todos os estabelecimentos</option>
          {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
        </select>
        <select className="input" value={action} onChange={(event) => setAction(event.target.value)}>
          <option value="">Todas as ações</option>
          {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="button button-primary" disabled={loading} onClick={() => void load(true)}>{loading ? "Carregando..." : "Aplicar filtros"}</button>
      </div>

      <div className="admin-events">
        {items.map((item) => <article className="admin-event" key={item.id}>
          <div>
            <strong>{title(item)}</strong>
            <div style={{ marginTop: 5 }}>{item.business_name}</div>
            {metadataSummary(item) && <small style={{ display: "block", marginTop: 5 }}>{metadataSummary(item)}</small>}
            <small style={{ display: "block", marginTop: 5 }}>Executado por {item.admin_email || "sistema"}</small>
          </div>
          <small>{new Date(item.created_at).toLocaleString("pt-BR")}</small>
        </article>)}
        {!items.length && <div className="empty-state"><strong>Nenhuma atividade encontrada</strong><p>Altere os filtros ou aguarde novas ações administrativas.</p></div>}
      </div>

      {items.length < total && <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}><button className="button button-secondary" disabled={loading} onClick={() => void load(false)}>{loading ? "Carregando..." : `Carregar mais (${items.length} de ${total})`}</button></div>}
    </>
  );
}
