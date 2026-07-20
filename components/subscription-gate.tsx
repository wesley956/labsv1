"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SubscriptionStatus } from "@/lib/supabase/current-business";

const statusLabels: Record<SubscriptionStatus, string> = {
  trialing: "Período gratuito encerrado",
  active: "Assinatura ativa",
  past_due: "Pagamento pendente",
  cancelled: "Assinatura cancelada",
  suspended: "Conta suspensa",
};

export function SubscriptionGate({
  accessible,
  status,
  trialEndsAt,
  graceEndsAt,
  children,
}: {
  accessible: boolean;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (accessible || pathname === "/painel/assinatura") return children;

  const referenceDate = status === "trialing" ? trialEndsAt : graceEndsAt;

  return (
    <div className="content">
      <section className="card panel" style={{ maxWidth: 720, margin: "40px auto", textAlign: "center", padding: "clamp(28px,6vw,54px)" }}>
        <span className="eyebrow">Acesso limitado</span>
        <h1 style={{ marginBottom: 12 }}>{statusLabels[status]}</h1>
        <p className="table-muted" style={{ maxWidth: 560, margin: "0 auto 20px" }}>
          Os dados e agendamentos existentes continuam preservados. Para voltar a usar o painel e receber novos agendamentos públicos, regularize a assinatura.
        </p>
        {referenceDate && <p style={{ marginBottom: 22 }}>Prazo encerrado em <strong>{new Date(referenceDate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong>.</p>}
        <Link className="button button-primary" href="/painel/assinatura">Ver situação da assinatura</Link>
      </section>
    </div>
  );
}
