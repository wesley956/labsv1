import { NextRequest, NextResponse } from "next/server";
import {
  isUuid,
  mapMercadoPagoPaymentStatus,
  mercadoPagoRequest,
  validateMercadoPagoWebhookSignature,
  type MercadoPagoAuthorizedPayment,
  type MercadoPagoPayment,
  type MercadoPagoPreapproval,
} from "@/lib/mercado-pago";
import { createAdminClient } from "@/lib/supabase/admin";

type WebhookBody = {
  id?: number | string;
  live_mode?: boolean;
  type?: string;
  action?: string;
  data?: { id?: number | string };
};

function graceDate() {
  return new Date(Date.now() + 7 * 86_400_000).toISOString();
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !accessToken || !serviceRoleKey) {
    return NextResponse.json({ error: "Integração não configurada." }, { status: 503 });
  }

  let body: WebhookBody;
  try {
    body = await request.json() as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const resourceId = String(request.nextUrl.searchParams.get("data.id") ?? body.data?.id ?? "");
  const type = String(request.nextUrl.searchParams.get("type") ?? body.type ?? "");
  const action = String(body.action ?? "");
  const requestId = request.headers.get("x-request-id");

  const validSignature = validateMercadoPagoWebhookSignature({
    xSignature: request.headers.get("x-signature"),
    xRequestId: requestId,
    dataId: resourceId || null,
  });

  if (!validSignature) {
    return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 401 });
  }

  const admin = createAdminClient();
  const eventKey = `${body.id ?? requestId ?? "unknown"}:${type}:${resourceId}:${action}`;
  const { data: event, error: eventError } = await admin
    .from("billing_webhook_events")
    .insert({
      provider: "mercado_pago",
      event_key: eventKey,
      event_type: type,
      action,
      resource_id: resourceId,
      live_mode: body.live_mode ?? null,
      payload: body,
    })
    .select("id")
    .single();

  if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (eventError || !event) {
    console.error("Mercado Pago webhook event storage error", eventError);
    return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 500 });
  }

  async function findBusinessId(preapprovalId: string, externalReference?: unknown) {
    const normalizedReference = externalReference == null ? "" : String(externalReference);
    if (isUuid(normalizedReference)) return normalizedReference;

    const { data } = await admin
      .from("businesses")
      .select("id")
      .eq("mercado_pago_preapproval_id", preapprovalId)
      .maybeSingle();

    return data?.id as string | undefined;
  }

  async function updateBusinessFromPayment(businessId: string, paymentStatus: string) {
    if (paymentStatus === "approved") {
      await admin.from("businesses").update({
        subscription_provider: "mercado_pago",
        subscription_status: "active",
        subscription_grace_ends_at: null,
        mercado_pago_last_synced_at: new Date().toISOString(),
      }).eq("id", businessId);
    } else if (paymentStatus === "rejected") {
      await admin.from("businesses").update({
        subscription_provider: "mercado_pago",
        subscription_status: "past_due",
        subscription_grace_ends_at: graceDate(),
        mercado_pago_last_synced_at: new Date().toISOString(),
      }).eq("id", businessId);
    }
  }

  try {
    if (type === "subscription_preapproval") {
      const subscription = await mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${encodeURIComponent(resourceId)}`);
      const businessId = await findBusinessId(subscription.id, subscription.external_reference);
      if (!businessId) throw new Error("Estabelecimento da assinatura não encontrado.");

      const update: Record<string, unknown> = {
        subscription_provider: "mercado_pago",
        mercado_pago_preapproval_id: subscription.id,
        mercado_pago_subscription_status: subscription.status,
        mercado_pago_payer_email: subscription.payer_email ?? null,
        mercado_pago_init_point: subscription.init_point ?? null,
        mercado_pago_next_payment_at: subscription.next_payment_date ?? null,
        mercado_pago_last_synced_at: new Date().toISOString(),
      };

      if (subscription.status === "authorized") {
        update.subscription_status = "active";
        update.subscription_grace_ends_at = null;
      } else if (subscription.status === "paused") {
        update.subscription_status = "past_due";
        update.subscription_grace_ends_at = graceDate();
      } else if (["cancelled", "canceled"].includes(subscription.status)) {
        update.subscription_status = "cancelled";
        update.subscription_grace_ends_at = null;
      }

      const { error } = await admin.from("businesses").update(update).eq("id", businessId);
      if (error) throw error;
    } else if (type === "subscription_authorized_payment") {
      const invoice = await mercadoPagoRequest<MercadoPagoAuthorizedPayment>(`/authorized_payments/${encodeURIComponent(resourceId)}`);
      const businessId = await findBusinessId(invoice.preapproval_id, invoice.external_reference);
      if (!businessId) throw new Error("Estabelecimento da cobrança recorrente não encontrado.");

      const paymentStatus = mapMercadoPagoPaymentStatus(invoice.payment?.status);
      const providerPaymentId = String(invoice.payment?.id ?? `authorized:${invoice.id}`);
      const { error } = await admin.from("subscription_payments").upsert({
        business_id: businessId,
        provider: "mercado_pago",
        provider_payment_id: providerPaymentId,
        status: paymentStatus,
        amount: Number(invoice.transaction_amount),
        due_at: invoice.debit_date ?? null,
        paid_at: paymentStatus === "approved" ? new Date().toISOString() : null,
        description: "Mensalidade Cruz Agenda",
        metadata: {
          authorized_payment_id: invoice.id,
          preapproval_id: invoice.preapproval_id,
          invoice_status: invoice.status,
          summarized: invoice.summarized,
          payment_status_detail: invoice.payment?.status_detail,
        },
      }, { onConflict: "provider,provider_payment_id" });
      if (error) throw error;

      await updateBusinessFromPayment(businessId, paymentStatus);
    } else if (type === "payment") {
      const payment = await mercadoPagoRequest<MercadoPagoPayment>(`/v1/payments/${encodeURIComponent(resourceId)}`);
      const metadataPreapprovalId = typeof payment.metadata?.preapproval_id === "string"
        ? payment.metadata.preapproval_id
        : "";
      const businessId = isUuid(payment.external_reference)
        ? payment.external_reference
        : metadataPreapprovalId
          ? await findBusinessId(metadataPreapprovalId)
          : undefined;

      if (businessId) {
        const paymentStatus = mapMercadoPagoPaymentStatus(payment.status);
        const { error } = await admin.from("subscription_payments").upsert({
          business_id: businessId,
          provider: "mercado_pago",
          provider_payment_id: String(payment.id),
          status: paymentStatus,
          amount: Number(payment.transaction_amount),
          due_at: payment.date_created ?? null,
          paid_at: paymentStatus === "approved" ? payment.date_approved ?? new Date().toISOString() : null,
          description: payment.description ?? "Mensalidade Cruz Agenda",
          metadata: {
            status_detail: payment.status_detail,
            preapproval_id: metadataPreapprovalId || null,
          },
        }, { onConflict: "provider,provider_payment_id" });
        if (error) throw error;

        await updateBusinessFromPayment(businessId, paymentStatus);
      }
    }

    await admin.from("billing_webhook_events").update({
      processed_at: new Date().toISOString(),
      processing_error: null,
    }).eq("id", event.id);

    return NextResponse.json({ received: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Falha ao processar webhook.";
    console.error("Mercado Pago webhook processing error", cause);
    await admin.from("billing_webhook_events").update({
      processing_error: message.slice(0, 2000),
    }).eq("id", event.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
