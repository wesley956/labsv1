import { AdminAccountsManager, type AdminAccount } from "@/components/admin-accounts-manager";
import { requirePlatformAdmin } from "@/lib/supabase/current-admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAccountsPage() {
  const admin = await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_accounts");

  if (error) throw new Error(`Não foi possível carregar as contas administrativas: ${error.message}`);

  const items = (data ?? []) as AdminAccount[];

  return (
    <div className="admin-content">
      <div className="page-heading">
        <div><h1>Contas administrativas</h1><p>Controle quem pode consultar ou administrar toda a plataforma.</p></div>
      </div>
      <section className="card admin-section" style={{ marginTop: 0 }}>
        <div className="admin-section-header">
          <div><h3>{items.filter((item) => item.active).length} conta{items.filter((item) => item.active).length === 1 ? "" : "s"} ativa{items.filter((item) => item.active).length === 1 ? "" : "s"}</h3><p>O último superadministrador ativo e a própria conta em uso não podem ser removidos.</p></div>
        </div>
        <AdminAccountsManager initialItems={items} canWrite={admin.role === "super_admin"} />
      </section>
    </div>
  );
}
