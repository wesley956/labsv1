"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const tabs = ["Negócio", "Agendamento", "Mensagens", "Aparência", "Página pública"] as const;
type Tab = (typeof tabs)[number];
type Theme = "system" | "light" | "dark";
type Settings = {
  name: string; segment: string; phone: string; city: string; address: string; slug: string;
  public_description: string; minimum_notice_hours: number; booking_window_days: number;
  slot_step_minutes: number; allow_client_cancellation: boolean; cancellation_notice_hours: number;
  theme: Theme; show_prices_publicly: boolean; show_professional_specialty: boolean;
  whatsapp_confirmation_template: string; require_professional_confirmation: boolean;
};

function normalizeSlug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function SettingsManager({ businessId }: { businessId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<Tab>("Negócio");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase.from("businesses").select("name,segment,phone,city,address,slug,public_description,minimum_notice_hours,booking_window_days,slot_step_minutes,allow_client_cancellation,cancellation_notice_hours,theme,show_prices_publicly,show_professional_specialty,whatsapp_confirmation_template,require_professional_confirmation").eq("id", businessId).single();
      if (loadError) setError(loadError.message);
      else { setSettings(data as Settings); document.documentElement.dataset.theme = data.theme === "system" ? "" : data.theme; }
    }
    void load();
  }, [businessId, supabase]);

  const publicUrl = useMemo(() => !settings ? "" : typeof window === "undefined" ? `/${settings.slug}` : `${window.location.origin}/${settings.slug}`, [settings]);
  function update<K extends keyof Settings>(field: K, value: Settings[K]) { setSettings((current) => current ? { ...current, [field]: value } : current); }

  async function persist() {
    if (!settings || saving) return;
    setSaving(true); setSaved(false); setError("");
    const payload = { ...settings, name: settings.name.trim(), slug: normalizeSlug(settings.slug) };
    const { error: updateError } = await supabase.from("businesses").update(payload).eq("id", businessId);
    if (updateError) setError(updateError.code === "23505" ? "Este endereço público já está sendo usado." : updateError.message);
    else { setSettings(payload); document.documentElement.dataset.theme = payload.theme === "system" ? "" : payload.theme; setSaved(true); window.setTimeout(() => setSaved(false), 1500); }
    setSaving(false);
  }

  if (!settings) return <div className="content"><div className="card panel">{error || "Carregando configurações..."}</div></div>;

  return <div className="content settings-page">
    <div className="page-heading"><div><h1>Configurações</h1><p>Controle os dados do negócio, regras de reserva e aparência.</p></div><button className="button button-primary" disabled={saving || !settings.name.trim() || !settings.slug} onClick={() => void persist()}>{saving ? "Salvando..." : saved ? "Salvo ✓" : "Salvar alterações"}</button></div>
    {error && <div className="notice-box" style={{ marginBottom: 16 }}>{error}</div>}
    <div className="settings-layout">
      <nav className="card settings-tabs">{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
      <section className="card settings-card">
        {tab === "Negócio" && <><div className="settings-heading"><h2>Dados do estabelecimento</h2><p>Essas informações aparecem no painel e na página pública.</p></div><div className="settings-grid"><div className="field field-wide"><label>Nome do estabelecimento</label><input className="input" value={settings.name} onChange={(e) => update("name", e.target.value)} /></div><div className="field"><label>Segmento</label><input className="input" value={settings.segment} onChange={(e) => update("segment", e.target.value)} /></div><div className="field"><label>WhatsApp comercial</label><input className="input" value={settings.phone} onChange={(e) => update("phone", e.target.value)} /></div><div className="field"><label>Cidade</label><input className="input" value={settings.city} onChange={(e) => update("city", e.target.value)} /></div><div className="field"><label>Endereço</label><input className="input" value={settings.address} onChange={(e) => update("address", e.target.value)} /></div></div></>}
        {tab === "Agendamento" && <><div className="settings-heading"><h2>Regras de agendamento</h2><p>Defina quando e como os clientes podem reservar.</p></div><div className="notice-box" style={{marginBottom:18}}><strong>Confirmação dos novos horários</strong><p style={{margin:"8px 0 14px"}}>Escolha se o cliente recebe confirmação imediata ou se a profissional precisa aprovar o horário.</p><label className="settings-switch"><input type="checkbox" checked={settings.require_professional_confirmation} onChange={(e) => update("require_professional_confirmation", e.target.checked)} /><span><strong>Exigir confirmação da profissional</strong><small>{settings.require_professional_confirmation ? "Novos horários entrarão como Aguardando confirmação." : "Novos horários entrarão automaticamente como Confirmados."}</small></span></label></div><div className="settings-grid"><div className="field"><label>Antecedência mínima</label><select className="input" value={settings.minimum_notice_hours} onChange={(e) => update("minimum_notice_hours", Number(e.target.value))}>{[0,1,2,4,12,24].map((v)=><option key={v} value={v}>{v === 0 ? "Sem antecedência" : `${v} hora${v > 1 ? "s" : ""}`}</option>)}</select></div><div className="field"><label>Janela futura</label><select className="input" value={settings.booking_window_days} onChange={(e) => update("booking_window_days", Number(e.target.value))}>{[15,30,60,90,120].map((v)=><option key={v} value={v}>{v} dias</option>)}</select></div><div className="field"><label>Intervalo entre opções</label><select className="input" value={settings.slot_step_minutes} onChange={(e) => update("slot_step_minutes", Number(e.target.value))}>{[15,30,60].map((v)=><option key={v} value={v}>{v} minutos</option>)}</select></div><div className="field"><label>Prazo para cancelamento</label><select className="input" value={settings.cancellation_notice_hours} onChange={(e) => update("cancellation_notice_hours", Number(e.target.value))}>{[1,2,4,12,24].map((v)=><option key={v} value={v}>{v} hora{v > 1 ? "s" : ""}</option>)}</select></div></div><label className="settings-switch"><input type="checkbox" checked={settings.allow_client_cancellation} onChange={(e) => update("allow_client_cancellation", e.target.checked)} /><span><strong>Permitir cancelamento pelo cliente</strong><small>Controla a futura área de gerenciamento da reserva.</small></span></label></>}
        {tab === "Mensagens" && <><div className="settings-heading"><h2>Confirmação pelo WhatsApp</h2><p>Personalize a mensagem aberta ao clicar no botão da agenda.</p></div><div className="field"><label>Mensagem padrão</label><textarea className="input settings-textarea" style={{minHeight:180}} value={settings.whatsapp_confirmation_template} onChange={(e) => update("whatsapp_confirmation_template", e.target.value)} /></div><div className="notice-box"><strong>Variáveis disponíveis</strong><p style={{margin:"8px 0 0"}}>{"{cliente}"}, {"{servico}"}, {"{data}"}, {"{horario}"}, {"{profissional}"} e {"{estabelecimento}"}.</p></div></>}
        {tab === "Aparência" && <><div className="settings-heading"><h2>Aparência do painel</h2><p>Escolha como o sistema deve ser exibido neste dispositivo.</p></div><div className="theme-options">{(["system", "light", "dark"] as Theme[]).map((value) => <button key={value} className={settings.theme === value ? "selected" : ""} onClick={() => update("theme", value)}><span>{value === "system" ? "◐" : value === "light" ? "☀" : "☾"}</span><strong>{value === "system" ? "Automático" : value === "light" ? "Claro" : "Escuro"}</strong></button>)}</div></>}
        {tab === "Página pública" && <><div className="settings-heading"><h2>Página pública</h2><p>Personalize o endereço e as informações exibidas aos clientes.</p></div><div className="field"><label>Link personalizado</label><div className="settings-slug"><span>{typeof window !== "undefined" ? `${window.location.origin}/` : "/"}</span><input value={settings.slug} onChange={(e) => update("slug", normalizeSlug(e.target.value))} /></div></div><div className="field"><label>Descrição pública</label><textarea className="input settings-textarea" value={settings.public_description} onChange={(e) => update("public_description", e.target.value)} /></div><label className="settings-switch"><input type="checkbox" checked={settings.show_prices_publicly} onChange={(e) => update("show_prices_publicly", e.target.checked)} /><span><strong>Mostrar preços</strong><small>Exibe o valor dos serviços na página pública.</small></span></label><label className="settings-switch"><input type="checkbox" checked={settings.show_professional_specialty} onChange={(e) => update("show_professional_specialty", e.target.checked)} /><span><strong>Mostrar especialidades</strong><small>Exibe a especialidade abaixo do nome do profissional.</small></span></label><div className="settings-public-preview"><div><small>Endereço atual</small><strong>{publicUrl}</strong></div><a className="button button-secondary" href={`/${settings.slug}`} target="_blank" rel="noreferrer">Abrir página</a></div></>}
      </section>
    </div>
  </div>;
}
