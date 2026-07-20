"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Professional = { id: string; name: string; specialty: string; phone: string; active: boolean; photo_url: string };
type Form = { name: string; specialty: string; phone: string; photo_url: string };
const emptyForm: Form = { name: "", specialty: "", phone: "", photo_url: "" };

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function ProfessionalsManager({ businessId, initialItems }: { businessId: string; initialItems: Professional[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Professional[]>(initialItems);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [togglingId, setTogglingId] = useState("");
  const [error, setError] = useState("");
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.specialty}`.toLowerCase().includes(query.toLowerCase())), [items, query]);

  function startCreate() { setEditingId(null); setForm(emptyForm); setOpen(true); setError(""); }
  function startEdit(item: Professional) { setEditingId(item.id); setForm({ name: item.name, specialty: item.specialty, phone: item.phone, photo_url: item.photo_url || "" }); setOpen(true); setError(""); }

  async function uploadPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Escolha uma imagem válida."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("A imagem deve ter no máximo 5 MB."); return; }
    setUploading(true); setError("");
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${businessId}/professionals/${editingId || crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (uploadError) setError(uploadError.message);
    else {
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      setForm((current) => ({ ...current, photo_url: `${data.publicUrl}?v=${Date.now()}` }));
    }
    setUploading(false);
  }

  async function submit() {
    if (saving || !form.name.trim() || !form.specialty.trim()) return;
    setSaving(true); setError("");
    const values = { business_id: businessId, name: form.name.trim(), specialty: form.specialty.trim(), phone: form.phone.trim(), photo_url: form.photo_url };
    const request = editingId
      ? supabase.from("professionals").update(values).eq("id", editingId).eq("business_id", businessId)
      : supabase.from("professionals").insert(values);
    const { data, error: requestError } = await request.select("id,name,specialty,phone,active,photo_url").single();
    if (requestError) { setError(requestError.message); setSaving(false); return; }
    setItems((current) => editingId ? current.map((item) => item.id === editingId ? data : item) : [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
    setSaving(false); setOpen(false); setEditingId(null); setForm(emptyForm);
  }

  async function toggle(item: Professional) {
    if (togglingId) return;
    setError("");
    setTogglingId(item.id);

    if (item.active) {
      const { count, error: countError } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("professional_id", item.id)
        .gte("appointment_date", todayInSaoPaulo())
        .neq("status", "cancelled");

      if (countError) {
        setError(countError.message);
        setTogglingId("");
        return;
      }

      const futureCount = count ?? 0;
      const message = futureCount
        ? `Este profissional possui ${futureCount} agendamento(s) futuro(s). Eles serão preservados, mas o profissional deixará de aparecer para novos agendamentos. Deseja continuar?`
        : "O profissional deixará de aparecer para novos agendamentos. O histórico existente será preservado. Deseja continuar?";

      if (!window.confirm(message)) {
        setTogglingId("");
        return;
      }
    }

    const { data, error: requestError } = await supabase.from("professionals").update({ active: !item.active }).eq("id", item.id).eq("business_id", businessId).select("id,name,specialty,phone,active,photo_url").single();
    setTogglingId("");
    if (requestError) setError(requestError.message); else setItems((current) => current.map((row) => row.id === item.id ? data : row));
  }

  return <div className="content">
    <div className="page-heading"><div><h1>Profissionais</h1><p>Cadastre a equipe e adicione fotos para a página pública.</p></div><button className="button button-primary" onClick={startCreate}>+ Adicionar profissional</button></div>
    {error && <div className="notice-box" style={{marginBottom:16}}>{error}</div>}
    <div className="card panel" style={{marginBottom:16}}><input className="input" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar por nome ou especialidade" /></div>
    <div className="card panel table-wrap"><table className="table"><thead><tr><th>Profissional</th><th>Especialidade</th><th>WhatsApp</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {filtered.map((item)=><tr key={item.id}><td><div style={{display:"flex",alignItems:"center",gap:10}}>{item.photo_url ? <img src={item.photo_url} alt="" style={{width:42,height:42,borderRadius:"50%",objectFit:"cover"}} /> : <div className="profile-avatar small-avatar">{item.name.slice(0,1)}</div>}<strong>{item.name}</strong></div></td><td>{item.specialty}</td><td>{item.phone || "Não informado"}</td><td><span className={`badge ${item.active ? "badge-success" : "badge-purple"}`}>{item.active ? "Ativo" : "Inativo"}</span></td><td><div style={{display:"flex",gap:8}}><button className="button button-secondary" disabled={Boolean(togglingId)} onClick={()=>startEdit(item)}>Editar</button><button className="button button-secondary" disabled={Boolean(togglingId)} onClick={()=>void toggle(item)}>{togglingId===item.id?"Verificando...":item.active?"Desativar":"Ativar"}</button></div></td></tr>)}
      {!filtered.length && <tr><td colSpan={5}><div className="empty-state"><h3>Nenhum profissional encontrado</h3></div></td></tr>}
    </tbody></table></div>
    {open && <div style={{position:"fixed",inset:0,zIndex:80,display:"grid",placeItems:"center",padding:20,background:"rgba(6,10,24,.64)"}} onMouseDown={()=>!saving&&setOpen(false)}><section className="card panel" style={{width:"min(560px,100%)"}} onMouseDown={(event)=>event.stopPropagation()}><div className="panel-header"><h3>{editingId ? "Editar profissional" : "Novo profissional"}</h3><button className="icon-button" disabled={saving} onClick={()=>setOpen(false)}>×</button></div><div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>{form.photo_url ? <img src={form.photo_url} alt="Prévia" style={{width:84,height:84,borderRadius:"50%",objectFit:"cover"}} /> : <div className="profile-avatar" style={{width:84,height:84}}>{form.name.slice(0,1)||"P"}</div>}<label className="button button-secondary" style={{cursor:"pointer"}}>{uploading ? "Enviando..." : "Escolher foto"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploading} onChange={(e)=>void uploadPhoto(e.target.files?.[0])} /></label></div><div className="field"><label>Nome completo</label><input className="input" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} /></div><div className="field"><label>Especialidade</label><input className="input" value={form.specialty} onChange={(e)=>setForm({...form,specialty:e.target.value})} /></div><div className="field"><label>WhatsApp</label><input className="input" inputMode="tel" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} /></div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:24}}><button className="button button-secondary" disabled={saving} onClick={()=>setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={saving||uploading||!form.name.trim()||!form.specialty.trim()} onClick={submit}>{saving?"Salvando...":"Salvar profissional"}</button></div></section></div>}
  </div>;
}
