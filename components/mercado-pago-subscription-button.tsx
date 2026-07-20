"use client";

import { useState } from "react";

export function MercadoPagoSubscriptionButton({ configured }: { configured: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function subscribe() {
    if (!configured || loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/billing/mercado-pago/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json() as { checkoutUrl?: string; error?: string };

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "Não foi possível abrir o pagamento.");
      }

      window.location.assign(payload.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir o pagamento.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button button-primary" disabled={!configured || loading} onClick={() => void subscribe()}>
        {loading ? "Abrindo Mercado Pago..." : configured ? "Assinar pelo Mercado Pago" : "Mercado Pago não configurado"}
      </button>
      {error && <div className="notice-box" role="alert" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
