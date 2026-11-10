import { addTracking } from "@/lib/paypal";
import { getOrders, updateOrder } from "@/lib/store";
import { ok, fail } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const { orderId, carrier, trackingNumber } = await req.json();
    if (!orderId || !carrier || !trackingNumber) return fail("orderId, carrier and trackingNumber are required", 400);
    const order = (await getOrders()).find((o) => o.orderId === orderId);
    if (!order) return fail("Order not found", 404);
    const res = await addTracking(orderId, order.captureId, carrier, trackingNumber);
    await updateOrder(orderId, { tracking: { carrier, number: trackingNumber, addedAt: new Date().toISOString() } });
    return ok({ paypal: res.status || "TRACKING_ADDED" });
  } catch (e) {
    return fail(e);
  }
}
