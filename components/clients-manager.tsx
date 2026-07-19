"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ClientRecord = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AppointmentRecord = {
  id: string;
  client_id: string | null;
  appointment_date: string;
  start_time: string;
  status: string;
  service_name: string;
  professional_name: string;
};

type Draft = { name: string; phone: string; email: string; notes: string };
const emptyDraft: Draft = { name: "", phone: "", email: "", notes: "" };

function digits(value: string) {
  return value.replace(/\D/g, "");
}

const statusLabels: Record<string, string> = {
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export function ClientsManager({ businessId, initialClients, initialAppointments }: { businessId: string; initialClients: ClientRecord[]; initialAppointments: AppointmentRecord[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [clients, setClients] = useState(initialClients);
  const [appointments] = useState(initialAppointments);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialClients[0]?.id ?? "");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => clients.filter((client) => `${client.name} ${client.phone} ${client.email ?? ""}`.toLowerCase().includes(query.toLowerCase())), [clients, query]);
  const selected = clients.find((client) => client.id === selectedId) ?? null;
  const history = selected ? appointments.filter((item) => item.client_id === selected.id) : [];

  function startCreate() {
    setEditingId("");
    setDraft(emptyDraft);
    setError("");
    setOpen(true);
  }

  function startEdit(client: ClientRecord) {
    setEditingId(client.id);
    setDraft({ name: client.name, phone: client.phone, email: client.email ?? "", notes: client.notes ?? "" });
    setError("");
    setOpen(true);
  }

  async function submit() {
    if (!draft.name.trim() || !draft.phone.trim() || saving) return;
    const normalizedPhone = digits(draft.phone);
    if (normalizedPhone.length < 10) {
      setError("Informe um WhatsApp válido com DDD.");
      return;
    }

    setSaving(true);
    setError("");

    const values = {
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      phone_normalized: normalizedPhone,
      email: draft.email.trim(),
      notes: draft.notes.trim(),
    };

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from("clients")
        .update(values)
        .eq("id", editingId)
        .eq("business_id", businessId)
        .select("id, name, phone, email, notes, created_at, updated_at")
        .single();

      if (updateError) {
        setError(updateError.code === "23505" ? "Já existe um cliente com esse WhatsApp." : updateError.message);
        setSaving(false);
        return;
      }

      setClients((current) => current.map((client) => client.id === editingId ? data : client));
    } else {
      const { data, error: insertError } = await supabase
        .from("clients")
        .insert({ business_id: businessId, ...values })
        .select("id, name, phone, email, notes, created_at, updated_at")
        .single();

      if (insertError) {
        setError(insertError.code === "23505" ? "Já existe um cliente com esse WhatsApp." : insertError.message);
        setSaving(false);
        return;
      }

      setClients((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(data.id);
    }

    setSaving(false);
    setOpen(false);
    setEditingId("");
    setDraft(emptyDraft);
  }

  return <div className="content clients-page">
    <div className="page-heading"><div><h1>Clientes</h1><p>Cadastro, contatos e histórico de atendimentos.</p></div><button className="button button-primary" onClick={startCreate}>+ Adicionar cliente</button></div>
    <div className="clients-toolbar card"><input className="input" placeholder="Buscar por nome, telefone ou e-mail" value={query} onChange={(event) => setQuery(event.target.value)} /><span>{clients.length} clientes</span></div>
    <div className="clients-layout">
      <section className="card clients-list">{filtered.map((client) => {
        const count = appointments.filter((item) => item.client_id === client.id).length;
        return <button className={`client-row ${selectedId === client.id ? "active" : ""}`} key={client.id} onClick={() => setSelectedId(client.id)}><span className="client-avatar">{client.name.slice(0, 1).toUpperCase()}</span><span><strong>{client.name}</strong><small>{client.phone}</small></span><b>{count}</b></button>;
      })}{filtered.length === 0 && <div className="empty-state"><strong>Nenhum cliente encontrado</strong><p>Cadastre manualmente ou crie um agendamento.</p></div>}</section>
      <aside className="card client-detail">{selected ? <><div className="client-detail-head"><span className="client-avatar large">{selected.name.slice(0, 1).toUpperCase()}</span><div><h2>{selected.name}</h2><p>{selected.phone}</p></div><button className="button button-secondary" onClick={() => startEdit(selected)}>Editar</button></div><div className="client-info-grid"><div><small>E-mail</small><strong>{selected.email || "Não informado"}</strong></div><div><small>Atendimentos</small><strong>{history.length}</strong></div><div className="wide"><small>Observações</small><strong>{selected.notes || "Nenhuma observação"}</strong></div></div><h3>Histórico</h3><div className="client-history">{history.map((item) => <div key={item.id}><span><strong>{item.service_name}</strong><small>{item.professional_name}</small></span><span><strong>{new Date(`${item.appointment_date}T12:00:00`).toLocaleDateString("pt-BR")}</strong><small>{item.start_time.slice(0, 5)} · {statusLabels[item.status] ?? item.status}</small></span></div>)}{history.length === 0 && <p className="table-muted">Ainda não há atendimentos para este cliente.</p>}</div></> : <div className="empty-state"><strong>Selecione um cliente</strong><p>Os detalhes e o histórico aparecerão aqui.</p></div>}</aside>
    </div>
    {open && <div className="modal-backdrop" onMouseDown={() => !saving && setOpen(false)}><div className="card modal-card" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><h2>{editingId ? "Editar cliente" : "Novo cliente"}</h2><p>Nome e WhatsApp são obrigatórios.</p></div><button className="icon-button" disabled={saving} onClick={() => setOpen(false)}>×</button></div>{error && <div className="notice-box" style={{ marginBottom: 16 }}>{error}</div>}<div className="form-grid"><div className="field"><label>Nome</label><input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div><div className="field"><label>WhatsApp</label><input className="input" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></div><div className="field field-wide"><label>E-mail</label><input className="input" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></div><div className="field field-wide"><label>Observações</label><textarea className="input textarea" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></div></div><div className="modal-actions"><button className="button button-secondary" disabled={saving} onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={!draft.name.trim() || !draft.phone.trim() || saving} onClick={submit}>{saving ? "Salvando..." : "Salvar cliente"}</button></div></div></div>}
  </div>;
}
