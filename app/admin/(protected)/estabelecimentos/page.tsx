import { AdminBusinessesManager, type AdminBusiness } from "@/components/admin-businesses-manager";
import { requirePlatformAdmin } from "@/lib/supabase/current-admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminBusinessesPage() {
  const admin = await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_businesses", {
    p_search: null,
    p_status: null,
  });

  if (error) throw new Error(`Não foi possível carregar os estabelecimentos: ${error.message}`);

  const items = (data ?? []) as AdminBusiness[];

  return (
    <div className="admin-content">
      <div className="page-heading">
        <div>
          <h1>Estabelecimentos</h1>
          <p>Consulte uso, responsáveis, período gratuito e situação da assinatura.</p>
        </div>
      </div>
      <section className="card admin-section" style={{ marginTop: 0 }}>
        <div className="admin-section-header">
          <div>
            <h3>{items.length} estabelecimento{items.length === 1 ? "" : "s"}</h3>
            <p>Alterações de assinatura são registradas no histórico administrativo.</p>
          </div>
        </div>
        <AdminBusinessesManager initialItems={items} canWrite={admin.role === "super_admin"} />
      </section>
    </div>
  );
}
