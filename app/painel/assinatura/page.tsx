import { MercadoPagoCancelButton } from "@/components/mercado-pago-cancel-button";
import { MercadoPagoSubscriptionButton } from "@/components/mercado-pago-subscription-button";
import { isMercadoPagoConfigured } from "@/lib/mercado-pago";
import { requireCurrentBusiness, type SubscriptionStatus } from "@/lib/supabase/current-business";
import { createClient } from "@/lib/supabase/server";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
}

function formatDateTime(value: string | null) {
  return value
    ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
}

const statusLabels: Record<SubscriptionStatus, string> = {
  trialing: "Período gratuito",
  active: "Ativa",
  past_due: "Pagamento pendente",
  cancelled: "Cancelada",
  suspended: "Suspensa",
};

const mercadoPagoStatusLabels: Record<string, string> = {
  pending: "Aguardando conclusão",
  authorized: "Autorizada",
  paused: "Pausada",
  cancelled: "Cancelada",
  canceled: "Cancelada",
};

export default async function SubscriptionPage() {
  const business = await requireCurrentBusiness();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("plan_name,monthly_price,subscription_status,trial_started_at,trial_ends_at,subscription_grace_ends_at,subscription_provider,mercado_pago_subscription_status,mercado_pago_payer_email,mercado_pago_next_payment_at,mercado_pago_last_synced_at")
    .eq("id", business.id)
    .single();

  if (error) throw new Error(`Não foi possível carregar a assinatura: ${error.message}`);

  const status = (data.subscription_status ?? "suspended") as SubscriptionStatus;
  const trialDays = data.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(data.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : 0;
  const active = business.subscriptionAccessible;
  const referenceDate = status === "past_due" ? data.subscription_grace_ends_at : data.trial_ends_at;
  const configured = isMercadoPagoConfigured();
  const mercadoPagoStatus = data.mercado_pago_subscription_status
    ? mercadoPagoStatusLabels[data.mercado_pago_subscription_status] ?? data.mercado_pago_subscription_status
    : "Ainda não iniciada";
  const hasAuthorizedSubscription = data.mercado_pago_subscription_status === "authorized";

  return (
    <div className="content">
      <div className="page-heading">
        <div>
          <h1>Assinatura</h1>
          <p>Acompanhe o plano, período gratuito, cobrança e situação da conta.</p>
        </div>
      </div>

      {!active && (
        <div className="notice-box" style={{ marginBottom: 16 }}>
          <strong>O acesso da conta está limitado.</strong>
          <p style={{ margin: "6px 0 0" }}>
            Seus dados permanecem preservados, mas novos agendamentos públicos e as demais áreas do painel ficam indisponíveis até a regularização.
          </p>
        </div>
      )}

      <section className="stats-grid">
        <div className="card stat-card">
          <span>Plano atual</span>
          <strong>{data.plan_name}</strong>
          <small className="table-muted">Plano do estabelecimento</small>
        </div>
        <div className="card stat-card">
          <span>Mensalidade</span>
          <strong>{money(Number(data.monthly_price || 0))}</strong>
          <small className="table-muted">Cobrança mensal</small>
        </div>
        <div className="card stat-card">
          <span>Status</span>
          <strong>{statusLabels[status]}</strong>
          <small className="table-muted">{active ? "Acesso liberado" : "Acesso limitado"}</small>
        </div>
        <div className="card stat-card">
          <span>Teste gratuito</span>
          <strong>{status === "trialing" ? `${trialDays} dias` : "Encerrado"}</strong>
          <small className="table-muted">Término: {formatDate(data.trial_ends_at)}</small>
        </div>
      </section>

      <section className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <div>
            <h3>Pagamento recorrente</h3>
            <p className="table-muted">Assinatura mensal processada com segurança pelo Mercado Pago.</p>
          </div>
          <span className={`badge ${hasAuthorizedSubscription ? "badge-success" : "badge-purple"}`}>
            {mercadoPagoStatus}
          </span>
        </div>

        {!configured ? (
          <div className="notice-box" style={{ marginBottom: 16 }}>
            <strong>O Mercado Pago ainda precisa ser ativado pela Cruz Labs.</strong>
            <p style={{ margin: "6px 0 0" }}>
              A estrutura de checkout e confirmação automática já está instalada, mas as credenciais de produção ainda não foram cadastradas no servidor.
            </p>
          </div>
        ) : hasAuthorizedSubscription ? (
          <div className="notice-box" style={{ marginBottom: 16 }}>
            <strong>Sua assinatura recorrente está autorizada.</strong>
            <p style={{ margin: "6px 0 0" }}>
              Os pagamentos e as renovações serão sincronizados automaticamente com o Cruz Agenda.
            </p>
          </div>
        ) : (
          <div className="notice-box" style={{ marginBottom: 16 }}>
            <strong>Regularize ou ative sua assinatura.</strong>
            <p style={{ margin: "6px 0 0" }}>
              Ao continuar, você será direcionado ao ambiente do Mercado Pago para autorizar a cobrança mensal.
            </p>
          </div>
        )}

        {hasAuthorizedSubscription
          ? <MercadoPagoCancelButton configured={configured} />
          : <MercadoPagoSubscriptionButton configured={configured} />}

        <div className="settings-grid" style={{ marginTop: 22 }}>
          <div className="field">
            <label>Provedor</label>
            <strong>{data.subscription_provider === "mercado_pago" ? "Mercado Pago" : "Controle manual"}</strong>
          </div>
          <div className="field">
            <label>E-mail pagador</label>
            <strong>{data.mercado_pago_payer_email || "Ainda não informado"}</strong>
          </div>
          <div className="field">
            <label>Próxima cobrança</label>
            <strong>{formatDate(data.mercado_pago_next_payment_at)}</strong>
          </div>
          <div className="field">
            <label>Última sincronização</label>
            <strong>{formatDateTime(data.mercado_pago_last_synced_at)}</strong>
          </div>
        </div>

        {referenceDate && (
          <p className="table-muted" style={{ marginTop: 16 }}>
            {status === "past_due" ? "Período de tolerância" : "Fim do período gratuito"}: {formatDate(referenceDate)}.
          </p>
        )}
      </section>
    </div>
  );
}
