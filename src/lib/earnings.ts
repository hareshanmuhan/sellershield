// Per-order money math. Plain code, no AI.
import {
  ASSUMED_TRANSIT_DAYS,
  CURRENCY_LOSS_PERCENT,
  HOLD_DAYS_NO_TRACKING,
  PAYPAL_FEE_ESTIMATE,
  RATES_AS_OF,
  REFUND_RETURNS_FEE,
  RELEASE_DAYS_AFTER_DELIVERY,
} from "./config";
import type { FxRate } from "./fx";
import type { Order } from "./store";

const r2 = (n: number) => Math.round(n * 100) / 100;
const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();

export type Earnings = {
  orderId: string;
  buyerPaid: number;
  paypalFee: number;
  feeSource: "PayPal" | "estimate";
  net: number;
  refunded: number;
  /** What you actually keep in USD after refunds (PayPal keeps its fee). */
  kept: number;
  currencyLoss: number;
  inrEstimate: number | null;
  fx: FxRate | null;
  ratesAsOf: string;
  expected: MoneyExpected;
};

export type MoneyExpected = {
  /** ISO date, or null when there's nothing left to release. */
  by: string | null;
  rule: string;
  kind: "hold" | "after_delivery" | "none";
};

export function estimateFee(gross: number) {
  return r2(gross * PAYPAL_FEE_ESTIMATE.percent + PAYPAL_FEE_ESTIMATE.fixedUsd);
}

export function feeFor(o: Order) {
  const gross = Number(o.amount);
  if (o.breakdown?.fee != null) return { fee: Number(o.breakdown.fee), source: "PayPal" as const };
  return { fee: estimateFee(gross), source: "estimate" as const };
}

export function moneyExpected(o: Order): MoneyExpected {
  const refunded = Number(o.refunded?.amount || 0);
  if (refunded >= Number(o.amount)) return { by: null, rule: "Fully refunded, so nothing is coming.", kind: "none" };
  if (o.tracking) {
    const delivered = addDays(o.tracking.addedAt || o.createdAt, ASSUMED_TRANSIT_DAYS);
    return {
      by: addDays(delivered, RELEASE_DAYS_AFTER_DELIVERY),
      rule: `Tracking is added, so PayPal usually releases it about ${RELEASE_DAYS_AFTER_DELIVERY} day after delivery. We assume delivery ${ASSUMED_TRANSIT_DAYS} days after you added tracking.`,
      kind: "after_delivery",
    };
  }
  return {
    by: addDays(o.createdAt, HOLD_DAYS_NO_TRACKING),
    rule: `No tracking yet, so PayPal can hold it for up to ${HOLD_DAYS_NO_TRACKING} days. Add tracking to get it about ${RELEASE_DAYS_AFTER_DELIVERY} day after delivery.`,
    kind: "hold",
  };
}

export function earningsFor(o: Order, fx: FxRate | null): Earnings {
  const buyerPaid = Number(o.amount);
  const { fee, source } = feeFor(o);
  const net = r2(o.breakdown?.net != null ? Number(o.breakdown.net) : buyerPaid - fee);
  const refunded = Number(o.refunded?.amount || 0);
  const kept = r2(net - refunded + (REFUND_RETURNS_FEE ? (fee * refunded) / buyerPaid : 0));
  const currencyLoss = r2(Math.max(0, kept) * CURRENCY_LOSS_PERCENT);
  const inrEstimate = fx ? Math.round((Math.max(0, kept) - currencyLoss) * fx.rate) : null;
  return {
    orderId: o.orderId,
    buyerPaid,
    paypalFee: fee,
    feeSource: source,
    net,
    refunded,
    kept,
    currencyLoss,
    inrEstimate,
    fx,
    ratesAsOf: RATES_AS_OF,
    expected: moneyExpected(o),
  };
}

/** True cost of a refund now vs. losing a dispute later. */
export function refundVsDispute(o: Order, refundAmount: number, disputeFee: number) {
  const { fee } = feeFor(o);
  const gross = Number(o.amount);
  const alreadyRefunded = Number(o.refunded?.amount || 0);
  const net = r2(gross - fee);
  const keepAfterRefund = r2(net - alreadyRefunded - refundAmount);
  // Lose the dispute: the buyer gets back everything still unrefunded, you pay the dispute fee, PayPal keeps its fee.
  const keepAfterLostDispute = r2(net - gross - disputeFee);
  return {
    refundAmount: r2(refundAmount),
    paypalFeeKept: fee,
    disputeFee,
    keepAfterRefund,
    keepAfterLostDispute,
    savedByRefunding: r2(keepAfterRefund - keepAfterLostDispute),
  };
}
