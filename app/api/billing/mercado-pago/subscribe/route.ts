import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isMercadoPagoConfigured, mercadoPagoRequest, type MercadoPagoPreapproval } from "@/lib/mercado-pago";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    if (!isMercadoPagoConfigured()) {
      return NextResponse.json(
        { error: "O Mercado Pago ainda não foi configurado pelo administrador da plataforma." },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

    const { data: membership, error: membershipError } = await supabase
      .from("business_members")
      .select("business_id,role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) return NextResponse.json({ error: "Estabelecimento não encontrado." }, { status: 404 });
    if (!(["owner", "admin"] as string[]).includes(membership.role)) {
      return NextResponse.json({ error: "Somente o proprietário ou administrador pode contratar o plano." }, { status: 403 });
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id,name,plan_name,monthly_price,mercado_pago_preapproval_id,mercado_pago_subscription_status,mercado_pago_init_point")
      .eq("id", membership.business_id)
      .single();

    if (businessError) throw businessError;
    if (!user.email) return NextResponse.json({ error: "Sua conta precisa ter um e-mail válido." }, { status: 400 });

    if (business.mercado_pago_subscription_status === "authorized") {
      return NextResponse.json({ error: "Este estabelecimento já possui uma assinatura ativa." }, { status: 409 });
    }

    if (business.mercado_pago_subscription_status === "pending" && business.mercado_pago_init_point) {
      return NextResponse.json({ checkoutUrl: business.mercado_pago_init_point, reused: true });
    }

    const amount = Number(business.monthly_price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "A mensalidade configurada é inválida." }, { status: 400 });
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, "");
    const preapproval = await mercadoPagoRequest<MercadoPagoPreapproval>("/preapproval", {
      method: "POST",
      headers: { "X-Idempotency-Key": randomUUID() },
      body: JSON.stringify({
        reason: `Cruz Agenda - ${business.plan_name}`,
        external_reference: business.id,
        payer_email: user.email,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "BRL",
        },
        back_url: `${siteUrl}/painel/assinatura?retorno=mercado-pago`,
        status: "pending",
      }),
    });

    if (!preapproval.id || !preapproval.init_point) {
      throw new Error("O Mercado Pago não retornou o link da assinatura.");
    }

    const admin = createAdminClient();
    const { error: saveError } = await admin
      .from("businesses")
      .update({
        subscription_provider: "mercado_pago",
        mercado_pago_preapproval_id: preapproval.id,
        mercado_pago_subscription_status: preapproval.status,
        mercado_pago_payer_email: user.email,
        mercado_pago_init_point: preapproval.init_point,
        mercado_pago_next_payment_at: preapproval.next_payment_date ?? null,
        mercado_pago_last_synced_at: new Date().toISOString(),
      })
      .eq("id", business.id);

    if (saveError) throw saveError;

    return NextResponse.json({ checkoutUrl: preapproval.init_point, reused: false });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Não foi possível iniciar a assinatura.";
    console.error("Mercado Pago subscription checkout error", cause);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
