"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Professional = { id: string; name: string; specialty: string; active: boolean };
type Service = { id: string; name: string; duration: number; price: number; active: boolean; professionalIds: string[] };
type Props = { businessId: string; initialProfessionals: Professional[]; initialServices: Service[] };

const emptyForm = { name: "", duration: 30, price: "", professionalIds: [] as string[] };

function parsePrice(value: string) {
  const normalized = value.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized || 0);
}

function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function ServicesManager({ businessId, initialProfessionals, initialServices }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [professionals] = useState(initialProfessionals);
  const [items, setItems] = useState(initialServices);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [items, query]);

  function startCreate() { setEditingId(null); setForm(emptyForm); setError(""); setOpen(true); }
  function startEdit(item: Service) { setEditingId(item.id); setForm({ name: item.name, duration: item.duration, price: String(item.price).replace(".", ","), professionalIds: item.professionalIds }); setError(""); setOpen(true); }
  function toggleProfessional(id: string) { setForm((current) => ({ ...current, professionalIds: current.professionalIds.includes(id) ? current.professionalIds.filter((value) => value !== id) : [...current.professionalIds, id] })); }

  async function submit() {
    const price = parsePrice(form.price);
    if (!form.name.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(form.duration) || form.duration <= 0) {
      setError("Informe nome, duração e preço válidos.");
      return;
    }
    setSaving(true); setError("");

    try {
      let serviceId = editingId;
      if (editingId) {
        const { error: updateError } = await supabase.from("services").update({ name: form.name.trim(), duration_minutes: form.duration, price }).eq("id", editingId).eq("business_id", businessId);
        if (updateError) throw updateError;

        const previousIds = items.find((item) => item.id === editingId)?.professionalIds ?? [];
        const idsToAdd = form.professionalIds.filter((id) => !previousIds.includes(id));
        const idsToRemove = previousIds.filter((id) => !form.professionalIds.includes(id));

        if (idsToAdd.length) {
          const { error: addError } = await supabase.from("service_professionals").insert(idsToAdd.map((professionalId) => ({ business_id: businessId, service_id: editingId, professional_id: professionalId })));
          if (addError) throw addError;
        }
        if (idsToRemove.length) {
          const { error: removeError } = await supabase.from("service_professionals").delete().eq("service_id", editingId).eq("business_id", businessId).in("professional_id", idsToRemove);
          if (removeError) throw removeError;
        }
      } else {
        const { data, error: insertError } = await supabase.from("services").insert({ business_id: businessId, name: form.name.trim(), duration_minutes: form.duration, price }).select("id").single();
        if (insertError) throw insertError;
        serviceId = data.id;
        if (form.professionalIds.length) {
          const { error: linksError } = await supabase.from("service_professionals").insert(form.professionalIds.map((professionalId) => ({ business_id: businessId, service_id: data.id, professional_id: professionalId })));
          if (linksError) {
            await supabase.from("services").delete().eq("id", data.id).eq("business_id", businessId);
            throw linksError;
          }
        }
      }

      if (!serviceId) throw new Error("Serviço não identificado.");
      const next: Service = { id: serviceId, name: form.name.trim(), duration: form.duration, price, active: editingId ? items.find((item) => item.id === editingId)?.active ?? true : true, professionalIds: form.professionalIds };
      setItems((current) => editingId ? current.map((item) => item.id === editingId ? next : item) : [...current, next].sort((a, b) => a.name.localeCompare(b.name)));
      setOpen(false); setForm(emptyForm); setEditingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o serviço.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: Service) {
    if (togglingId) return;
    setError("");
    setTogglingId(item.id);

    if (item.active) {
      const { count, error: countError } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("service_id", item.id)
        .gte("appointment_date", todayInSaoPaulo())
        .neq("status", "cancelled");

      if (countError) {
        setError(countError.message);
        setTogglingId("");
        return;
      }

      const futureCount = count ?? 0;
      const message = futureCount
        ? `Este serviço possui ${futureCount} agendamento(s) futuro(s). Eles serão preservados, mas o serviço deixará de aparecer para novos agendamentos. Deseja continuar?`
        : "O serviço deixará de aparecer para novos agendamentos. O histórico existente será preservado. Deseja continuar?";

      if (!window.confirm(message)) {
        setTogglingId("");
        return;
      }
    }

    const active = !item.active;
    const { error: updateError } = await supabase.from("services").update({ active }).eq("id", item.id).eq("business_id", businessId);
    setTogglingId("");
    if (updateError) return setError(updateError.message);
    setItems((current) => current.map((service) => service.id === item.id ? { ...service, active } : service));
  }

  function professionalNames(ids: string[]) {
    const names = professionals.filter((professional) => ids.includes(professional.id)).map((professional) => professional.name);
    return names.length ? names.join(", ") : "Nenhum vinculado";
  }

  return <div className="content">
    <div className="page-heading"><div><h1>Serviços</h1><p>Defina duração, preço e quais profissionais realizam cada serviço.</p></div><button className="button button-primary" onClick={startCreate}>+ Adicionar serviço</button></div>
    {error && <div className="notice-box" style={{marginBottom:16}}>{error}</div>}
    <div className="card panel" style={{marginBottom:16}}><input className="input" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar serviço" /></div>
    <div className="card panel table-wrap"><table className="table"><thead><tr><th>Serviço</th><th>Duração</th><th>Preço</th><th>Profissionais</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {filtered.map((item)=><tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.duration} min</td><td>{formatPrice(item.price)}</td><td>{professionalNames(item.professionalIds)}</td><td><span className={`badge ${item.active ? "badge-success" : "badge-purple"}`}>{item.active ? "Ativo" : "Inativo"}</span></td><td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="button button-secondary" disabled={Boolean(togglingId)} onClick={()=>startEdit(item)}>Editar</button><button className="button button-secondary" disabled={Boolean(togglingId)} onClick={()=>void toggle(item)}>{togglingId===item.id?"Verificando...":item.active?"Desativar":"Ativar"}</button></div></td></tr>)}
      {!filtered.length && <tr><td colSpan={6}><div className="empty-state"><h3>Nenhum serviço encontrado</h3><p>Cadastre um serviço ou altere sua busca.</p></div></td></tr>}
    </tbody></table></div>
    {open && <div style={{position:"fixed",inset:0,zIndex:80,display:"grid",placeItems:"center",padding:20,background:"rgba(6,10,24,.64)"}} onMouseDown={()=>!saving&&setOpen(false)}><section className="card panel" style={{width:"min(620px,100%)",maxHeight:"90vh",overflow:"auto"}} onMouseDown={(e)=>e.stopPropagation()}><div className="panel-header"><div><h3>{editingId ? "Editar serviço" : "Novo serviço"}</h3><p className="table-muted">Essas informações aparecerão no agendamento público.</p></div><button className="icon-button" disabled={saving} onClick={()=>setOpen(false)}>×</button></div>{error&&<div className="notice-box">{error}</div>}<div className="field"><label>Nome do serviço</label><input className="input" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}><div className="field"><label>Duração</label><select className="input" value={form.duration} onChange={(e)=>setForm({...form,duration:Number(e.target.value)})}><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>1 hora</option><option value={90}>1h30</option><option value={120}>2 horas</option></select></div><div className="field"><label>Preço</label><input className="input" value={form.price} onChange={(e)=>setForm({...form,price:e.target.value})} placeholder="R$ 50,00" /></div></div><div className="field"><label>Profissionais que realizam este serviço</label><div style={{display:"grid",gap:8}}>{professionals.filter((professional)=>professional.active).map((professional)=><label key={professional.id} style={{display:"flex",alignItems:"center",gap:10,padding:12,border:"1px solid var(--border)",borderRadius:12}}><input type="checkbox" checked={form.professionalIds.includes(professional.id)} onChange={()=>toggleProfessional(professional.id)} /><span><strong>{professional.name}</strong><small style={{display:"block",color:"var(--muted)"}}>{professional.specialty}</small></span></label>)}{!professionals.some((professional)=>professional.active) && <div className="notice-box">Cadastre ou ative um profissional antes de vincular o serviço.</div>}</div></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:24}}><button className="button button-secondary" disabled={saving} onClick={()=>setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving || !form.name.trim() || !form.price.trim()} onClick={submit}>{saving ? "Salvando..." : "Salvar serviço"}</button></div></section></div>}
  </div>;
}
