import Link from "next/link";

const items = [
  ["/painel/clientes", "Clientes", "Cadastros e histórico dos clientes"],
  ["/painel/profissionais", "Profissionais", "Equipe e perfis profissionais"],
  ["/painel/servicos", "Serviços", "Serviços, preços e duração"],
  ["/painel/disponibilidade", "Disponibilidade", "Horários, folgas e bloqueios"],
  ["/painel/avaliacoes", "Avaliações", "Comentários e aprovação de avaliações"],
  ["/painel/relatorios", "Relatórios", "Faturamento e desempenho do mês"],
  ["/painel/meu-link", "Meu link", "Compartilhe sua página de agendamento"],
  ["/painel/assinatura", "Assinatura", "Plano, teste gratuito e pagamentos"],
  ["/painel/configuracoes", "Configurações", "Dados e preferências do estabelecimento"],
];

export default function MorePage() {
  return <div className="content">
    <div className="page-heading"><div><h1>Mais opções</h1><p>Acesse todas as áreas do seu painel.</p></div></div>
    <section className="card panel">
      <div className="appointment-list">
        {items.map(([href,title,description]) => <Link className="appointment-item" href={href} key={href}>
          <strong style={{fontSize:22}}>›</strong>
          <div><b>{title}</b><br/><small>{description}</small></div>
          <span className="table-muted">Abrir</span>
        </Link>)}
      </div>
    </section>
  </div>;
}
