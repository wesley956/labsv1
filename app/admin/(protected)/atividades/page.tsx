import { AdminActivityManager, type AdminActivityResult, type ActivityBusiness } from "@/components/admin-activity-manager";
import { requirePlatformAdmin } from "@/lib/supabase/current-admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminActivityPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [activityResponse, businessesResponse] = await Promise.all([
    supabase.rpc("get_admin_activity", { p_business_id: null, p_action: null, p_limit: 50, p_offset: 0 }),
    supabase.rpc("get_admin_businesses", { p_search: null, p_status: null }),
  ]);

  const firstError = activityResponse.error || businessesResponse.error;
  if (firstError) throw new Error(`Não foi possível carregar o histórico administrativo: ${firstError.message}`);

  const initialResult = activityResponse.data as AdminActivityResult;
  const businesses = ((businessesResponse.data ?? []) as Array<{ id: string; name: string }>).map((item) => ({ id: item.id, name: item.name })) as ActivityBusiness[];

  return (
    <div className="admin-content">
      <div className="page-heading">
        <div><h1>Histórico de atividades</h1><p>Consulte alterações de assinatura, pagamentos, contas administrativas e exclusões.</p></div>
      </div>
      <section className="card admin-section" style={{ marginTop: 0 }}>
        <div className="admin-section-header"><div><h3>{initialResult.total} atividade{initialResult.total === 1 ? "" : "s"}</h3><p>Os filtros são aplicados diretamente no histórico preservado pelo banco.</p></div></div>
        <AdminActivityManager initialResult={initialResult} businesses={businesses} />
      </section>
    </div>
  );
}
