import { requireCurrentBusiness, type SubscriptionStatus } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";

function money(value:number){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);}
function formatDate(value:string|null){return value?new Date(value).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"}):"—";}

const statusLabels:Record<SubscriptionStatus,string>={
  trialing:"Período gratuito",
  active:"Ativa",
  past_due:"Pagamento pendente",
  cancelled:"Cancelada",
  suspended:"Suspensa",
};

export default async function SubscriptionPage(){
  const business=await requireCurrentBusiness();
  const supabase=await createClient();
  const{data,error}=await supabase.from("businesses").select("plan_name,monthly_price,subscription_status,trial_started_at,trial_ends_at,subscription_grace_ends_at").eq("id",business.id).single();
  if(error)throw new Error(`Não foi possível carregar a assinatura: ${error.message}`);

  const status=(data.subscription_status??"suspended") as SubscriptionStatus;
  const trialDays=data.trial_ends_at?Math.max(0,Math.ceil((new Date(data.trial_ends_at).getTime()-Date.now())/86400000)):0;
  const active=business.subscriptionAccessible;
  const referenceDate=status==="past_due"?data.subscription_grace_ends_at:data.trial_ends_at;

  return <div className="content"><div className="page-heading"><div><h1>Assinatura</h1><p>Acompanhe o plano, período gratuito e situação da conta.</p></div></div>{!active&&<div className="notice-box" style={{marginBottom:16}}><strong>O acesso da conta está limitado.</strong><p style={{margin:"6px 0 0"}}>Seus dados permanecem preservados, mas novos agendamentos públicos e as demais áreas do painel ficam indisponíveis até a regularização.</p></div>}<section className="stats-grid"><div className="card stat-card"><span>Plano atual</span><strong>{data.plan_name}</strong><small className="table-muted">Plano do estabelecimento</small></div><div className="card stat-card"><span>Mensalidade</span><strong>{money(Number(data.monthly_price||0))}</strong><small className="table-muted">Cobrança mensal</small></div><div className="card stat-card"><span>Status</span><strong>{statusLabels[status]}</strong><small className="table-muted">{active?"Acesso liberado":"Acesso limitado"}</small></div><div className="card stat-card"><span>Teste gratuito</span><strong>{status==="trialing"?`${trialDays} dias`:"Encerrado"}</strong><small className="table-muted">Término: {formatDate(data.trial_ends_at)}</small></div></section><section className="card panel" style={{marginTop:16}}><div className="panel-header"><div><h3>Pagamento</h3><p className="table-muted">A estrutura da assinatura está preparada para a integração.</p></div></div><div className="notice-box"><strong>A cobrança automática depende da conexão com o Mercado Pago.</strong><p style={{margin:"6px 0 0"}}>Após conectar as credenciais, esta página exibirá vencimentos, pagamentos, renovação e regularização da assinatura.</p></div>{referenceDate&&<p className="table-muted" style={{marginTop:16}}>{status==="past_due"?"Período de tolerância":"Fim do período gratuito"}: {formatDate(referenceDate)}.</p>}</section></div>;
}
