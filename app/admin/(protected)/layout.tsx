import Link from "next/link";
import { Brand } from "@/components/brand";
import { AdminSignOutButton } from "@/components/admin-sign-out-button";
import { requirePlatformAdmin } from "@/lib/supabase/current-admin";
import "../admin.css";

const links = [
  ["/admin", "Visão geral"],
  ["/admin/estabelecimentos", "Estabelecimentos"],
  ["/painel", "Abrir painel cliente"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  const roleLabel = admin.role === "super_admin" ? "Superadministrador" : "Suporte";

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand href="/admin" />
        <nav className="admin-nav">
          {links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="admin-sidebar-bottom">
          <small>Conta administrativa</small>
          <strong>{admin.email}</strong>
          <small style={{ marginBottom: 10 }}>{roleLabel}</small>
          <AdminSignOutButton />
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h2>Cruz Agenda ADM</h2>
            <p>Controle central da plataforma e das assinaturas.</p>
          </div>
          <span className="admin-role">{roleLabel}</span>
        </header>
        {children}
      </main>
      <nav className="admin-mobile-nav">
        <Link href="/admin">Resumo</Link>
        <Link href="/admin/estabelecimentos">Clientes</Link>
        <Link href="/painel">Painel</Link>
      </nav>
    </div>
  );
}
