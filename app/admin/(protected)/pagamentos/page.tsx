import { AdminPaymentsManager, type AdminPayment, type PaymentBusiness } from "@/components/admin-payments-manager";
import { requirePlatformAdmin } from "@/lib/supabase/current-admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const admin = await requirePlatformAdmin();
  const { business = "" } = await searchParams;
  const supabase = await createClient();

  const [paymentsResponse, businessesResponse] = await Promise.all([
    supabase.rpc("get_admin_payments", { p_business_id: null, p_status: null, p_limit: 300 }),
    supabase.rpc("get_admin_businesses", { p_search: null, p_status: null }),
  ]);

  const firstError = paymentsResponse.error || businessesResponse.error;
  if (firstError) throw new Error(`Não foi possível carregar os pagamentos: ${firstError.message}`);

  const payments = (paymentsResponse.data ?? []) as AdminPayment[];
  const businesses = ((businessesResponse.data ?? []) as Array<PaymentBusiness & { id: string }>).map((item) => ({
    id: item.id,
    name: item.name,
    owner_email: item.owner_email,
    monthly_price: item.monthly_price,
    subscription_status: item.subscription_status,
  }));

  return (
    <div className="admin-content">
      <div className="page-heading">
        <div><h1>Pagamentos</h1><p>Registre cobranças, baixas e vencimentos enquanto a integração automática é preparada.</p></div>
      </div>
      <section className="card admin-section" style={{ marginTop: 0 }}>
        <AdminPaymentsManager initialItems={payments} businesses={businesses} canWrite={admin.role === "super_admin"} initialBusinessId={business} />
      </section>
    </div>
  );
}
