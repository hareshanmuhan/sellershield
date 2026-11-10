import { askJSON } from "@/lib/gemini";
import { getOrders } from "@/lib/store";
import { ok, fail } from "@/lib/api";

type Extracted = {
  carrier: string;
  trackingNumber: string;
  orderHint: string;
  matchedOrderId: string | null;
  confidence: number;
};

// AI step: read a messy shipping email / label screenshot and pull out carrier + tracking number,
// then guess which open order it belongs to. The seller confirms before anything is sent to PayPal.
export async function POST(req: Request) {
  try {
    const { text, image } = await req.json();
    const open = (await getOrders()).filter((o) => !o.tracking);
    const prompt = `You extract shipment tracking details for an online seller.
From the shipping email text or label image, return JSON:
{"carrier": "UPS|USPS|FEDEX|DHL|<other carrier name>", "trackingNumber": "...", "orderHint": "buyer name, item or order ref you saw", "matchedOrderId": "<orderId from list or null>", "confidence": 0-1}
Open orders without tracking: ${JSON.stringify(open.map((o) => ({ orderId: o.orderId, item: o.item, amount: o.amount, buyer: o.buyerEmail })))}
Only use a tracking number that actually appears in the input. If none, return trackingNumber "".
Input text:
"""${(text || "").slice(0, 6000)}"""`;
    const result = await askJSON<Extracted>(prompt, image);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
