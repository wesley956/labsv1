"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const tabs = ["Negócio", "Agendamento", "Mensagens", "Marca pública", "Aparência", "Página pública"] as const;
type Tab = (typeof tabs)[number];
type Theme = "system" | "light" | "dark";
type Settings = {
  name:string; segment:string; phone:string; city:string; address:string; slug:string; public_description:string;
  minimum_notice_hours:number; booking_window_days:number; slot_step_minutes:number; allow_client_cancellation:boolean;
  cancellation_notice_hours:number; theme:Theme; show_prices_publicly:boolean; show_professional_specialty:boolean;
  whatsapp_confirmation_template:string; require_professional_confirmation:boolean;
  logo_url:string; cover_url:string; instagram_url:string; primary_color:string; opening_hours_text:string;
};

function normalizeSlug(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");}

export function SettingsManager({ businessId }: { businessId:string }) {
  const supabase=useMemo(()=>createClient(),[]);
  const [settings,setSettings]=useState<Settings|null>(null);
  const [tab,setTab]=useState<Tab>("Negócio");
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [uploading,setUploading]=useState<"logo_url"|"cover_url"|null>(null);
  const [error,setError]=useState("");

  useEffect(()=>{async function load(){const {data,error:loadError}=await supabase.from("businesses").select("name,segment,phone,city,address,slug,public_description,minimum_notice_hours,booking_window_days,slot_step_minutes,allow_client_cancellation,cancellation_notice_hours,theme,show_prices_publicly,show_professional_specialty,whatsapp_confirmation_template,require_professional_confirmation,logo_url,cover_url,instagram_url,primary_color,opening_hours_text").eq("id",businessId).single();if(loadError)setError(loadError.message);else{setSettings(data as Settings);document.documentElement.dataset.theme=data.theme==="system"?"":data.theme;}}void load();},[businessId,supabase]);

  const publicUrl=useMemo(()=>settings?(typeof window==="undefined"?`/${settings.slug}`:`${window.location.origin}/${settings.slug}`):"",[settings]);
  function update<K extends keyof Settings>(field:K,value:Settings[K]){setSettings(current=>current?{...current,[field]:value}:current);}

  async function uploadImage(field:"logo_url"|"cover_url",file?:File){
    if(!file)return;
    if(!file.type.startsWith("image/")){setError("Escolha uma imagem válida.");return;}
    if(file.size>5*1024*1024){setError("A imagem deve ter no máximo 5 MB.");return;}
    setUploading(field);setError("");
    const ext=file.name.split(".").pop()?.toLowerCase()||"jpg";
    const path=`${businessId}/branding/${field}.${ext}`;
    const {error:uploadError}=await supabase.storage.from("logos").upload(path,file,{upsert:true,cacheControl:"3600"});
    if(uploadError)setError(uploadError.message);else{const {data}=supabase.storage.from("logos").getPublicUrl(path);update(field,`${data.publicUrl}?v=${Date.now()}`);}
    setUploading(null);
  }

  async function persist(){if(!settings||saving)return;setSaving(true);setSaved(false);setError("");const payload={...settings,name:settings.name.trim(),slug:normalizeSlug(settings.slug),primary_color:/^#[0-9a-fA-F]{6}$/.test(settings.primary_color)?settings.primary_color:"#7c3aed"};const {error:updateError}=await supabase.from("businesses").update(payload).eq("id",businessId);if(updateError)setError(updateError.code==="23505"?"Este endereço público já está sendo usado.":updateError.message);else{setSettings(payload);document.documentElement.dataset.theme=payload.theme==="system"?"":payload.theme;setSaved(true);window.setTimeout(()=>setSaved(false),1500);}setSaving(false);}

  if(!settings)return <div className="content"><div className="card panel">{error||"Carregando configurações..."}</div></div>;

  return <div className="content settings-page">
    <div className="page-heading"><div><h1>Configurações</h1><p>Controle os dados, regras e identidade pública do salão.</p></div><button className="button button-primary" disabled={saving||!!uploading||!settings.name.trim()||!settings.slug} onClick={()=>void persist()}>{saving?"Salvando...":saved?"Salvo ✓":"Salvar alterações"}</button></div>
    {error&&<div className="notice-box" style={{marginBottom:16}}>{error}</div>}
    <div className="settings-layout"><nav className="card settings-tabs">{tabs.map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}</button>)}</nav><section className="card settings-card">
      {tab==="Negócio"&&<><div className="settings-heading"><h2>Dados do estabelecimento</h2><p>Informações usadas no painel e na vitrine pública.</p></div><div className="settings-grid"><div className="field field-wide"><label>Nome do estabelecimento</label><input className="input" value={settings.name} onChange={e=>update("name",e.target.value)}/></div><div className="field"><label>Segmento</label><input className="input" value={settings.segment} onChange={e=>update("segment",e.target.value)}/></div><div className="field"><label>WhatsApp comercial</label><input className="input" value={settings.phone} onChange={e=>update("phone",e.target.value)}/></div><div className="field"><label>Cidade</label><input className="input" value={settings.city} onChange={e=>update("city",e.target.value)}/></div><div className="field field-wide"><label>Endereço</label><input className="input" value={settings.address} onChange={e=>update("address",e.target.value)}/></div></div></>}
      {tab==="Agendamento"&&<><div className="settings-heading"><h2>Regras de agendamento</h2><p>Defina como novos horários entram na agenda.</p></div><label className="settings-switch"><input type="checkbox" checked={settings.require_professional_confirmation} onChange={e=>update("require_professional_confirmation",e.target.checked)}/><span><strong>Exigir confirmação da profissional</strong><small>{settings.require_professional_confirmation?"Novos horários entram como aguardando confirmação.":"Novos horários entram automaticamente como confirmados."}</small></span></label><div className="settings-grid"><div className="field"><label>Antecedência mínima</label><select className="input" value={settings.minimum_notice_hours} onChange={e=>update("minimum_notice_hours",Number(e.target.value))}>{[0,1,2,4,12,24].map(v=><option key={v} value={v}>{v===0?"Sem antecedência":`${v} hora${v>1?"s":""}`}</option>)}</select></div><div className="field"><label>Janela futura</label><select className="input" value={settings.booking_window_days} onChange={e=>update("booking_window_days",Number(e.target.value))}>{[15,30,60,90,120].map(v=><option key={v} value={v}>{v} dias</option>)}</select></div><div className="field"><label>Intervalo</label><select className="input" value={settings.slot_step_minutes} onChange={e=>update("slot_step_minutes",Number(e.target.value))}>{[15,30,60].map(v=><option key={v} value={v}>{v} minutos</option>)}</select></div><div className="field"><label>Prazo para cancelamento</label><select className="input" value={settings.cancellation_notice_hours} onChange={e=>update("cancellation_notice_hours",Number(e.target.value))}>{[1,2,4,12,24].map(v=><option key={v} value={v}>{v} hora{v>1?"s":""}</option>)}</select></div></div><label className="settings-switch"><input type="checkbox" checked={settings.allow_client_cancellation} onChange={e=>update("allow_client_cancellation",e.target.checked)}/><span><strong>Permitir cancelamento pelo cliente</strong><small>Controla o gerenciamento futuro da reserva.</small></span></label></>}
      {tab==="Mensagens"&&<><div className="settings-heading"><h2>Confirmação pelo WhatsApp</h2><p>Personalize a mensagem aberta a partir da agenda.</p></div><div className="field"><label>Mensagem padrão</label><textarea className="input settings-textarea" style={{minHeight:180}} value={settings.whatsapp_confirmation_template} onChange={e=>update("whatsapp_confirmation_template",e.target.value)}/></div><div className="notice-box"><strong>Variáveis:</strong><p>{"{cliente}"}, {"{servico}"}, {"{data}"}, {"{horario}"}, {"{profissional}"} e {"{estabelecimento}"}.</p></div></>}
      {tab==="Marca pública"&&<><div className="settings-heading"><h2>Identidade do salão</h2><p>Essas informações terão destaque na página de agendamento.</p></div><div className="settings-grid"><div className="field"><label>Logo ou foto principal</label>{settings.logo_url&&<img src={settings.logo_url} alt="Logo atual" style={{width:96,height:96,borderRadius:24,objectFit:"cover",marginBottom:10}}/>}<label className="button button-secondary" style={{cursor:"pointer",width:"fit-content"}}>{uploading==="logo_url"?"Enviando...":"Escolher logo"}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadImage("logo_url",e.target.files?.[0])}/></label></div><div className="field"><label>Imagem de capa</label>{settings.cover_url&&<img src={settings.cover_url} alt="Capa atual" style={{width:"100%",height:110,borderRadius:16,objectFit:"cover",marginBottom:10}}/>}<label className="button button-secondary" style={{cursor:"pointer",width:"fit-content"}}>{uploading==="cover_url"?"Enviando...":"Escolher capa"}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadImage("cover_url",e.target.files?.[0])}/></label></div><div className="field"><label>Cor principal</label><div style={{display:"flex",gap:10,alignItems:"center"}}><input type="color" value={settings.primary_color} onChange={e=>update("primary_color",e.target.value)} style={{width:56,height:44,border:0,background:"transparent"}}/><input className="input" value={settings.primary_color} onChange={e=>update("primary_color",e.target.value)}/></div></div><div className="field"><label>Instagram</label><input className="input" value={settings.instagram_url} onChange={e=>update("instagram_url",e.target.value)} placeholder="https://instagram.com/seuperfil"/></div><div className="field field-wide"><label>Horário de funcionamento</label><textarea className="input settings-textarea" value={settings.opening_hours_text} onChange={e=>update("opening_hours_text",e.target.value)} placeholder="Segunda a sexta, 09h às 18h\nSábado, 09h às 13h"/></div></div></>}
      {tab==="Aparência"&&<><div className="settings-heading"><h2>Aparência do painel</h2></div><div className="theme-options">{(["system","light","dark"] as Theme[]).map(value=><button key={value} className={settings.theme===value?"selected":""} onClick={()=>update("theme",value)}><span>{value==="system"?"◐":value==="light"?"☀":"☾"}</span><strong>{value==="system"?"Automático":value==="light"?"Claro":"Escuro"}</strong></button>)}</div></>}
      {tab==="Página pública"&&<><div className="settings-heading"><h2>Página pública</h2><p>Personalize o endereço e a apresentação.</p></div><div className="field"><label>Link personalizado</label><div className="settings-slug"><span>{typeof window!=="undefined"?`${window.location.origin}/`:"/"}</span><input value={settings.slug} onChange={e=>update("slug",normalizeSlug(e.target.value))}/></div></div><div className="field"><label>Descrição pública</label><textarea className="input settings-textarea" value={settings.public_description} onChange={e=>update("public_description",e.target.value)}/></div><label className="settings-switch"><input type="checkbox" checked={settings.show_prices_publicly} onChange={e=>update("show_prices_publicly",e.target.checked)}/><span><strong>Mostrar preços</strong></span></label><label className="settings-switch"><input type="checkbox" checked={settings.show_professional_specialty} onChange={e=>update("show_professional_specialty",e.target.checked)}/><span><strong>Mostrar especialidades</strong></span></label><div className="settings-public-preview"><div><small>Endereço atual</small><strong>{publicUrl}</strong></div><a className="button button-secondary" href={`/${settings.slug}`} target="_blank" rel="noreferrer">Abrir página</a></div></>}
    </section></div>
  </div>;
}
