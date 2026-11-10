import { askJSON } from "@/lib/gemini";
import { getOrders, updateOrder } from "@/lib/store";
import { ok, fail } from "@/lib/api";

type Risk = {
  level: "low" | "medium" | "high";
  reason: string;
  suggestedAction: "reply_only" | "partial_refund" | "full_refund" | "reship";
  refundAmount: string; // "0" when no refund suggested
  reply: string;
};

// AI step: read an unhappy buyer message and propose a fix BEFORE they open a dispute.
// It only proposes; the seller clicks to approve, and plain code calls the refund API.
export async function POST(req: Request) {
  try {
    const { orderId, message } = await req.json();
    const order = (await getOrders()).find((o) => o.orderId === orderId);
    if (!order) return fail("Order not found", 404);
    const prompt = `You help a small online seller avoid PayPal disputes.
Order: item "${order.item}", paid $${order.amount}, tracking: ${order.tracking ? `${order.tracking.carrier} ${order.tracking.number}` : "none yet"}.
Buyer message: """${String(message).slice(0, 3000)}"""
Judge how likely this buyer is to open a PayPal dispute and suggest the cheapest fair fix.
A dispute costs the seller a $15 fee plus the full order amount if lost, so a small partial refund is often cheaper.
Return JSON: {"level":"low|medium|high","reason":"one short sentence","suggestedAction":"reply_only|partial_refund|full_refund|reship","refundAmount":"number as string, never more than ${order.amount}, '0' if none","reply":"friendly short reply to the buyer, under 80 words. The seller hasn't approved anything yet, so offer the fix ('I'd like to offer...'), never say a refund or reshipment already happened"}`;
    const risk = await askJSON<Risk>(prompt);
    // Safety: never let the model suggest more than was paid.
    const max = Number(order.amount);
    if (Number(risk.refundAmount) > max) risk.refundAmount = order.amount;
    await updateOrder(orderId, { buyerMessage: message, risk: { level: risk.level, reason: risk.reason } });
    return ok(risk);
  } catch (e) {
    return fail(e);
  }
}
