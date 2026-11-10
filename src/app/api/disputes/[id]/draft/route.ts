import { getDispute } from "@/lib/paypal";
import { askJSON } from "@/lib/gemini";
import { getOrders } from "@/lib/store";
import { ok, fail } from "@/lib/api";

type Draft = {
  recommendation: "fight" | "accept";
  why: string;
  evidenceNotes: string;
  checklist: string[];
};

// AI step: read the dispute + what we know about the order, recommend fight vs accept,
// and write the evidence note. The seller reviews and edits before submitting.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const d: any = await getDispute(id);
    const txnIds: string[] = (d.disputed_transactions || []).map((t: any) => t.seller_transaction_id);
    const orders = await getOrders();
    const order = orders.find((o) => txnIds.includes(o.captureId));
    const amount = d.dispute_amount?.value;

    const prompt = `You help a small seller respond to a PayPal dispute.
Dispute: reason=${d.reason}, status=${d.status}, stage=${d.dispute_life_cycle_stage}, amount=$${amount}, seller response due=${d.seller_response_due_date || "unknown"}.
Buyer messages: ${JSON.stringify((d.messages || []).map((m: any) => m.content)).slice(0, 2000)}
What the seller's records show: ${order ? JSON.stringify({ item: order.item, paid: order.amount, tracking: order.tracking, refunded: order.refunded, buyerMessage: order.buyerMessage }) : "no matching order in records"}
Rules: losing costs the amount plus a $15 fee. For ITEM_NOT_RECEIVED, tracking showing delivery is the key proof. For UNAUTHORISED, proof the buyer received the item to their PayPal address matters. If the seller has no evidence and the amount is small, accepting may be cheaper.
Return JSON: {"recommendation":"fight|accept","why":"2 short sentences with the money math","evidenceNotes":"clear factual note to PayPal, under 150 words, only facts from the records","checklist":["evidence items the seller should attach"]}`;
    const draft = await askJSON<Draft>(prompt);
    return ok({
      draft,
      dispute: { id, reason: d.reason, status: d.status, amount, due: d.seller_response_due_date },
      tracking: order?.tracking || null,
    });
  } catch (e) {
    return fail(e);
  }
}
