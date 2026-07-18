"use client";

import { useEffect, useMemo, useState } from "react";
import { createLocalId, loadProfessionals, ProfessionalRecord, saveProfessionals } from "@/lib/local-data";

const emptyForm = { name: "", specialty: "", phone: "" };

export function ProfessionalsManager() {
  const [items, setItems] = useState<ProfessionalRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => setItems(loadProfessionals()), []);
  useEffect(() => { if (items.length || window.localStorage.getItem("cruz-agenda-professionals-v1")) saveProfessionals(items); }, [items]);

  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.specialty}`.toLowerCase().includes(query.toLowerCase())), [items, query]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function startEdit(item: ProfessionalRecord) {
    setEditingId(item.id);
    setForm({ name: item.name, specialty: item.specialty, phone: item.phone });
    setOpen(true);
  }

  function submit() {
    if (!form.name.trim() || !form.specialty.trim()) return;
    if (editingId) {
      setItems((current) => current.map((item) => item.id === editingId ? { ...item, ...form } : item));
    } else {
      setItems((current) => [...current, { id: createLocalId("professional"), ...form, active: true }]);
    }
    setOpen(false);
    setForm(emptyForm);
  }

  function toggle(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, active: !item.active } : item));
  }

  return <div className="content">
    <div className="page-heading"><div><h1>Profissionais</h1><p>Cadastre, edite e controle quem atende no estabelecimento.</p></div><button className="button button-primary" onClick={startCreate}>+ Adicionar profissional</button></div>
    <div className="card panel" style={{marginBottom:16}}><input className="input" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar por nome ou especialidade" /></div>
    <div className="card panel table-wrap"><table className="table"><thead><tr><th>Profissional</th><th>Especialidade</th><th>WhatsApp</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {filtered.map((item)=><tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.specialty}</td><td>{item.phone || "Não informado"}</td><td><span className={`badge ${item.active ? "badge-success" : "badge-purple"}`}>{item.active ? "Ativo" : "Inativo"}</span></td><td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="button button-secondary" onClick={()=>startEdit(item)}>Editar</button><button className="button button-secondary" onClick={()=>toggle(item.id)}>{item.active ? "Desativar" : "Ativar"}</button></div></td></tr>)}
      {!filtered.length && <tr><td colSpan={5}><div className="empty-state"><h3>Nenhum profissional encontrado</h3><p>Cadastre o primeiro profissional ou altere sua busca.</p></div></td></tr>}
    </tbody></table></div>
    {open && <div style={{position:"fixed",inset:0,zIndex:80,display:"grid",placeItems:"center",padding:20,background:"rgba(6,10,24,.64)"}} onMouseDown={()=>setOpen(false)}><section className="card panel" style={{width:"min(560px,100%)"}} onMouseDown={(e)=>e.stopPropagation()}><div className="panel-header"><div><h3>{editingId ? "Editar profissional" : "Novo profissional"}</h3><p className="table-muted">Os dados serão usados na agenda e na página pública.</p></div><button className="icon-button" onClick={()=>setOpen(false)}>×</button></div><div className="field"><label>Nome completo</label><input className="input" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></div><div className="field"><label>Especialidade</label><input className="input" value={form.specialty} onChange={(e)=>setForm({...form,specialty:e.target.value})} /></div><div className="field"><label>WhatsApp</label><input className="input" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} placeholder="(11) 99999-9999" /></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:24}}><button className="button button-secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={!form.name.trim() || !form.specialty.trim()} onClick={submit}>Salvar profissional</button></div></section></div>}
  </div>;
}
