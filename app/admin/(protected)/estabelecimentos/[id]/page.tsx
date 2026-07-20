import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/supabase/current-admin";
import { createClient } from "@/lib/supabase/server";

type BusinessDetail = {
  business: {
    id: string;
    owner_id: string;
    owner_email: string;
    name: string;
    segment: string;
    phone: string;
    city: string;
    address: string;
    slug: string;
    public_description: string;
    logo_url: string;
    cover_url: string;
    instagram_url: string;
    plan_name: string;
    monthly_price: number | string;
    subscription_status: string;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    subscription_grace_ends_at: string | null;
    created_at: string;
    updated_at: string;
  };
  counts: {
    professionals: number;
    active_professionals: number;
    services: number;
    active_services: number;
    clients: number;
    appointments: number;
    future_appointments: number;
    completed_30d: number;
    revenue_30d: number | string;
  };
  members: Array<{ user_id: string; email: string; role: string; created_at: string }>;
  recent_appointments: Array<{
    id: string;
    customer_name: string;
    professional_name: string;
    service_name: string;
    service_price: number | string;
    appointment_date: string;
    start_time: string;
    status: string;
    origin: string;
    confirmation_state: string;
    created_at: string;
  }>;
  payments: Array<{
    id: string;
    status: string;
    amount: number | string;
    due_at: string | null;
    paid_at: string | null;
    description: string;
    provider: string;
    created_at: string;
  }>;
  activity: {
    total: number;
    items: Array<{
      id: number;
      action: string;
      admin_email: string;
      business_name: string;
      metadata: Record<string, unknown>;
      created_at: string;
    }>;
  };
};

const subscriptionLabels: Record<string, string> = {
  trialing: "Em teste",
  active: "Ativo",
  past_due: "Pagamento pendente",
  suspended: "Suspenso",
  cancelled: "Cancelado",
};

const appointmentLabels: Record<string, string> = {
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

const paymentLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Pago",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  overdue: "Vencido",
};

const activityLabels: Record<string, string> = {
  subscription_updated: "Assinatura atualizada",
  business_deleted: "Estabelecimento excluído",
  admin_account_updated: "Conta administrativa atualizada",
  payment_created: "Pagamento registrado",
  payment_status_updated: "Status do pagamento atualizado",
};

function money(value: number | string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export default async function AdminBusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_business_detail", { p_business_id: id });

  if (error) {
    if (error.message.toLowerCase().includes("não encontrado")) notFound();
    throw new Error(`Não foi possível carregar o estabelecimento: ${error.message}`);
  }

  const detail = data as BusinessDetail;
  const business = detail.business;

  return (
    <div className="admin-content">
      <div className="page-heading">
        <div>
          <Link href="/admin/estabelecimentos" className="table-muted">← Voltar aos estabelecimentos</Link>
          <h1 style={{ marginTop: 8 }}>{business.name}</h1>
          <p>{business.owner_email || "Responsável sem e-mail"} · /{business.slug}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="button button-secondary" href={`/${business.slug}`} target="_blank">Abrir página pública</Link>
          <Link className="button button-primary" href={`/admin/pagamentos?business=${business.id}`}>Registrar pagamento</Link>
        </div>
      </div>

      <section className="admin-metrics">
        <div className="card admin-metric"><span>Clientes</span><strong>{detail.counts.clients}</strong><small className="table-muted">Cadastros preservados</small></div>
        <div className="card admin-metric"><span>Agendamentos</span><strong>{detail.counts.appointments}</strong><small className="table-muted">{detail.counts.future_appointments} futuros</small></div>
        <div className="card admin-metric"><span>Concluídos em 30 dias</span><strong>{detail.counts.completed_30d}</strong><small className="table-muted">Atendimentos realizados</small></div>
        <div className="card admin-metric"><span>Receita em 30 dias</span><strong>{money(detail.counts.revenue_30d)}</strong><small className="table-muted">Somente concluídos</small></div>
        <div className="card admin-metric"><span>Profissionais</span><strong>{detail.counts.active_professionals}/{detail.counts.professionals}</strong><small className="table-muted">Ativos / total</small></div>
        <div className="card admin-metric"><span>Serviços</span><strong>{detail.counts.active_services}/{detail.counts.services}</strong><small className="table-muted">Ativos / total</small></div>
        <div className="card admin-metric"><span>Mensalidade</span><strong>{money(business.monthly_price)}</strong><small className="table-muted">Plano {business.plan_name}</small></div>
        <div className="card admin-metric"><span>Assinatura</span><strong style={{ fontSize: 22 }}>{subscriptionLabels[business.subscription_status] ?? business.subscription_status}</strong><small className="table-muted">Atualizado em {date(business.updated_at)}</small></div>
      </section>

      <section className="card admin-section">
        <div className="admin-section-header"><div><h3>Dados do estabelecimento</h3><p>Informações comerciais, públicas e de assinatura.</p></div></div>
        <div className="settings-grid">
          <div className="field"><label>Responsável</label><strong>{business.owner_email || "Não informado"}</strong></div>
          <div className="field"><label>Segmento</label><strong>{business.segment || "Não informado"}</strong></div>
          <div className="field"><label>WhatsApp</label><strong>{business.phone || "Não informado"}</strong></div>
          <div className="field"><label>Cidade</label><strong>{business.city || "Não informada"}</strong></div>
          <div className="field field-wide"><label>Endereço</label><strong>{business.address || "Não informado"}</strong></div>
          <div className="field"><label>Cadastro</label><strong>{dateTime(business.created_at)}</strong></div>
          <div className="field"><label>Fim do teste</label><strong>{date(business.trial_ends_at)}</strong></div>
          <div className="field"><label>Tolerância</label><strong>{date(business.subscription_grace_ends_at)}</strong></div>
          <div className="field field-wide"><label>Descrição pública</label><div>{business.public_description || "Nenhuma descrição cadastrada."}</div></div>
        </div>
      </section>

      <section className="card admin-section">
        <div className="admin-section-header"><div><h3>Membros com acesso</h3><p>Usuários vinculados ao painel deste estabelecimento.</p></div></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>E-mail</th><th>Função</th><th>Vinculado em</th></tr></thead><tbody>
          {detail.members.map((member) => <tr key={member.user_id}><td>{member.email || "Sem e-mail"}</td><td><span className="badge badge-purple">{member.role}</span></td><td>{dateTime(member.created_at)}</td></tr>)}
          {!detail.members.length && <tr><td colSpan={3}><div className="empty-state"><strong>Nenhum membro vinculado</strong></div></td></tr>}
        </tbody></table></div>
      </section>

      <section className="card admin-section">
        <div className="admin-section-header"><div><h3>Agendamentos recentes</h3><p>Últimos 20 registros da agenda.</p></div></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Valor</th><th>Status</th></tr></thead><tbody>
          {detail.recent_appointments.map((appointment) => <tr key={appointment.id}><td><strong>{date(appointment.appointment_date)}</strong><div className="table-muted">{appointment.start_time.slice(0, 5)}</div></td><td>{appointment.customer_name}</td><td>{appointment.service_name}</td><td>{appointment.professional_name}</td><td>{money(appointment.service_price)}</td><td><span className={`badge ${appointment.status === "completed" ? "badge-success" : "badge-purple"}`}>{appointmentLabels[appointment.status] ?? appointment.status}</span></td></tr>)}
          {!detail.recent_appointments.length && <tr><td colSpan={6}><div className="empty-state"><strong>Nenhum agendamento registrado</strong></div></td></tr>}
        </tbody></table></div>
      </section>

      <section className="card admin-section">
        <div className="admin-section-header"><div><h3>Pagamentos</h3><p>Histórico financeiro registrado no ADM.</p></div><Link className="button button-secondary" href={`/admin/pagamentos?business=${business.id}`}>Ver e registrar</Link></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Registro</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>
          {detail.payments.map((payment) => <tr key={payment.id}><td>{dateTime(payment.created_at)}</td><td>{payment.description || "Mensalidade"}</td><td>{money(payment.amount)}</td><td>{date(payment.due_at)}</td><td><span className={`badge ${payment.status === "approved" ? "badge-success" : "badge-purple"}`}>{paymentLabels[payment.status] ?? payment.status}</span></td></tr>)}
          {!detail.payments.length && <tr><td colSpan={5}><div className="empty-state"><strong>Nenhum pagamento registrado</strong><p>A integração com Mercado Pago ainda será conectada a esta estrutura.</p></div></td></tr>}
        </tbody></table></div>
      </section>

      <section className="card admin-section">
        <div className="admin-section-header"><div><h3>Atividade administrativa</h3><p>{detail.activity.total} ação{detail.activity.total === 1 ? "" : "ões"} relacionada{detail.activity.total === 1 ? "" : "s"} a este estabelecimento.</p></div><Link className="button button-secondary" href="/admin/atividades">Histórico completo</Link></div>
        <div className="admin-events">
          {detail.activity.items.map((item) => <div className="admin-event" key={item.id}><div><strong>{activityLabels[item.action] ?? item.action.replaceAll("_", " ")}</strong><br /><small>Executado por {item.admin_email || "sistema"}</small></div><small>{dateTime(item.created_at)}</small></div>)}
          {!detail.activity.items.length && <div className="empty-state"><strong>Nenhuma atividade administrativa</strong></div>}
        </div>
      </section>
    </div>
  );
}
