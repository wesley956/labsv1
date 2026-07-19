import Link from "next/link";
import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function DashboardPage() {
  const business = await requireCurrentBusiness();
  const supabase = await createClient();
  const today = todayIso();
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const [appointmentsResult, clientsResult, professionalsResult, servicesResult, availabilityResult, pendingResult, reminderResult, planResult] = await Promise.all([
    supabase.from("appointments").select("id,customer_name,service_name,professional_name,start_time,service_price,status,confirmation_state").eq("business_id", business.id).eq("appointment_date", today).neq("status", "cancelled").order("start_time"),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("business_id", business.id),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("active", true),
    supabase.from("weekly_availability").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("enabled", true),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("confirmation_state", "pending").neq("status", "cancelled").gte("appointment_date", today),
    supabase.from("appointments").select("id,customer_name,service_name,professional_name,appointment_date,start_time,customer_phone,reminder_24h_sent_at").eq("business_id", business.id).neq("status", "cancelled").gte("appointment_date", today).lte("appointment_date", tomorrow.slice(0, 10)).is("reminder_24h_sent_at", null).order("appointment_date").order("start_time").limit(6),
    supabase.from("businesses").select("trial_ends_at,subscription_status,plan_name,monthly_price").eq("id", business.id).single(),
  ]);

  const queryError = appointmentsResult.error || clientsResult.error || professionalsResult.error || servicesResult.error || availabilityResult.error || pendingResult.error || reminderResult.error || planResult.error;
  if (queryError) throw new Error(`Não foi possível carregar o painel: ${queryError.message}`);

  const appointments = appointmentsResult.data ?? [];
  const expectedRevenue = appointments.filter((item) => item.status === "confirmed" || item.status === "completed").reduce((total, item) => total + Number(item.service_price || 0), 0);
  const trialEnds = new Date(planResult.data.trial_ends_at);
  const trialDays = Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000));

  const setupItems = [
    { label: "Dados do estabelecimento", done: Boolean(business.name && business.slug) },
    { label: "Adicionar profissional", done: (professionalsResult.count ?? 0) > 0 },
    { label: "Adicionar serviço", done: (servicesResult.count ?? 0) > 0 },
    { label: "Definir disponibilidade", done: (availabilityResult.count ?? 0) > 0 },
    { label: "Compartilhar seu link", done: Boolean(business.slug) },
  ];
  const completedSetup = setupItems.filter((item) => item.done).length;
  const setupPercentage = Math.round((completedSetup / setupItems.length) * 100);

  return <div className="content">
    <div className="page-heading"><div><h1>Olá! 👋</h1><p>Aqui está o resumo de {business.name} hoje.</p></div><Link className="button button-primary" href="/painel/agendamentos">+ Novo agendamento</Link></div>

    {(pendingResult.count ?? 0) > 0 && <div className="notice-box" style={{ marginBottom: 16 }}><strong>Você possui {pendingResult.count} agendamento(s) aguardando confirmação.</strong><p style={{ margin: "6px 0 0" }}><Link href="/painel/agenda">Abra a agenda para confirmar e enviar a mensagem pelo WhatsApp.</Link></p></div>}

    <section className="stats-grid">
      <div className="card stat-card"><span>Agendamentos hoje</span><strong>{appointments.length}</strong><small className="table-muted">Atendimentos não cancelados</small></div>
      <div className="card stat-card"><span>Faturamento previsto</span><strong>{money(expectedRevenue)}</strong><small className="table-muted">Confirmados e concluídos hoje</small></div>
      <div className="card stat-card"><span>Aguardando confirmação</span><strong>{pendingResult.count ?? 0}</strong><small className="table-muted">Horários futuros pendentes</small></div>
      <div className="card stat-card"><span>{planResult.data.subscription_status === "trialing" ? "Período gratuito" : planResult.data.plan_name}</span><strong>{planResult.data.subscription_status === "trialing" ? `${trialDays} dias` : money(Number(planResult.data.monthly_price))}</strong><small className="table-muted">Status: {planResult.data.subscription_status}</small></div>
    </section>

    <section className="dashboard-grid">
      <div className="card panel"><div className="panel-header"><h3>Atendimentos de hoje</h3><Link className="table-muted" href="/painel/agenda">Ver agenda</Link></div><div className="appointment-list">
        {appointments.slice(0, 6).map((item) => <div className="appointment-item" key={item.id}><strong>{item.start_time.slice(0, 5)}</strong><div><b>{item.customer_name}</b><br/><small>{item.service_name}</small></div><span className={`badge ${item.confirmation_state === "pending" ? "badge-purple" : "badge-success"}`}>{item.confirmation_state === "pending" ? "Pendente" : item.professional_name}</span></div>)}
        {appointments.length === 0 && <div className="empty-state"><strong>Nenhum atendimento hoje</strong><p>Os próximos agendamentos aparecerão aqui.</p></div>}
      </div></div>

      <div className="card panel"><div className="panel-header"><h3>Lembretes pendentes</h3><span className="badge badge-purple">Próximas 24h</span></div><div className="appointment-list">
        {(reminderResult.data ?? []).map((item) => <div className="appointment-item" key={item.id}><strong>{item.start_time.slice(0,5)}</strong><div><b>{item.customer_name}</b><br/><small>{item.service_name} · {item.professional_name}</small></div><Link className="button button-secondary" href="/painel/agenda">Enviar</Link></div>)}
        {(reminderResult.data ?? []).length === 0 && <div className="empty-state"><strong>Nenhum lembrete pendente</strong><p>Os próximos lembretes aparecerão aqui.</p></div>}
      </div></div>
    </section>

    <section className="card panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Configuração da conta</h3><span className="badge badge-success">{setupPercentage}%</span></div><div className="checklist">{setupItems.map((item) => <div className="check-item" key={item.label}><span className="check">{item.done ? "✓" : ""}</span><span>{item.label}</span></div>)}</div></section>
  </div>;
}
