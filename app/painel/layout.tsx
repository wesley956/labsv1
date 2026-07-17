import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  ["/painel", "Visão geral"], ["/painel/agenda", "Agenda"], ["/painel/agendamentos", "Agendamentos"],
  ["/painel/profissionais", "Profissionais"], ["/painel/servicos", "Serviços"], ["/painel/clientes", "Clientes"],
  ["/painel/disponibilidade", "Disponibilidade"], ["/painel/meu-link", "Meu link"], ["/painel/configuracoes", "Configurações"]
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="app-shell"><aside className="sidebar"><Brand href="/painel" /><nav className="sidebar-nav">{links.map(([href,label],i)=><Link className={`sidebar-link ${i===0?"active":""}`} href={href} key={href}>{label}</Link>)}</nav><div className="sidebar-bottom"><small>Plano atual</small><strong style={{display:"block",marginTop:6}}>15 dias grátis</strong><small>Restam 7 dias</small></div></aside><main className="app-main"><header className="topbar"><h2>Studio Bella</h2><div className="topbar-actions"><ThemeToggle /><button className="icon-button">♢</button><div className="avatar">M</div></div></header>{children}</main><nav className="mobile-nav"><Link href="/painel">Início</Link><Link href="/painel/agenda">Agenda</Link><Link href="/painel/agendamentos">Novo</Link><Link href="/painel/clientes">Clientes</Link><Link href="/painel/configuracoes">Mais</Link></nav></div>;
}
