import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";

function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function monthStart() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`; }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()); }

export default async function ReportsPage() {
  const business = await requireCurrentBusiness();
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").select("id,customer_name,service_name,professional_name,service_price,status,appointment_date").eq("business_id", business.id).gte("appointment_date", monthStart()).lte("appointment_date", today()).order("appointment_date");
  if (error) throw new Error(`Não foi possível carregar os relatórios: ${error.message}`);
  const rows = data ?? [];
  const valid = rows.filter((item) => item.status !== "cancelled");
  const completed = rows.filter((item) => item.status === "completed");
  const cancelled = rows.filter((item) => item.status === "cancelled");
  const revenue = completed.reduce((sum, item) => sum + Number(item.service_price || 0), 0);
  const expected = valid.reduce((sum, item) => sum + Number(item.service_price || 0), 0);
  const byService = Object.entries(valid.reduce<Record<string, { count: number; total: number }>>((acc, item) => { const key = item.service_name; acc[key] ??= { count: 0, total: 0 }; acc[key].count += 1; acc[key].total += Number(item.service_price || 0); return acc; }, {})).sort((a,b) => b[1].count-a[1].count);
  const byProfessional = Object.entries(valid.reduce<Record<string, number>>((acc, item) => { acc[item.professional_name] = (acc[item.professional_name] ?? 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]);
  const returning = Object.entries(valid.reduce<Record<string, number>>((acc, item) => { acc[item.customer_name] = (acc[item.customer_name] ?? 0) + 1; return acc; }, {})).filter(([,count]) => count > 1).sort((a,b) => b[1]-a[1]);

  return <div className="content">
    <div className="page-heading"><div><h1>Relatórios</h1><p>Resultados do mês atual com dados reais da agenda.</p></div></div>
    <section className="stats-grid">
      <div className="card stat-card"><span>Faturamento realizado</span><strong>{money(revenue)}</strong><small className="table-muted">Atendimentos concluídos</small></div>
      <div className="card stat-card"><span>Faturamento previsto</span><strong>{money(expected)}</strong><small className="table-muted">Todos não cancelados</small></div>
      <div className="card stat-card"><span>Atendimentos</span><strong>{valid.length}</strong><small className="table-muted">{completed.length} concluídos</small></div>
      <div className="card stat-card"><span>Cancelamentos</span><strong>{cancelled.length}</strong><small className="table-muted">{rows.length ? Math.round(cancelled.length / rows.length * 100) : 0}% do total</small></div>
    </section>
    <section className="dashboard-grid" style={{ marginTop: 16 }}>
      <div className="card panel"><div className="panel-header"><h3>Serviços mais agendados</h3></div><div className="appointment-list">{byService.slice(0,8).map(([name,info]) => <div className="appointment-item" key={name}><strong>{info.count}x</strong><div><b>{name}</b><br/><small>{money(info.total)} previstos</small></div></div>)}{!byService.length && <div className="empty-state"><strong>Sem dados neste mês</strong></div>}</div></div>
      <div className="card panel"><div className="panel-header"><h3>Atendimentos por profissional</h3></div><div className="appointment-list">{byProfessional.slice(0,8).map(([name,count]) => <div className="appointment-item" key={name}><strong>{count}</strong><div><b>{name}</b><br/><small>agendamento(s)</small></div></div>)}{!byProfessional.length && <div className="empty-state"><strong>Sem dados neste mês</strong></div>}</div></div>
    </section>
    <section className="card panel" style={{ marginTop: 16 }}><div className="panel-header"><h3>Clientes recorrentes</h3></div><div className="appointment-list">{returning.slice(0,10).map(([name,count]) => <div className="appointment-item" key={name}><strong>{count}x</strong><div><b>{name}</b><br/><small>atendimentos no mês</small></div></div>)}{!returning.length && <div className="empty-state"><strong>Ainda não há clientes recorrentes neste mês</strong></div>}</div></section>
  </div>;
}
