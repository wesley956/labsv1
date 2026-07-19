import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";

const links = [
  ["/painel", "Visão geral"], ["/painel/agenda", "Agenda"], ["/painel/agendamentos", "Agendamentos"],
  ["/painel/profissionais", "Profissionais"], ["/painel/servicos", "Serviços"], ["/painel/clientes", "Clientes"],
  ["/painel/disponibilidade", "Disponibilidade"], ["/painel/meu-link", "Meu link"], ["/painel/configuracoes", "Configurações"]
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const business = await requireCurrentBusiness();
  const initial = business.name.trim().slice(0, 1).toUpperCase() || "C";

  return <div className="app-shell"><aside className="sidebar"><Brand href="/painel" /><nav className="sidebar-nav">{links.map(([href,label])=><Link className="sidebar-link" href={href} key={href}>{label}</Link>)}</nav><div className="sidebar-bottom"><small>Estabelecimento</small><strong style={{display:"block",marginTop:6}}>{business.name}</strong><small>Plano inicial · 15 dias grátis</small></div></aside><main className="app-main"><header className="topbar"><div><h2>{business.name}</h2><small className="table-muted">cruzagenda.com/{business.slug}</small></div><div className="topbar-actions"><ThemeToggle /><button className="icon-button" aria-label="Notificações">♢</button><div className="avatar" title={business.userEmail}>{initial}</div></div></header>{children}</main><nav className="mobile-nav"><Link href="/painel">Início</Link><Link href="/painel/agenda">Agenda</Link><Link href="/painel/agendamentos">Novo</Link><Link href="/painel/clientes">Clientes</Link><Link href="/painel/configuracoes">Mais</Link></nav></div>;
}
