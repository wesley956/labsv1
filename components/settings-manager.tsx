"use client";

import { useEffect, useMemo, useState } from "react";
import { BusinessSettings, loadSettings, normalizeSlug, saveSettings } from "@/lib/settings-data";

const tabs = ["Negócio", "Agendamento", "Aparência", "Página pública"] as const;
type Tab = (typeof tabs)[number];

export function SettingsManager() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [tab, setTab] = useState<Tab>("Negócio");
  const [saved, setSaved] = useState(false);

  useEffect(() => setSettings(loadSettings()), []);

  const publicUrl = useMemo(() => {
    if (!settings) return "";
    return typeof window === "undefined" ? `/${settings.slug}` : `${window.location.origin}/${settings.slug}`;
  }, [settings]);

  function update<K extends keyof BusinessSettings>(field: K, value: BusinessSettings[K]) {
    setSettings((current) => current ? { ...current, [field]: value } : current);
  }

  function persist() {
    if (!settings) return;
    saveSettings(settings);
    document.documentElement.dataset.theme = settings.theme === "system" ? "" : settings.theme;
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  if (!settings) return <div className="content"><div className="card panel">Carregando configurações...</div></div>;

  return <div className="content settings-page">
    <div className="page-heading"><div><h1>Configurações</h1><p>Controle os dados do negócio, regras de reserva e aparência.</p></div><button className="button button-primary" onClick={persist}>{saved ? "Salvo ✓" : "Salvar alterações"}</button></div>

    <div className="settings-layout">
      <nav className="card settings-tabs">{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>

      <section className="card settings-card">
        {tab === "Negócio" && <>
          <div className="settings-heading"><h2>Dados do estabelecimento</h2><p>Essas informações aparecem no painel e na página pública.</p></div>
          <div className="settings-grid">
            <div className="field field-wide"><label>Nome do estabelecimento</label><input className="input" value={settings.businessName} onChange={(e) => update("businessName", e.target.value)} /></div>
            <div className="field"><label>Segmento</label><input className="input" value={settings.segment} onChange={(e) => update("segment", e.target.value)} /></div>
            <div className="field"><label>WhatsApp comercial</label><input className="input" value={settings.phone} onChange={(e) => update("phone", e.target.value)} /></div>
            <div className="field"><label>Cidade</label><input className="input" value={settings.city} onChange={(e) => update("city", e.target.value)} /></div>
            <div className="field"><label>Endereço</label><input className="input" value={settings.address} onChange={(e) => update("address", e.target.value)} placeholder="Rua, número e bairro" /></div>
          </div>
        </>}

        {tab === "Agendamento" && <>
          <div className="settings-heading"><h2>Regras de agendamento</h2><p>Defina quando e como os clientes podem reservar.</p></div>
          <div className="settings-grid">
            <div className="field"><label>Antecedência mínima</label><select className="input" value={settings.minimumNoticeHours} onChange={(e) => update("minimumNoticeHours", Number(e.target.value))}><option value={0}>Sem antecedência</option><option value={1}>1 hora</option><option value={2}>2 horas</option><option value={4}>4 horas</option><option value={12}>12 horas</option><option value={24}>24 horas</option></select></div>
            <div className="field"><label>Janela futura</label><select className="input" value={settings.bookingWindowDays} onChange={(e) => update("bookingWindowDays", Number(e.target.value))}><option value={15}>15 dias</option><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option><option value={120}>120 dias</option></select></div>
            <div className="field"><label>Intervalo entre opções</label><select className="input" value={settings.slotStepMinutes} onChange={(e) => update("slotStepMinutes", Number(e.target.value))}><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={60}>60 minutos</option></select></div>
            <div className="field"><label>Prazo para cancelamento</label><select className="input" value={settings.cancellationNoticeHours} onChange={(e) => update("cancellationNoticeHours", Number(e.target.value))}><option value={1}>1 hora</option><option value={2}>2 horas</option><option value={4}>4 horas</option><option value={12}>12 horas</option><option value={24}>24 horas</option></select></div>
          </div>
          <label className="settings-switch"><input type="checkbox" checked={settings.allowClientCancellation} onChange={(e) => update("allowClientCancellation", e.target.checked)} /><span><strong>Permitir cancelamento pelo cliente</strong><small>Deixa preparada a futura área de gerenciamento da reserva.</small></span></label>
        </>}

        {tab === "Aparência" && <>
          <div className="settings-heading"><h2>Aparência do painel</h2><p>Escolha como o sistema deve ser exibido neste dispositivo.</p></div>
          <div className="theme-options">{(["system", "light", "dark"] as const).map((value) => <button key={value} className={settings.theme === value ? "selected" : ""} onClick={() => update("theme", value)}><span>{value === "system" ? "◐" : value === "light" ? "☀" : "☾"}</span><strong>{value === "system" ? "Automático" : value === "light" ? "Claro" : "Escuro"}</strong></button>)}</div>
        </>}

        {tab === "Página pública" && <>
          <div className="settings-heading"><h2>Página pública</h2><p>Personalize o endereço e as informações exibidas aos clientes.</p></div>
          <div className="field"><label>Link personalizado</label><div className="settings-slug"><span>{typeof window !== "undefined" ? `${window.location.origin}/` : "/"}</span><input value={settings.slug} onChange={(e) => update("slug", normalizeSlug(e.target.value))} /></div></div>
          <div className="field"><label>Descrição pública</label><textarea className="input settings-textarea" value={settings.publicDescription} onChange={(e) => update("publicDescription", e.target.value)} /></div>
          <label className="settings-switch"><input type="checkbox" checked={settings.showPricesPublicly} onChange={(e) => update("showPricesPublicly", e.target.checked)} /><span><strong>Mostrar preços</strong><small>Exibe o valor dos serviços na página pública.</small></span></label>
          <label className="settings-switch"><input type="checkbox" checked={settings.showProfessionalSpecialty} onChange={(e) => update("showProfessionalSpecialty", e.target.checked)} /><span><strong>Mostrar especialidades</strong><small>Exibe a especialidade abaixo do nome do profissional.</small></span></label>
          <div className="settings-public-preview"><div><small>Endereço atual</small><strong>{publicUrl}</strong></div><a className="button button-secondary" href={`/${settings.slug}`} target="_blank">Abrir página</a></div>
        </>}
      </section>
    </div>
  </div>;
}
