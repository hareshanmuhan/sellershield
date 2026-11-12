import { askJSON } from "./gemini";
import { getOrders, updateOrder } from "./store";
import { getHealthSnapshot } from "./health-data";
import { refundVsDispute } from "./earnings";

export type Risk = {
  level: "low" | "medium" | "high";
  reason: string;
  suggestedAction: "reply_only" | "partial_refund" | "full_refund" | "reship";
  refundAmount: string; // "0" when no refund suggested
  reply: string;
  cost: ReturnType<typeof refundVsDispute>;
};

// AI step: read an unhappy buyer message and propose a fix BEFORE they open a dispute.
// It only proposes; the seller clicks to approve, and plain code calls the refund API.
export async function assessRisk(orderId: string, message: string): Promise<Risk> {
  const order = (await getOrders()).find((o) => o.orderId === orderId);
  if (!order) throw new Error("Order not found");
  const { feePerDispute } = await getHealthSnapshot();
  const prompt = `You help a small online seller avoid PayPal disputes.
Order: item "${order.item}", paid $${order.amount}, already refunded $${order.refunded?.amount || "0"}, tracking: ${order.tracking ? `${order.tracking.carrier} ${order.tracking.number}` : "none yet"}.
Buyer message: """${String(message).slice(0, 3000)}"""
Judge how likely this buyer is to open a PayPal dispute and suggest the cheapest fair fix.
A dispute costs the seller a $${feePerDispute} fee plus the full order amount if lost, so a small partial refund is often cheaper.
Return JSON: {"level":"low|medium|high","reason":"one short sentence","suggestedAction":"reply_only|partial_refund|full_refund|reship","refundAmount":"number as string, never more than ${order.amount}, '0' if none","reply":"friendly short reply to the buyer, under 80 words. The seller hasn't approved anything yet, so offer the fix ('I'd like to offer...'), never say a refund or reshipment already happened"}`;
  const risk = await askJSON<Omit<Risk, "cost">>(prompt);
  // Safety: never let the model suggest more than is still refundable.
  const left = Number(order.amount) - Number(order.refunded?.amount || 0);
  if (!(Number(risk.refundAmount) >= 0)) risk.refundAmount = "0";
  if (Number(risk.refundAmount) > left) risk.refundAmount = left.toFixed(2);
  await updateOrder(orderId, { buyerMessage: message, risk: { level: risk.level, reason: risk.reason } });
  // Plain-code money math: what the refund really costs vs. losing a dispute.
  return { ...risk, cost: refundVsDispute(order, Number(risk.refundAmount) || 0, feePerDispute) };
}
