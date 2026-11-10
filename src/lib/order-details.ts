// Pull the money breakdown and addresses out of PayPal responses, and backfill older orders.
import { getCapture, getOrder } from "./paypal";
import { updateOrder, type Address, type Order } from "./store";

function addr(a: any): Address | undefined {
  if (!a) return undefined;
  return {
    line1: a.address_line_1,
    line2: a.address_line_2,
    city: a.admin_area_2,
    state: a.admin_area_1,
    postalCode: a.postal_code,
    countryCode: a.country_code,
  };
}

export function breakdownFrom(capture: any): Order["breakdown"] {
  const b = capture?.seller_receivable_breakdown;
  if (!b?.gross_amount) return undefined;
  return {
    gross: b.gross_amount.value,
    fee: b.paypal_fee?.value ?? "0",
    net: b.net_amount?.value ?? b.gross_amount.value,
    currency: b.gross_amount.currency_code,
  };
}

/** Shipping + payer details from an Orders v2 response (create, capture or GET). */
export function partiesFrom(order: any): Pick<Order, "shipTo" | "payer"> {
  const unit = order?.purchase_units?.[0];
  const p = order?.payer || order?.payment_source?.paypal;
  const shipName = unit?.shipping?.name?.full_name;
  const payerName = [p?.name?.given_name, p?.name?.surname].filter(Boolean).join(" ") || undefined;
  return {
    shipTo: unit?.shipping?.address ? { ...addr(unit.shipping.address), name: shipName } : undefined,
    payer: p
      ? {
          name: payerName,
          email: p.email_address,
          countryCode: p.address?.country_code,
          address: addr(p.address),
        }
      : undefined,
  };
}

/** Orders saved before these fields existed get them from PayPal once, then they're stored. */
export async function backfill(o: Order): Promise<Order> {
  const patch: Partial<Order> = {};
  try {
    if (!o.breakdown && o.captureId) patch.breakdown = breakdownFrom(await getCapture(o.captureId));
  } catch (e) {
    console.error("capture lookup failed", o.orderId, e);
  }
  try {
    if (!o.shipTo && !o.payer) Object.assign(patch, partiesFrom(await getOrder(o.orderId)));
  } catch (e) {
    console.error("order lookup failed", o.orderId, e);
  }
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  return Object.keys(clean).length ? updateOrder(o.orderId, clean) : o;
}
