"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { persistOnboarding } from "@/lib/supabase/onboarding";

type Business = { name: string; segment: string; phone: string; city: string; slug: string };
type Professional = { name: string; specialty: string };
type Service = { name: string; duration: string; price: string };
type Day = { label: string; enabled: boolean; start: string; end: string };
type Draft = { business: Business; professional: Professional; services: Service[]; days: Day[] };

const STORAGE_KEY = "cruz-agenda-onboarding-v1";
const initialDraft: Draft = {
  business: { name: "", segment: "Beleza e estética", phone: "", city: "", slug: "" },
  professional: { name: "", specialty: "" },
  services: [{ name: "", duration: "30", price: "" }],
  days: [
    { label: "Segunda", enabled: true, start: "09:00", end: "18:00" },
    { label: "Terça", enabled: true, start: "09:00", end: "18:00" },
    { label: "Quarta", enabled: true, start: "09:00", end: "18:00" },
    { label: "Quinta", enabled: true, start: "09:00", end: "18:00" },
    { label: "Sexta", enabled: true, start: "09:00", end: "18:00" },
    { label: "Sábado", enabled: true, start: "09:00", end: "13:00" },
    { label: "Domingo", enabled: false, start: "09:00", end: "13:00" },
  ],
};
const steps = ["Estabelecimento", "Profissional", "Serviços", "Horários", "Publicar"];

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setDraft(JSON.parse(stored) as Draft);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setSaved(true);
    const timer = window.setTimeout(() => setSaved(false), 1200);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const progress = ((step + 1) / steps.length) * 100;
  const publicUrl = `cruzagenda.com/${draft.business.slug || "seu-negocio"}`;
  const valid = useMemo(() => {
    if (step === 0) return Boolean(draft.business.name && draft.business.phone && draft.business.slug);
    if (step === 1) return Boolean(draft.professional.name && draft.professional.specialty);
    if (step === 2) return draft.services.some((service) => service.name && service.price);
    if (step === 3) return draft.days.some((day) => day.enabled && day.start < day.end);
    return true;
  }, [draft, step]);

  function setBusiness(field: keyof Business, value: string) {
    setDraft((current) => ({ ...current, business: { ...current.business, [field]: value, ...(field === "name" && !current.business.slug ? { slug: slugify(value) } : {}) } }));
  }
  function setProfessional(field: keyof Professional, value: string) {
    setDraft((current) => ({ ...current, professional: { ...current.professional, [field]: value } }));
  }
  function setService(index: number, field: keyof Service, value: string) {
    setDraft((current) => ({ ...current, services: current.services.map((service, i) => i === index ? { ...service, [field]: value } : service) }));
  }
  function addService() {
    setDraft((current) => ({ ...current, services: [...current.services, { name: "", duration: "30", price: "" }] }));
  }
  function removeService(index: number) {
    setDraft((current) => ({ ...current, services: current.services.filter((_, i) => i !== index) }));
  }
  function setDay(index: number, field: keyof Day, value: string | boolean) {
    setDraft((current) => ({ ...current, days: current.days.map((day, i) => i === index ? { ...day, [field]: value } : day) }));
  }

  async function finishOnboarding() {
    setSubmitting(true);
    setSubmitError("");
    try {
      await persistOnboarding(draft);
      window.localStorage.removeItem(STORAGE_KEY);
      router.replace("/painel");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível concluir a configuração.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="onboarding-shell">
    <aside className="onboarding-aside"><div><span className="eyebrow">Configuração inicial</span><h1>Vamos colocar sua agenda para funcionar.</h1><p>Você poderá alterar todas essas informações depois. O progresso é salvo automaticamente neste dispositivo.</p></div><div className="onboarding-summary card"><small>Seu link público</small><strong>{publicUrl}</strong><span>{saved ? "Progresso salvo" : "Salvamento automático ativo"}</span></div></aside>
    <section className="onboarding-main">
      <div className="onboarding-progress-head"><div><small>Etapa {step + 1} de {steps.length}</small><strong>{steps[step]}</strong></div><span>{Math.round(progress)}%</span></div>
      <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>
      <div className="step-list">{steps.map((label, index) => <button className={index === step ? "active" : index < step ? "done" : ""} key={label} onClick={() => index <= step && setStep(index)}>{index < step ? "✓" : index + 1}<span>{label}</span></button>)}</div>
      <section className="card onboarding-card">
        {step === 0 && <><div className="form-heading"><h2>Conte sobre seu negócio</h2><p>Esses dados aparecerão no painel e na página pública.</p></div><div className="form-grid"><div className="field field-wide"><label>Nome do estabelecimento</label><input className="input" value={draft.business.name} onChange={(e) => setBusiness("name", e.target.value)} placeholder="Ex.: Studio Bella" /></div><div className="field"><label>Segmento</label><select className="input" value={draft.business.segment} onChange={(e) => setBusiness("segment", e.target.value)}><option>Beleza e estética</option><option>Barbearia</option><option>Salão de beleza</option><option>Studio de sobrancelhas</option><option>Manicure e pedicure</option><option>Tatuagem</option><option>Outro</option></select></div><div className="field"><label>WhatsApp comercial</label><input className="input" value={draft.business.phone} onChange={(e) => setBusiness("phone", e.target.value)} placeholder="(11) 99999-9999" /></div><div className="field"><label>Cidade</label><input className="input" value={draft.business.city} onChange={(e) => setBusiness("city", e.target.value)} placeholder="Sua cidade" /></div><div className="field"><label>Link personalizado</label><div className="slug-input"><span>cruzagenda.com/</span><input value={draft.business.slug} onChange={(e) => setBusiness("slug", slugify(e.target.value))} /></div></div></div></>}
        {step === 1 && <><div className="form-heading"><h2>Cadastre o primeiro profissional</h2><p>Pode ser você ou a primeira pessoa que realizará atendimentos.</p></div><div className="profile-preview"><div className="profile-avatar">{draft.professional.name.slice(0, 1).toUpperCase() || "P"}</div><div><strong>{draft.professional.name || "Nome do profissional"}</strong><span>{draft.professional.specialty || "Especialidade"}</span></div></div><div className="form-grid"><div className="field"><label>Nome</label><input className="input" value={draft.professional.name} onChange={(e) => setProfessional("name", e.target.value)} placeholder="Ex.: Maria Silva" /></div><div className="field"><label>Especialidade</label><input className="input" value={draft.professional.specialty} onChange={(e) => setProfessional("specialty", e.target.value)} placeholder="Ex.: Designer de sobrancelhas" /></div></div><div className="notice-box">Depois você poderá cadastrar outros profissionais e definir horários diferentes para cada um.</div></>}
        {step === 2 && <><div className="form-heading"><h2>Quais serviços serão oferecidos?</h2><p>Cadastre pelo menos um serviço com duração e preço.</p></div><div className="service-editor-list">{draft.services.map((service, index) => <div className="service-editor" key={index}><div className="field"><label>Serviço</label><input className="input" value={service.name} onChange={(e) => setService(index, "name", e.target.value)} placeholder="Design de sobrancelhas" /></div><div className="field"><label>Duração</label><select className="input" value={service.duration} onChange={(e) => setService(index, "duration", e.target.value)}><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option></select></div><div className="field"><label>Preço</label><input className="input" value={service.price} onChange={(e) => setService(index, "price", e.target.value)} placeholder="R$ 40,00" /></div>{draft.services.length > 1 && <button className="remove-button" onClick={() => removeService(index)} aria-label="Remover serviço">×</button>}</div>)}</div><button className="button button-secondary" onClick={addService}>+ Adicionar outro serviço</button></>}
        {step === 3 && <><div className="form-heading"><h2>Defina os horários de atendimento</h2><p>Esta será a disponibilidade inicial do primeiro profissional.</p></div><div className="availability-editor">{draft.days.map((day, index) => <div className={`availability-row ${day.enabled ? "" : "disabled"}`} key={day.label}><label className="day-toggle"><input type="checkbox" checked={day.enabled} onChange={(e) => setDay(index, "enabled", e.target.checked)} /><span>{day.label}</span></label>{day.enabled ? <div className="time-range"><input className="input" type="time" value={day.start} onChange={(e) => setDay(index, "start", e.target.value)} /><span>até</span><input className="input" type="time" value={day.end} onChange={(e) => setDay(index, "end", e.target.value)} /></div> : <span className="closed-label">Fechado</span>}</div>)}</div></>}
        {step === 4 && <><div className="publish-hero"><div className="publish-check">✓</div><span className="eyebrow">Tudo pronto</span><h2>Sua agenda já pode receber clientes.</h2><p>Ao concluir, os dados serão gravados com segurança no Supabase.</p></div><div className="review-grid"><div><small>Estabelecimento</small><strong>{draft.business.name}</strong><span>{draft.business.segment}</span></div><div><small>Profissional</small><strong>{draft.professional.name}</strong><span>{draft.professional.specialty}</span></div><div><small>Serviços</small><strong>{draft.services.filter((service) => service.name).length}</strong><span>cadastrados</span></div><div><small>Dias disponíveis</small><strong>{draft.days.filter((day) => day.enabled).length}</strong><span>por semana</span></div></div><div className="public-link-card"><div><small>Compartilhe este link</small><strong>{publicUrl}</strong></div><button className="button button-secondary" onClick={() => navigator.clipboard?.writeText(`https://${publicUrl}`)}>Copiar link</button></div>{submitError && <div className="public-error">{submitError}</div>}</>}
        <footer className="onboarding-actions"><button className="button button-secondary" disabled={step === 0 || submitting} onClick={() => setStep((current) => Math.max(0, current - 1))}>Voltar</button>{step < steps.length - 1 ? <button className="button button-primary" disabled={!valid} onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>Continuar</button> : <button className="button button-primary" disabled={submitting} onClick={finishOnboarding}>{submitting ? "Criando sua agenda..." : "Criar agenda e entrar no painel"}</button>}</footer>
      </section>
    </section>
  </main>;
}
