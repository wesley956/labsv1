"use client";

import { useEffect, useMemo, useState } from "react";
import { createLocalId, loadProfessionals, loadServices, ProfessionalRecord, saveServices, ServiceRecord } from "@/lib/local-data";

const emptyForm = { name: "", duration: 30, price: "", professionalIds: [] as string[] };

export function ServicesManager() {
  const [professionals, setProfessionals] = useState<ProfessionalRecord[]>([]);
  const [items, setItems] = useState<ServiceRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const professionalData = loadProfessionals();
    setProfessionals(professionalData);
    setItems(loadServices(professionalData));
  }, []);

  useEffect(() => { if (items.length || window.localStorage.getItem("cruz-agenda-services-v1")) saveServices(items); }, [items]);

  const filtered = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [items, query]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function startEdit(item: ServiceRecord) {
    setEditingId(item.id);
    setForm({ name: item.name, duration: item.duration, price: item.price, professionalIds: item.professionalIds });
    setOpen(true);
  }

  function submit() {
    if (!form.name.trim() || !form.price.trim()) return;
    if (editingId) {
      setItems((current) => current.map((item) => item.id === editingId ? { ...item, ...form } : item));
    } else {
      setItems((current) => [...current, { id: createLocalId("service"), ...form, active: true }]);
    }
    setOpen(false);
    setForm(emptyForm);
  }

  function toggle(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, active: !item.active } : item));
  }

  function toggleProfessional(id: string) {
    setForm((current) => ({ ...current, professionalIds: current.professionalIds.includes(id) ? current.professionalIds.filter((value) => value !== id) : [...current.professionalIds, id] }));
  }

  function professionalNames(ids: string[]) {
    const names = professionals.filter((professional) => ids.includes(professional.id)).map((professional) => professional.name);
    return names.length ? names.join(", ") : "Nenhum vinculado";
  }

  return <div className="content">
    <div className="page-heading"><div><h1>Serviços</h1><p>Defina duração, preço e quais profissionais realizam cada serviço.</p></div><button className="button button-primary" onClick={startCreate}>+ Adicionar serviço</button></div>
    <div className="card panel" style={{marginBottom:16}}><input className="input" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar serviço" /></div>
    <div className="card panel table-wrap"><table className="table"><thead><tr><th>Serviço</th><th>Duração</th><th>Preço</th><th>Profissionais</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {filtered.map((item)=><tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.duration} min</td><td>{item.price}</td><td>{professionalNames(item.professionalIds)}</td><td><span className={`badge ${item.active ? "badge-success" : "badge-purple"}`}>{item.active ? "Ativo" : "Inativo"}</span></td><td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="button button-secondary" onClick={()=>startEdit(item)}>Editar</button><button className="button button-secondary" onClick={()=>toggle(item.id)}>{item.active ? "Desativar" : "Ativar"}</button></div></td></tr>)}
      {!filtered.length && <tr><td colSpan={6}><div className="empty-state"><h3>Nenhum serviço encontrado</h3><p>Cadastre um serviço ou altere sua busca.</p></div></td></tr>}
    </tbody></table></div>
    {open && <div style={{position:"fixed",inset:0,zIndex:80,display:"grid",placeItems:"center",padding:20,background:"rgba(6,10,24,.64)"}} onMouseDown={()=>setOpen(false)}><section className="card panel" style={{width:"min(620px,100%)",maxHeight:"90vh",overflow:"auto"}} onMouseDown={(e)=>e.stopPropagation()}><div className="panel-header"><div><h3>{editingId ? "Editar serviço" : "Novo serviço"}</h3><p className="table-muted">Essas informações aparecerão no agendamento público.</p></div><button className="icon-button" onClick={()=>setOpen(false)}>×</button></div><div className="field"><label>Nome do serviço</label><input className="input" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}><div className="field"><label>Duração</label><select className="input" value={form.duration} onChange={(e)=>setForm({...form,duration:Number(e.target.value)})}><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>1 hora</option><option value={90}>1h30</option><option value={120}>2 horas</option></select></div><div className="field"><label>Preço</label><input className="input" value={form.price} onChange={(e)=>setForm({...form,price:e.target.value})} placeholder="R$ 50,00" /></div></div><div className="field"><label>Profissionais que realizam este serviço</label><div style={{display:"grid",gap:8}}>{professionals.map((professional)=><label key={professional.id} style={{display:"flex",alignItems:"center",gap:10,padding:12,border:"1px solid var(--border)",borderRadius:12}}><input type="checkbox" checked={form.professionalIds.includes(professional.id)} onChange={()=>toggleProfessional(professional.id)} /><span><strong>{professional.name}</strong><small style={{display:"block",color:"var(--muted)"}}>{professional.specialty}</small></span></label>)}{!professionals.length && <div className="notice-box">Cadastre um profissional antes de vincular o serviço.</div>}</div></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:24}}><button className="button button-secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={!form.name.trim() || !form.price.trim()} onClick={submit}>Salvar serviço</button></div></section></div>}
  </div>;
}
