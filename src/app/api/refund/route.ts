import { refundCapture } from "@/lib/paypal";
import { getOrders, updateOrder } from "@/lib/store";
import { ok, fail } from "@/lib/api";

// Runs only after the seller clicks "Approve refund" in the UI.
export async function POST(req: Request) {
  try {
    const { orderId, amount, note } = await req.json();
    const order = (await getOrders()).find((o) => o.orderId === orderId);
    if (!order) return fail("Order not found", 404);
    const value = Number(amount);
    // Count earlier refunds so repeated refunds can never add up to more than the buyer paid.
    const left = Number(order.amount) - Number(order.refunded?.amount || 0);
    if (!(value > 0) || value > left) return fail(`Refund must be between $0.01 and $${left.toFixed(2)} (what's left of the order)`, 400);
    const res = await refundCapture(order.captureId, value.toFixed(2), note || "Refund from seller");
    const total = Number(order.refunded?.amount || 0) + value;
    await updateOrder(orderId, { refunded: { amount: total.toFixed(2), at: new Date().toISOString() } });
    return ok({ status: res.status, refundId: res.id });
  } catch (e) {
    return fail(e);
  }
}
