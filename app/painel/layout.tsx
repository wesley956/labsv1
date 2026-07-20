import Link from "next/link";
import { Brand } from "@/components/brand";
import { MobilePanelNav } from "@/components/mobile-panel-nav";
import { SubscriptionGate } from "@/components/subscription-gate";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";

const links = [
  ["/painel", "Visão geral"], ["/painel/agenda", "Agenda"], ["/painel/agendamentos", "Agendamentos"],
  ["/painel/lembretes", "Lembretes"], ["/painel/profissionais", "Profissionais"], ["/painel/servicos", "Serviços"],
  ["/painel/clientes", "Clientes"], ["/painel/disponibilidade", "Disponibilidade"], ["/painel/avaliacoes", "Avaliações"],
  ["/painel/relatorios", "Relatórios"], ["/painel/meu-link", "Meu link"], ["/painel/assinatura", "Assinatura"],
  ["/painel/configuracoes", "Configurações"]
];

function subscriptionLabel(status: string, accessible: boolean) {
  if (status === "active") return "Assinatura ativa";
  if (status === "trialing" && accessible) return "Período gratuito";
  if (status === "past_due" && accessible) return "Período de tolerância";
  return "Acesso limitado";
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const business = await requireCurrentBusiness();
  const initial = business.name.trim().slice(0, 1).toUpperCase() || "C";

  return <div className="app-shell"><aside className="sidebar"><Brand href="/painel" /><nav className="sidebar-nav">{links.map(([href,label])=><Link className="sidebar-link" href={href} key={href}>{label}</Link>)}</nav><div className="sidebar-bottom"><small>Estabelecimento</small><strong style={{display:"block",marginTop:6}}>{business.name}</strong><small>{subscriptionLabel(business.subscriptionStatus,business.subscriptionAccessible)}</small></div></aside><main className="app-main"><header className="topbar"><div><h2>{business.name}</h2><small className="table-muted">Link público: /{business.slug}</small></div><div className="topbar-actions"><ThemeToggle /><Link className="icon-button" aria-label="Lembretes" href="/painel/lembretes">♢</Link><div className="avatar" title={business.userEmail}>{initial}</div></div></header><SubscriptionGate accessible={business.subscriptionAccessible} status={business.subscriptionStatus} trialEndsAt={business.trialEndsAt} graceEndsAt={business.subscriptionGraceEndsAt}>{children}</SubscriptionGate></main><MobilePanelNav /></div>;
}
