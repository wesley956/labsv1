"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Professional = { id: string; name: string; specialty: string; phone: string; active: boolean };
const emptyForm = { name: "", specialty: "", phone: "" };

export function ProfessionalsManager({ businessId, initialItems }: { businessId: string; initialItems: Professional[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Professional[]>(initialItems);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.specialty}`.toLowerCase().includes(query.toLowerCase())), [items, query]);

  function startCreate() { setEditingId(null); setForm(emptyForm); setOpen(true); setError(""); }
  function startEdit(item: Professional) { setEditingId(item.id); setForm({ name: item.name, specialty: item.specialty, phone: item.phone }); setOpen(true); setError(""); }

  async function submit() {
    if (saving || !form.name.trim() || !form.specialty.trim()) return;
    setSaving(true); setError("");
    const values = { business_id: businessId, name: form.name.trim(), specialty: form.specialty.trim(), phone: form.phone.trim() };
    const request = editingId
      ? supabase.from("professionals").update(values).eq("id", editingId).eq("business_id", businessId)
      : supabase.from("professionals").insert(values);
    const { data, error: requestError } = await request.select("id,name,specialty,phone,active").single();
    if (requestError) { setError(requestError.message); setSaving(false); return; }
    setItems((current) => editingId ? current.map((item) => item.id === editingId ? data : item) : [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
    setSaving(false); setOpen(false); setEditingId(null); setForm(emptyForm);
  }

  async function toggle(item: Professional) {
    setError("");
    const { data, error: requestError } = await supabase.from("professionals").update({ active: !item.active }).eq("id", item.id).eq("business_id", businessId).select("id,name,specialty,phone,active").single();
    if (requestError) setError(requestError.message);
    else setItems((current) => current.map((row) => row.id === item.id ? data : row));
  }

  return <div className="content">
    <div className="page-heading"><div><h1>Profissionais</h1><p>Cadastre, edite e controle quem atende no estabelecimento.</p></div><button className="button button-primary" onClick={startCreate}>+ Adicionar profissional</button></div>
    {error && <div className="notice-box" style={{marginBottom:16}}>{error}</div>}
    <div className="card panel" style={{marginBottom:16}}><input className="input" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar por nome ou especialidade" /></div>
    <div className="card panel table-wrap"><table className="table"><thead><tr><th>Profissional</th><th>Especialidade</th><th>WhatsApp</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {filtered.map((item)=><tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.specialty}</td><td>{item.phone || "Não informado"}</td><td><span className={`badge ${item.active ? "badge-success" : "badge-purple"}`}>{item.active ? "Ativo" : "Inativo"}</span></td><td><div style={{display:"flex",gap:8}}><button className="button button-secondary" onClick={()=>startEdit(item)}>Editar</button><button className="button button-secondary" onClick={()=>toggle(item)}>{item.active ? "Desativar" : "Ativar"}</button></div></td></tr>)}
      {!filtered.length && <tr><td colSpan={5}><div className="empty-state"><h3>Nenhum profissional encontrado</h3><p>Cadastre o primeiro profissional ou altere sua busca.</p></div></td></tr>}
    </tbody></table></div>
    {open && <div style={{position:"fixed",inset:0,zIndex:80,display:"grid",placeItems:"center",padding:20,background:"rgba(6,10,24,.64)"}} onMouseDown={()=>!saving&&setOpen(false)}><section className="card panel" style={{width:"min(560px,100%)"}} onMouseDown={(event)=>event.stopPropagation()}><div className="panel-header"><div><h3>{editingId ? "Editar profissional" : "Novo profissional"}</h3></div><button className="icon-button" disabled={saving} onClick={()=>setOpen(false)}>×</button></div><div className="field"><label>Nome completo</label><input className="input" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></div><div className="field"><label>Especialidade</label><input className="input" value={form.specialty} onChange={(e)=>setForm({...form,specialty:e.target.value})} /></div><div className="field"><label>WhatsApp</label><input className="input" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} /></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:24}}><button className="button button-secondary" disabled={saving} onClick={()=>setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving || !form.name.trim() || !form.specialty.trim()} onClick={submit}>{saving ? "Salvando..." : "Salvar profissional"}</button></div></section></div>}
  </div>;
}
