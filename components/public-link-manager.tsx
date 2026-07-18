"use client";

import { useEffect, useState } from "react";
import { ONBOARDING_STORAGE_KEY } from "@/lib/local-data";

type Business = { name?: string; slug?: string };

export function PublicLinkManager() {
  const [business, setBusiness] = useState<Business>({ name: "Studio Bella", slug: "studio-bella" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw) as { business?: Business };
    if (draft.business) setBusiness(draft.business);
  }, []);

  const path = `/${business.slug || "studio-bella"}`;
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  async function copy() {
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    if (navigator.share) await navigator.share({ title: `Agende em ${business.name || "nosso estabelecimento"}`, text: "Escolha seu serviço, profissional e horário.", url });
    else await copy();
  }

  return <div className="content">
    <div className="page-heading"><div><h1>Meu link</h1><p>Compartilhe sua página pública de agendamento.</p></div><a className="button button-primary" href={path} target="_blank" rel="noreferrer">Abrir página pública</a></div>
    <div className="link-manager-grid">
      <section className="card panel link-main-card"><span className="eyebrow">Sua agenda está publicada</span><h2>{business.name}</h2><p>Clientes podem agendar sem criar conta e os horários entram diretamente na sua agenda.</p><div className="link-copy-row"><strong>{url}</strong><button className="button button-secondary" onClick={copy}>{copied ? "Copiado!" : "Copiar link"}</button></div><div className="link-actions"><button className="button button-primary" onClick={share}>Compartilhar</button><a className="button button-secondary" href={`https://wa.me/?text=${encodeURIComponent(`Agende seu horário: ${url}`)}`} target="_blank" rel="noreferrer">Enviar pelo WhatsApp</a></div></section>
      <aside className="card panel link-preview"><small>Prévia para o cliente</small><div className="link-phone"><div className="link-phone-top"/><div className="link-avatar">{business.name?.slice(0,1) || "C"}</div><strong>{business.name}</strong><span>Agendamento online</span><div className="link-preview-option">Escolha um serviço</div><div className="link-preview-option">Escolha o profissional</div><button>Começar agendamento</button></div></aside>
    </div>
    <section className="card panel link-channels"><h3>Onde compartilhar</h3><div className="channel-grid"><div><strong>WhatsApp</strong><span>Envie diretamente aos clientes.</span></div><div><strong>Instagram</strong><span>Adicione o link na bio.</span></div><div><strong>Google</strong><span>Inclua no perfil do negócio.</span></div></div></section>
  </div>;
}
