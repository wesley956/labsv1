import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type DashboardData = {
  total_businesses: number;
  active_businesses: number;
  trialing_businesses: number;
  past_due_businesses: number;
  suspended_businesses: number;
  cancelled_businesses: number;
  trials_expiring_7d: number;
  total_clients: number;
  appointments_30d: number;
  completed_30d: number;
  revenue_30d: number | string;
  monthly_recurring_revenue: number | string;
};

type BusinessSummary = {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  subscription_status: string;
  created_at: string;
};

type AdminEvent = {
  id: number;
  action: string;
  admin_email: string;
  business_name: string;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  trialing: "Em teste",
  active: "Ativo",
  past_due: "Pagamento pendente",
  suspended: "Suspenso",
  cancelled: "Cancelado",
};

function money(value: number | string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const [dashboardResponse, businessesResponse, eventsResponse] = await Promise.all([
    supabase.rpc("get_admin_dashboard"),
    supabase.rpc("get_admin_businesses", { p_search: null, p_status: null }),
    supabase.rpc("get_admin_recent_events", { p_limit: 8 }),
  ]);

  const firstError = dashboardResponse.error || businessesResponse.error || eventsResponse.error;
  if (firstError) throw new Error(`Não foi possível carregar o painel administrativo: ${firstError.message}`);

  const dashboard = dashboardResponse.data as DashboardData;
  const businesses = (businessesResponse.data ?? []) as BusinessSummary[];
  const events = (eventsResponse.data ?? []) as AdminEvent[];

  return (
    <div className="admin-content">
      <div className="page-heading">
        <div>
          <h1>Visão geral</h1>
          <p>Indicadores reais de uso, assinaturas e operação da plataforma.</p>
        </div>
        <Link className="button button-primary" href="/admin/estabelecimentos">Gerenciar estabelecimentos</Link>
      </div>

      <section className="admin-metrics">
        <div className="card admin-metric"><span>Estabelecimentos</span><strong>{dashboard.total_businesses}</strong><small className="table-muted">{dashboard.active_businesses} ativos · {dashboard.trialing_businesses} em teste</small></div>
        <div className="card admin-metric"><span>MRR ativo</span><strong>{money(dashboard.monthly_recurring_revenue)}</strong><small className="table-muted">Mensalidades com status ativo</small></div>
        <div className="card admin-metric"><span>Agendamentos em 30 dias</span><strong>{dashboard.appointments_30d}</strong><small className="table-muted">{dashboard.completed_30d} concluídos</small></div>
        <div className="card admin-metric"><span>Receita movimentada</span><strong>{money(dashboard.revenue_30d)}</strong><small className="table-muted">Atendimentos concluídos em 30 dias</small></div>
        <div className="card admin-metric"><span>Clientes cadastrados</span><strong>{dashboard.total_clients}</strong><small className="table-muted">Em todos os estabelecimentos</small></div>
        <div className="card admin-metric"><span>Testes vencendo</span><strong>{dashboard.trials_expiring_7d}</strong><small className="table-muted">Nos próximos 7 dias</small></div>
        <div className="card admin-metric"><span>Pagamento pendente</span><strong>{dashboard.past_due_businesses}</strong><small className="table-muted">Contas em tolerância</small></div>
        <div className="card admin-metric"><span>Bloqueados</span><strong>{dashboard.suspended_businesses + dashboard.cancelled_businesses}</strong><small className="table-muted">Suspensos ou cancelados</small></div>
      </section>

      <section className="card admin-section">
        <div className="admin-section-header">
          <div><h3>Cadastros mais recentes</h3><p>Últimos estabelecimentos criados na plataforma.</p></div>
          <Link className="button button-secondary" href="/admin/estabelecimentos">Ver todos</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Estabelecimento</th><th>Responsável</th><th>Status</th><th>Cadastro</th></tr></thead>
            <tbody>
              {businesses.slice(0, 6).map((business) => (
                <tr key={business.id}>
                  <td><div className="admin-business-name"><strong>{business.name}</strong><small>/{business.slug}</small></div></td>
                  <td>{business.owner_email || "Não informado"}</td>
                  <td><span className={`badge ${business.subscription_status === "active" ? "badge-success" : "badge-purple"}`}>{statusLabels[business.subscription_status] ?? business.subscription_status}</span></td>
                  <td>{new Date(business.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {!businesses.length && <tr><td colSpan={4}><div className="empty-state"><strong>Nenhum estabelecimento cadastrado</strong></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card admin-section">
        <div className="admin-section-header"><div><h3>Histórico administrativo</h3><p>Alterações realizadas pelo ADM ficam registradas aqui.</p></div></div>
        <div className="admin-events">
          {events.map((event) => (
            <div className="admin-event" key={event.id}>
              <div><strong>Assinatura atualizada · {event.business_name}</strong><br /><small>Executado por {event.admin_email || "administrador"}</small></div>
              <small>{new Date(event.created_at).toLocaleString("pt-BR")}</small>
            </div>
          ))}
          {!events.length && <div className="empty-state"><strong>Nenhuma ação administrativa registrada</strong><p>As alterações de assinatura aparecerão aqui.</p></div>}
        </div>
      </section>
    </div>
  );
}
