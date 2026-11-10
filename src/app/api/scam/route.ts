import { getOrders, updateOrder } from "@/lib/store";
import { backfill } from "@/lib/order-details";
import { scanOrder } from "@/lib/scam";
import { ok, fail } from "@/lib/api";

// Scam Radar for one order. Optional `message` is anything the buyer sent; it's saved so later checks include it.
export async function POST(req: Request) {
  try {
    const { orderId, message } = await req.json();
    let order = (await getOrders()).find((o) => o.orderId === orderId);
    if (!order) return fail("Order not found", 404);
    order = await backfill(order); // older orders need their addresses from PayPal
    const notes = [order.scamNotes, message].filter(Boolean).join("\n---\n");
    const text = [notes, order.buyerMessage].filter(Boolean).join("\n---\n");
    const scam = await scanOrder(order, text);
    await updateOrder(orderId, { scam, ...(message ? { scamNotes: notes } : {}) });
    return ok(scam);
  } catch (e) {
    return fail(e);
  }
}
