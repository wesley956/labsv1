"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AdminAccount = {
  user_id: string;
  email: string;
  role: "super_admin" | "support";
  active: boolean;
  created_by_email: string;
  created_at: string;
  updated_at: string;
  is_current_user: boolean;
};

const roleLabels = {
  super_admin: "Superadministrador",
  support: "Suporte",
} as const;

function dateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export function AdminAccountsManager({ initialItems, canWrite }: { initialItems: AdminAccount[]; canWrite: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminAccount["role"]>("support");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function saveAccount(targetEmail: string, nextRole: AdminAccount["role"], active: boolean) {
    if (!canWrite || saving) return;

    const action = active ? `${roleLabels[nextRole]} ativo` : "acesso desativado";
    if (!window.confirm(`Confirmar ${action} para ${targetEmail}?`)) return;

    setSaving(targetEmail.toLowerCase());
    setError("");
    setSuccess("");

    const { data, error: requestError } = await supabase.rpc("upsert_platform_admin_by_email", {
      p_email: targetEmail,
      p_role: nextRole,
      p_active: active,
    });

    setSaving("");

    if (requestError) {
      setError(requestError.message);
      return;
    }

    const updated = data as AdminAccount;
    setItems((current) => {
      const exists = current.some((item) => item.user_id === updated.user_id);
      const next = exists
        ? current.map((item) => item.user_id === updated.user_id ? { ...item, ...updated } : item)
        : [...current, { ...updated, created_by_email: "", created_at: updated.created_at ?? new Date().toISOString() }];
      return [...next].sort((a, b) => Number(b.active) - Number(a.active) || a.email.localeCompare(b.email));
    });
    setEmail("");
    setRole("support");
    setSuccess(`${updated.email}: acesso administrativo atualizado.`);
  }

  return (
    <>
      {!canWrite && <div className="notice-box admin-feedback"><strong>Acesso somente para consulta.</strong><p style={{ margin: "6px 0 0" }}>Somente superadministradores podem adicionar ou alterar contas administrativas.</p></div>}
      {error && <div className="notice-box admin-feedback" role="alert">{error}</div>}
      {success && <div className="notice-box admin-feedback">{success}</div>}

      {canWrite && <div className="card panel" style={{ marginBottom: 18 }}>
        <div className="admin-section-header">
          <div><h3>Conceder acesso administrativo</h3><p>A conta precisa já existir no cadastro do Cruz Agenda.</p></div>
        </div>
        <div className="admin-toolbar" style={{ gridTemplateColumns: "minmax(0,1fr) 220px auto" }}>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" />
          <select className="input" value={role} onChange={(event) => setRole(event.target.value as AdminAccount["role"])}>
            <option value="support">Suporte · somente consulta</option>
            <option value="super_admin">Superadministrador · controle total</option>
          </select>
          <button className="button button-primary" disabled={Boolean(saving) || !email.trim()} onClick={() => void saveAccount(email.trim(), role, true)}>{saving === email.trim().toLowerCase() ? "Salvando..." : "Adicionar acesso"}</button>
        </div>
      </div>}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Conta</th><th>Permissão</th><th>Status</th><th>Atualização</th><th>Ações</th></tr></thead>
          <tbody>
            {items.map((item) => {
              const busy = saving === item.email.toLowerCase();
              return <tr key={item.user_id}>
                <td><div className="admin-business-name"><strong>{item.email}</strong><small>{item.is_current_user ? "Sua conta" : item.created_by_email ? `Adicionado por ${item.created_by_email}` : "Conta administrativa"}</small></div></td>
                <td><span className={`badge ${item.role === "super_admin" ? "badge-success" : "badge-purple"}`}>{roleLabels[item.role]}</span></td>
                <td><span className={`badge ${item.active ? "badge-success" : "badge-purple"}`}>{item.active ? "Ativo" : "Desativado"}</span></td>
                <td><div className="table-muted">{dateTime(item.updated_at)}</div></td>
                <td><div className="admin-actions">
                  {canWrite && !item.is_current_user && <>
                    <button disabled={Boolean(saving)} onClick={() => void saveAccount(item.email, "support", true)}>Suporte</button>
                    <button className="primary" disabled={Boolean(saving)} onClick={() => void saveAccount(item.email, "super_admin", true)}>Super ADM</button>
                    <button className="danger" disabled={Boolean(saving)} onClick={() => void saveAccount(item.email, item.role, !item.active)}>{busy ? "Salvando..." : item.active ? "Desativar" : "Reativar"}</button>
                  </>}
                  {item.is_current_user && <span className="table-muted">Protegida</span>}
                </div></td>
              </tr>;
            })}
            {!items.length && <tr><td colSpan={5}><div className="empty-state"><strong>Nenhuma conta administrativa</strong></div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
