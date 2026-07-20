"use client";

import { useState } from "react";

export function MercadoPagoCancelButton({ configured }: { configured: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function cancelSubscription() {
    if (!configured || loading) return;
    const confirmed = window.confirm(
      "Cancelar a assinatura recorrente? O acesso será limitado assim que o cancelamento for confirmado pelo Mercado Pago. Seus dados permanecerão preservados.",
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/billing/mercado-pago/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json() as { cancelled?: boolean; error?: string };

      if (!response.ok || !payload.cancelled) {
        throw new Error(payload.error || "Não foi possível cancelar a assinatura.");
      }

      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cancelar a assinatura.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button button-secondary" disabled={!configured || loading} onClick={() => void cancelSubscription()}>
        {loading ? "Cancelando..." : "Cancelar assinatura"}
      </button>
      {error && <div className="notice-box" role="alert" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
