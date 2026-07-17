import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  ["01", "Agenda sem conflitos", "Horários calculados por serviço e profissional, com bloqueios e disponibilidade individual."],
  ["02", "Link de agendamento", "Seu cliente escolhe serviço, profissional, data e horário sem precisar criar uma conta."],
  ["03", "Tudo em um painel", "Profissionais, serviços, clientes e atendimentos organizados em uma experiência simples."],
];

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className="nav"><a href="#recursos">Recursos</a><a href="#como-funciona">Como funciona</a><a href="#planos">Planos</a></nav>
          <div className="header-actions"><ThemeToggle /><Link className="button button-secondary" href="/login">Entrar</Link><Link className="button button-primary" href="/cadastro">Começar grátis</Link></div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="eyebrow">✦ 15 dias grátis para organizar sua rotina</span>
              <h1>Sua agenda organizada. <span className="gradient-text">Seus clientes agendando sozinhos.</span></h1>
              <p className="lead">Gerencie profissionais, serviços e horários em um só lugar. Menos tempo no WhatsApp e mais tempo atendendo seus clientes.</p>
              <div className="hero-actions"><Link className="button button-primary" href="/cadastro">Criar minha agenda</Link><Link className="button button-secondary" href="/painel">Ver demonstração</Link></div>
              <p className="hero-note">Sem cartão de crédito · Configuração guiada · Funciona no celular</p>
            </div>
            <div className="demo-window" aria-label="Prévia do painel Cruz Agenda">
              <div className="window-top"><i /><i /><i /></div>
              <div className="mini-dashboard">
                <aside className="mini-sidebar"><Brand href="/painel" /><div className="mini-nav-item active">Visão geral</div><div className="mini-nav-item">Agenda</div><div className="mini-nav-item">Profissionais</div><div className="mini-nav-item">Serviços</div><div className="mini-nav-item">Clientes</div></aside>
                <div className="mini-main">
                  <strong>Olá, Maria! 👋</strong>
                  <div className="mini-cards"><div className="mini-card"><small>Hoje</small><strong>8</strong></div><div className="mini-card"><small>Clientes</small><strong>128</strong></div><div className="mini-card"><small>Trial</small><strong>7d</strong></div></div>
                  <div className="mini-card schedule-preview"><b>Próximos atendimentos</b><div className="schedule-row"><span>09:00</span><div className="appointment-chip">Design de sobrancelhas · Juliana</div></div><div className="schedule-row"><span>10:30</span><div className="appointment-chip">Manicure · Ana Paula</div></div><div className="schedule-row"><span>14:00</span><div className="appointment-chip">Henna · Camila</div></div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="recursos"><div className="container"><div className="section-heading"><span className="eyebrow">Feito para a beleza</span><h2>Simples para começar. Completo para crescer.</h2><p>Uma experiência elegante para profissionais autônomos, studios, barbearias, clínicas e salões com várias equipes.</p></div><div className="feature-grid">{features.map(([icon,title,text]) => <article className="card feature-card" key={title}><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      </main>
    </>
  );
}
