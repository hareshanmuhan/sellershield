import { captureOrder } from "@/lib/paypal";
import { addOrder } from "@/lib/store";
import { breakdownFrom, partiesFrom } from "@/lib/order-details";
import { ok, fail } from "@/lib/api";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { item } = await req.json().catch(() => ({ item: "Item" }));
    const result = await captureOrder(id);
    const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
    await addOrder({
      orderId: id,
      captureId: capture?.id,
      amount: capture?.amount?.value,
      item,
      buyerEmail: result.payer?.email_address,
      createdAt: new Date().toISOString(),
      // PayPal's real fee and net for this sale, plus addresses for Scam Radar.
      breakdown: breakdownFrom(capture),
      ...partiesFrom(result),
    });
    return ok({ status: result.status, captureId: capture?.id });
  } catch (e) {
    return fail(e);
  }
}
