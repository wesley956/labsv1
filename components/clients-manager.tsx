"use client";

import { useEffect, useMemo, useState } from "react";
import { loadAppointments } from "@/lib/appointments-data";
import { ClientRecord, createClient, loadClients, saveClients, syncClientsFromAppointments } from "@/lib/clients-data";

type Draft = Pick<ClientRecord, "name" | "phone" | "email" | "notes">;
const emptyDraft: Draft = { name: "", phone: "", email: "", notes: "" };

export function ClientsManager() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [open, setOpen] = useState(false);
  const [appointments, setAppointments] = useState<ReturnType<typeof loadAppointments>>([]);

  useEffect(() => {
    const loadedAppointments = loadAppointments();
    setAppointments(loadedAppointments);
    setClients(syncClientsFromAppointments(loadClients(), loadedAppointments));
  }, []);

  const filtered = useMemo(() => clients.filter((client) => `${client.name} ${client.phone} ${client.email}`.toLowerCase().includes(query.toLowerCase())), [clients, query]);
  const selected = clients.find((client) => client.id === selectedId) || null;
  const history = selected ? appointments.filter((item) => item.customerPhone.replace(/\D/g, "") === selected.phone.replace(/\D/g, "")).sort((a,b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`)) : [];

  function persist(next: ClientRecord[]) { setClients(next); saveClients(next); }
  function startCreate() { setEditingId(""); setDraft(emptyDraft); setOpen(true); }
  function startEdit(client: ClientRecord) { setEditingId(client.id); setDraft({ name: client.name, phone: client.phone, email: client.email, notes: client.notes }); setOpen(true); }
  function submit() {
    if (!draft.name.trim() || !draft.phone.trim()) return;
    if (editingId) persist(clients.map((client) => client.id === editingId ? { ...client, ...draft, updatedAt: new Date().toISOString() } : client));
    else persist([...clients, createClient({ ...draft, name: draft.name.trim(), phone: draft.phone.trim() })]);
    setOpen(false);
  }

  return <div className="content clients-page">
    <div className="page-heading"><div><h1>Clientes</h1><p>Cadastro, contatos e histórico de atendimentos.</p></div><button className="button button-primary" onClick={startCreate}>+ Adicionar cliente</button></div>
    <div className="clients-toolbar card"><input className="input" placeholder="Buscar por nome, telefone ou e-mail" value={query} onChange={(e) => setQuery(e.target.value)} /><span>{clients.length} clientes</span></div>
    <div className="clients-layout">
      <section className="card clients-list">{filtered.map((client) => {
        const count = appointments.filter((item) => item.customerPhone.replace(/\D/g, "") === client.phone.replace(/\D/g, "")).length;
        return <button className={`client-row ${selectedId === client.id ? "active" : ""}`} key={client.id} onClick={() => setSelectedId(client.id)}><span className="client-avatar">{client.name.slice(0,1).toUpperCase()}</span><span><strong>{client.name}</strong><small>{client.phone}</small></span><b>{count}</b></button>;
      })}{filtered.length === 0 && <div className="empty-state"><strong>Nenhum cliente encontrado</strong><p>Cadastre manualmente ou crie um agendamento.</p></div>}</section>
      <aside className="card client-detail">{selected ? <><div className="client-detail-head"><span className="client-avatar large">{selected.name.slice(0,1).toUpperCase()}</span><div><h2>{selected.name}</h2><p>{selected.phone}</p></div><button className="button button-secondary" onClick={() => startEdit(selected)}>Editar</button></div><div className="client-info-grid"><div><small>E-mail</small><strong>{selected.email || "Não informado"}</strong></div><div><small>Atendimentos</small><strong>{history.length}</strong></div><div className="wide"><small>Observações</small><strong>{selected.notes || "Nenhuma observação"}</strong></div></div><h3>Histórico</h3><div className="client-history">{history.map((item) => <div key={item.id}><span><strong>{item.serviceName}</strong><small>{item.professionalName}</small></span><span><strong>{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}</strong><small>{item.start} · {item.status}</small></span></div>)}{history.length === 0 && <p className="table-muted">Ainda não há atendimentos para este cliente.</p>}</div></> : <div className="empty-state"><strong>Selecione um cliente</strong><p>Os detalhes e o histórico aparecerão aqui.</p></div>}</aside>
    </div>
    {open && <div className="modal-backdrop"><div className="card modal-card"><div className="modal-head"><div><h2>{editingId ? "Editar cliente" : "Novo cliente"}</h2><p>Nome e WhatsApp são obrigatórios.</p></div><button className="icon-button" onClick={() => setOpen(false)}>×</button></div><div className="form-grid"><div className="field"><label>Nome</label><input className="input" value={draft.name} onChange={(e) => setDraft({...draft,name:e.target.value})} /></div><div className="field"><label>WhatsApp</label><input className="input" value={draft.phone} onChange={(e) => setDraft({...draft,phone:e.target.value})} /></div><div className="field field-wide"><label>E-mail</label><input className="input" type="email" value={draft.email} onChange={(e) => setDraft({...draft,email:e.target.value})} /></div><div className="field field-wide"><label>Observações</label><textarea className="input textarea" value={draft.notes} onChange={(e) => setDraft({...draft,notes:e.target.value})} /></div></div><div className="modal-actions"><button className="button button-secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={!draft.name.trim() || !draft.phone.trim()} onClick={submit}>Salvar cliente</button></div></div></div>}
  </div>;
}
