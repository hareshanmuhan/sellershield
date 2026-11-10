import { getOrders } from "@/lib/store";
import { backfill } from "@/lib/order-details";
import { getUsdInr } from "@/lib/fx";
import { earningsFor } from "@/lib/earnings";
import { CURRENCY_LOSS_PERCENT, RATES_AS_OF } from "@/lib/config";
import { ok, fail } from "@/lib/api";

// Real earnings per order: PayPal's fee/net from the capture, then a labelled INR estimate.
export async function GET() {
  try {
    // One at a time: each backfill rewrites data/db.json, so parallel writes could clobber each other.
    const orders = [];
    for (const o of await getOrders()) orders.push(await backfill(o));
    const fx = await getUsdInr();
    return ok({
      fx,
      currencyLossPercent: CURRENCY_LOSS_PERCENT,
      ratesAsOf: RATES_AS_OF,
      orders: Object.fromEntries(orders.map((o) => [o.orderId, earningsFor(o, fx)])),
    });
  } catch (e) {
    return fail(e);
  }
}
