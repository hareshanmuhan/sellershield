import { captureOrder } from "@/lib/paypal";
import { addOrder } from "@/lib/store";
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
    });
    return ok({ status: result.status, captureId: capture?.id });
  } catch (e) {
    return fail(e);
  }
}
