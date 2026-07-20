import { createHmac, timingSafeEqual } from "node:crypto";

const API_URL = "https://api.mercadopago.com";

export type MercadoPagoPreapproval = {
  id: string;
  external_reference?: string | number | null;
  payer_email?: string | null;
  status: string;
  init_point?: string | null;
  next_payment_date?: string | null;
  auto_recurring?: {
    transaction_amount?: number | string;
    currency_id?: string;
  } | null;
};

export type MercadoPagoAuthorizedPayment = {
  id: number | string;
  preapproval_id: string;
  external_reference?: string | number | null;
  transaction_amount: number | string;
  debit_date?: string | null;
  status?: string | null;
  summarized?: string | null;
  payment?: {
    id?: number | string | null;
    status?: string | null;
    status_detail?: string | null;
  } | null;
};

export type MercadoPagoPayment = {
  id: number | string;
  external_reference?: string | null;
  status: string;
  status_detail?: string | null;
  transaction_amount: number | string;
  date_created?: string | null;
  date_approved?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function isMercadoPagoConfigured() {
  return Boolean(
    process.env.MERCADO_PAGO_ACCESS_TOKEN
      && process.env.MERCADO_PAGO_WEBHOOK_SECRET
      && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function mercadoPagoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Credencial do Mercado Pago não configurada.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

    if (!response.ok) {
      const message = typeof payload?.message === "string"
        ? payload.message
        : `Mercado Pago respondeu com status ${response.status}.`;
      throw new Error(message);
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function validateMercadoPagoWebhookSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret || !input.xSignature || !input.xRequestId || !input.dataId) return false;

  const parts = input.xSignature.split(",").reduce<Record<string, string>>((result, part) => {
    const [key, value] = part.split("=", 2).map((item) => item?.trim());
    if (key && value) result[key] = value;
    return result;
  }, {});

  const timestamp = parts.ts;
  const receivedHash = parts.v1;
  if (!timestamp || !receivedHash) return false;

  const normalizedDataId = input.dataId.toLowerCase();
  const manifest = `id:${normalizedDataId};request-id:${input.xRequestId};ts:${timestamp};`;
  const expectedHash = createHmac("sha256", secret).update(manifest).digest("hex");

  const receivedBuffer = Buffer.from(receivedHash, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function mapMercadoPagoPaymentStatus(status: string | null | undefined) {
  switch (status) {
    case "approved": return "approved";
    case "rejected": return "rejected";
    case "cancelled": return "cancelled";
    case "refunded":
    case "charged_back": return "refunded";
    default: return "pending";
  }
}
