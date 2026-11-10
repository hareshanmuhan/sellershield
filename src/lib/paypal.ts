// Thin PayPal REST client (sandbox). Only server code imports this file.
const BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

let cached: { token: string; expires: number } | null = null;

async function getToken(): Promise<string> {
  if (cached && Date.now() < cached.expires) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing in .env.local");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cached = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cached.token;
}

export async function pp<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const isForm = init.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    // PayPal's top-level message is generic; the real cause is usually in details[].issue.
    const issues = (data?.details || []).map((d: any) => d.issue || d.description).filter(Boolean).join(", ");
    const msg = [data?.message || text, issues].filter(Boolean).join(" ");
    throw new Error(`PayPal ${init.method || "GET"} ${path} -> ${res.status}: ${msg}`);
  }
  return data as T;
}

// ---------- Orders ----------
export function createOrder(amount: string, description: string) {
  return pp("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: amount }, description }],
    }),
  });
}

export function captureOrder(orderId: string) {
  return pp(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", body: "{}" });
}

export function addTracking(orderId: string, captureId: string, carrier: string, trackingNumber: string) {
  const known = ["UPS", "USPS", "FEDEX", "DHL", "DHL_API", "ONTRAC", "LASERSHIP"];
  const upper = carrier.toUpperCase().replace(/\s+/g, "_");
  const body: Record<string, unknown> = {
    capture_id: captureId,
    tracking_number: trackingNumber,
    notify_payer: false,
    carrier: known.includes(upper) ? upper : "OTHER",
  };
  if (body.carrier === "OTHER") body.carrier_name_other = carrier;
  return pp(`/v2/checkout/orders/${orderId}/track`, { method: "POST", body: JSON.stringify(body) });
}

export function getOrder(orderId: string) {
  return pp(`/v2/checkout/orders/${orderId}`);
}

export function getCapture(captureId: string) {
  return pp(`/v2/payments/captures/${captureId}`);
}

// ---------- Refunds ----------
export function refundCapture(captureId: string, amount: string, note: string) {
  return pp(`/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    body: JSON.stringify({ amount: { value: amount, currency_code: "USD" }, note_to_payer: note.slice(0, 255) }),
  });
}

// ---------- Disputes ----------
export function listDisputes() {
  const start = new Date(Date.now() - 90 * 86400000).toISOString();
  return pp<{ items?: any[] }>(`/v1/customer/disputes?start_time=${encodeURIComponent(start)}&page_size=50`);
}

export function getDispute(id: string) {
  return pp(`/v1/customer/disputes/${id}`);
}

export function provideEvidence(id: string, notes: string, tracking?: { carrier: string; number: string }) {
  const evidence: Record<string, unknown> = {
    evidence_type: tracking ? "PROOF_OF_FULFILLMENT" : "OTHER",
    notes: notes.slice(0, 2000),
  };
  if (tracking) {
    evidence.evidence_info = { tracking_info: [{ carrier_name: tracking.carrier, tracking_number: tracking.number }] };
  }
  const form = new FormData();
  form.append("input", new Blob([JSON.stringify({ evidences: [evidence] })], { type: "application/json" }));
  return pp(`/v1/customer/disputes/${id}/provide-evidence`, { method: "POST", body: form });
}

export function acceptClaim(id: string, note: string) {
  return pp(`/v1/customer/disputes/${id}/accept-claim`, {
    method: "POST",
    body: JSON.stringify({ note: note.slice(0, 2000) }),
  });
}

// ---------- Webhooks ----------
export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return true; // verification skipped when no webhook id is configured
  const res = await pp<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  return res.verification_status === "SUCCESS";
}
