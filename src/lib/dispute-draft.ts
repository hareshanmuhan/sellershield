import { getDispute } from "./paypal";
import { askJSON } from "./gemini";
import { getOrders } from "./store";
import { proofSummary } from "./proof";
import { getHealthSnapshot } from "./health-data";

type Draft = {
  recommendation: "fight" | "accept";
  why: string;
  evidenceNotes: string;
  checklist: string[];
};

// AI step: read the dispute + what we know about the order, recommend fight vs accept,
// and write the evidence note. The seller reviews and edits before submitting.
export async function draftDispute(id: string) {
  const d: any = await getDispute(id);
  const txnIds: string[] = (d.disputed_transactions || []).map((t: any) => t.seller_transaction_id);
  const order = (await getOrders()).find((o) => txnIds.includes(o.captureId));
  const amount = d.dispute_amount?.value;
  const { feePerDispute } = await getHealthSnapshot();
  const proof = order ? proofSummary(order) : null;
  const proofText = proof?.goodCount
    ? `${proof.goodCount} packing photo(s) taken ${proof.photos.map((p) => new Date(p.at).toUTCString()).join("; ")}. ` +
      `Together they show: ${[proof.itemShown && "the correct item", proof.labelShown && "a readable label", proof.sealedShown && "the sealed package"].filter(Boolean).join(", ") || "the shipment"}. ` +
      `They will be attached to the evidence. Descriptions: ${proof.photos.map((p) => p.feedback.replace(/^Good proof: /, "")).join(" | ")}`
    : "no packing photos";

  const prompt = `You help a small seller respond to a PayPal dispute.
Dispute: reason=${d.reason}, status=${d.status}, stage=${d.dispute_life_cycle_stage}, amount=$${amount}, seller response due=${d.seller_response_due_date || "unknown"}.
Buyer messages: ${JSON.stringify((d.messages || []).map((m: any) => m.content)).slice(0, 2000)}
Packing photos (Proof Vault): ${proofText}
What the seller's records show: ${order ? JSON.stringify({ item: order.item, paid: order.amount, tracking: order.tracking, refunded: order.refunded, buyerMessage: order.buyerMessage }) : "no matching order in records"}
Rules: losing costs the amount plus a $${feePerDispute} fee. For ITEM_NOT_RECEIVED, tracking showing delivery is the key proof. For UNAUTHORISED, proof the buyer received the item to their PayPal address matters. If the seller has no evidence and the amount is small, accepting may be cheaper.
Return JSON: {"recommendation":"fight|accept","why":"2 short sentences with the money math","evidenceNotes":"clear factual note to PayPal, under 150 words, only facts from the records; if there are packing photos, say when they were taken, what they show, and that they are attached","checklist":["evidence items the seller should attach"]}`;
  const draft = await askJSON<Draft>(prompt);
  return {
    draft,
    dispute: {
      id,
      reason: d.reason,
      status: d.status,
      amount,
      due: d.seller_response_due_date,
      // Only this state accepts new evidence from the seller.
      canSubmit: d.status === "WAITING_FOR_SELLER_RESPONSE",
    },
    tracking: order?.tracking || null,
    proof: proof && { ...proof, photos: proof.photos.map((p) => ({ file: p.file, at: p.at, feedback: p.feedback })) },
    orderId: order?.orderId || null,
    item: order?.item || null,
  };
}
