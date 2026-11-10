import { askJSON } from "@/lib/gemini";
import { getOrders, getEvents } from "@/lib/store";
import { listDisputes } from "@/lib/paypal";
import { ok, fail } from "@/lib/api";

type Action =
  | { type: "add_tracking"; orderId: string; carrier: string; trackingNumber: string }
  | { type: "refund"; orderId: string; amount: string; note?: string }
  | { type: "open"; tab: "orders" | "shipping" | "buyers" | "disputes"; orderId?: string; label?: string };

const TABS = ["orders", "shipping", "buyers", "disputes"];

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `sold ${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `sold ${h} hours ago` : `sold ${Math.round(h / 24)} days ago`;
}

// "Ask SellerShield": answers in plain language using the seller's real PayPal data,
// and may PROPOSE actions. Proposals are only shown as confirm cards; nothing runs here.
export async function POST(req: Request) {
  try {
    const { question, health, history } = await req.json();
    const [orders, events] = await Promise.all([getOrders(), getEvents()]);
    let disputes: any[] = [];
    try {
      disputes = (await listDisputes()).items || [];
    } catch {}
    const past = Array.isArray(history)
      ? history
          .slice(-6)
          .map((m: any) => `${m.role === "user" ? "Seller" : "You"}: ${String(m.text).slice(0, 500)}`)
          .join("\n")
      : "";
    const prompt = `You are SellerShield, an assistant that keeps a small seller's PayPal money flowing.
Explain things simply, like to someone with no finance background. Be short (under 90 words) and give one concrete next step.
PayPal facts: risk holds usually last up to 21 days and can be released about a day after tracking shows delivery; dispute fee is $15, or $30 once the dispute rate is 1.5%+ with over 100 sales in 3 months; response time is 10 days, or 3 days for high-dispute sellers.
You can PROPOSE actions. They only happen after the seller taps a confirm button under your answer, so NEVER write that you added, refunded or sent anything. Say what you can do and ask them to confirm, e.g. "I can add this FedEx number to your wallet order. Tap Add tracking below to send it to PayPal." Allowed actions:
- {"type":"add_tracking","orderId","carrier","trackingNumber"}: only when the seller gave you a real tracking number in this chat.
- {"type":"refund","orderId","amount","note"}: only when the seller asks to refund or agrees to it. amount must not exceed what was paid minus what was already refunded.
- {"type":"open","tab":"shipping|buyers|disputes|orders","orderId","label"}: to take the seller to the right screen. label is a short button text like "Add tracking for the mug".
Propose at most 2 actions, and none if the question is just informational.
Orders are listed newest first. Several orders can share an item name: "new", "latest" or "just sold" means the newest one. If it's still unclear which order the seller means, ask instead of proposing.
The confirm buttons are labelled "Add tracking" and "Review refund", so refer to those names.
Account health: ${JSON.stringify(health)}
Orders, newest first: ${JSON.stringify(
      orders.slice(0, 30).map((o, i) => ({
        orderId: o.orderId,
        item: o.item,
        paid: o.amount,
        alreadyRefunded: o.refunded?.amount || "0",
        tracking: o.tracking ? `${o.tracking.carrier} ${o.tracking.number}` : "none",
        sold: i === 0 ? `newest order, ${ago(o.createdAt)}` : ago(o.createdAt),
        buyerMessage: o.buyerMessage,
        buyerMood: o.risk?.level,
      }))
    )}
Disputes: ${JSON.stringify(disputes.map((d) => ({ id: d.dispute_id, reason: d.reason, status: d.status, amount: d.dispute_amount })))}
Recent events: ${JSON.stringify(events.slice(0, 10))}
Conversation so far:
${past}
Seller: """${String(question).slice(0, 1000)}"""
Return JSON: {"answer":"...","actions":[...]}`;

    const out = await askJSON<{ answer: string; actions?: Action[] }>(prompt);

    // Plain-code safety net: drop anything that doesn't match a real order or a legal amount.
    const byId = new Map(orders.map((o) => [o.orderId, o]));
    const actions = (Array.isArray(out.actions) ? out.actions : [])
      .filter((a: any) => {
        if (a?.type === "add_tracking") {
          const o = byId.get(a.orderId);
          return !!o && !o.tracking && !!a.carrier && !!a.trackingNumber;
        }
        if (a?.type === "refund") {
          const o = byId.get(a.orderId);
          if (!o) return false;
          const left = Number(o.amount) - Number(o.refunded?.amount || 0);
          const n = Number(a.amount);
          return n > 0 && n <= left;
        }
        if (a?.type === "open") return TABS.includes(a.tab) && (!a.orderId || byId.has(a.orderId));
        return false;
      })
      .slice(0, 2)
      .map((a: any) => ({ ...a, item: byId.get(a.orderId)?.item, soldAt: byId.get(a.orderId)?.createdAt }));

    return ok({ answer: out.answer, actions });
  } catch (e) {
    return fail(e);
  }
}
