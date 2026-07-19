import { requireCurrentBusiness } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";

function money(value:number){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);}

export default async function SubscriptionPage(){
  const business=await requireCurrentBusiness();
  const supabase=await createClient();
  const{data,error}=await supabase.from("businesses").select("plan_name,monthly_price,subscription_status,trial_ends_at,grace_period_ends_at").eq("id",business.id).single();
  if(error)throw new Error(`Não foi possível carregar a assinatura: ${error.message}`);
  const trialDays=data.trial_ends_at?Math.max(0,Math.ceil((new Date(data.trial_ends_at).getTime()-Date.now())/86400000)):0;
  return <div className="content"><div className="page-heading"><div><h1>Assinatura</h1><p>Acompanhe o plano, período gratuito e situação da conta.</p></div></div><section className="stats-grid"><div className="card stat-card"><span>Plano atual</span><strong>{data.plan_name}</strong><small className="table-muted">Plano do estabelecimento</small></div><div className="card stat-card"><span>Mensalidade</span><strong>{money(Number(data.monthly_price||0))}</strong><small className="table-muted">Cobrança mensal</small></div><div className="card stat-card"><span>Status</span><strong>{data.subscription_status}</strong><small className="table-muted">Situação da assinatura</small></div><div className="card stat-card"><span>Teste gratuito</span><strong>{trialDays} dias</strong><small className="table-muted">Restantes</small></div></section><section className="card panel" style={{marginTop:16}}><div className="panel-header"><div><h3>Pagamento</h3><p className="table-muted">A estrutura da assinatura já está preparada.</p></div></div><div className="notice-box"><strong>A ativação da cobrança depende da conta do provedor.</strong><p style={{margin:"6px 0 0"}}>Para receber Pix, cartão ou boleto, será necessário conectar Mercado Pago, Asaas ou Stripe e cadastrar as credenciais seguras no ambiente da Vercel.</p></div></section></div>;
}
