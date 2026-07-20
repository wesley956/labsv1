import { Suspense } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { AdminLoginForm } from "@/components/admin-login-form";

export default function AdminLoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow">Cruz Labs · Administração</span>
          <h1>Controle central da plataforma.</h1>
          <p>Acompanhe estabelecimentos, assinaturas, testes gratuitos e indicadores gerais do Cruz Agenda.</p>
        </div>
        <small>Acesso restrito a operadores autorizados da plataforma.</small>
      </section>
      <section className="auth-panel">
        <div className="card auth-card">
          <h2>Painel administrativo</h2>
          <p>Use uma conta autorizada como superadministrador ou suporte.</p>
          <Suspense fallback={<div className="notice-box">Carregando acesso...</div>}>
            <AdminLoginForm />
          </Suspense>
          <p className="form-footer"><Link href="/login">Voltar ao login dos estabelecimentos</Link></p>
        </div>
      </section>
    </main>
  );
}
