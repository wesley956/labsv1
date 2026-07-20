import { NextResponse } from "next/server";
import { isMercadoPagoConfigured, mercadoPagoRequest, type MercadoPagoPreapproval } from "@/lib/mercado-pago";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
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
      return NextResponse.json({ error: "Somente o proprietário ou administrador pode cancelar o plano." }, { status: 403 });
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id,mercado_pago_preapproval_id,mercado_pago_subscription_status")
      .eq("id", membership.business_id)
      .single();

    if (businessError) throw businessError;
    if (!business.mercado_pago_preapproval_id) {
      return NextResponse.json({ error: "Nenhuma assinatura do Mercado Pago foi encontrada." }, { status: 404 });
    }

    if (["cancelled", "canceled"].includes(business.mercado_pago_subscription_status ?? "")) {
      return NextResponse.json({ cancelled: true, alreadyCancelled: true });
    }

    const subscription = await mercadoPagoRequest<MercadoPagoPreapproval>(
      `/preapproval/${encodeURIComponent(business.mercado_pago_preapproval_id)}`,
      {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      },
    );

    const admin = createAdminClient();
    const { error: saveError } = await admin
      .from("businesses")
      .update({
        subscription_provider: "mercado_pago",
        subscription_status: "cancelled",
        subscription_grace_ends_at: null,
        mercado_pago_subscription_status: subscription.status || "cancelled",
        mercado_pago_next_payment_at: subscription.next_payment_date ?? null,
        mercado_pago_last_synced_at: new Date().toISOString(),
      })
      .eq("id", business.id);

    if (saveError) throw saveError;

    return NextResponse.json({ cancelled: true, alreadyCancelled: false });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Não foi possível cancelar a assinatura.";
    console.error("Mercado Pago subscription cancellation error", cause);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
