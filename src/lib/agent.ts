// The chat agent: Gemini function calling over SellerShield's tools.
// Read-only tools run right away. Anything that moves money or writes to PayPal is NOT run here:
// it becomes a pending action the seller must confirm with a click, and plain code validates it first.
import { generateWithTools, type FunctionDeclaration, type GeminiContent } from "./gemini";
import { getOrders, type Order } from "./store";
import { listDisputes } from "./paypal";
import { getHealthSnapshot } from "./health-data";
import { getUsdInr } from "./fx";
import { earningsFor } from "./earnings";
import { assessRisk } from "./risk";
import { scanOrder } from "./scam";
import { backfill } from "./order-details";
import { draftDispute } from "./dispute-draft";
import { updateOrder } from "./store";

export type Step = { tool: string; label: string; status: "done" | "needs_confirm" | "error"; detail?: string };
export type PendingAction =
  | { type: "add_tracking"; orderId: string; item: string; soldAt: string; carrier: string; trackingNumber: string }
  | { type: "refund"; orderId: string; item: string; soldAt: string; amount: string; note: string; keepAfterRefund?: number }
  | { type: "submit_evidence"; disputeId: string; item?: string; notes: string; tracking: { carrier: string; number: string } | null; photos: number };

const S = (description: string) => ({ type: "STRING", description });
const N = (description: string) => ({ type: "NUMBER", description });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "OBJECT", properties, required });

const TOOLS: FunctionDeclaration[] = [
  {
    name: "get_earnings",
    description: "Real money for one order or all orders: buyer paid, PayPal fee, what the seller keeps, rupee estimate, and when the money is expected.",
    parameters: obj({ orderId: S("Order id. Leave empty for all orders.") }),
  },
  {
    name: "check_buyer_risk",
    description: "Rate how likely a buyer is to open a dispute from their message, and suggest a fix with its true cost.",
    parameters: obj({ orderId: S("Order id"), message: S("The buyer's message, word for word") }, ["orderId", "message"]),
  },
  {
    name: "check_scam_radar",
    description: "Check an order for scam signs before shipping (forwarding address, different name or country, paying outside PayPal, address change, pressure).",
    parameters: obj({ orderId: S("Order id"), message: S("Optional: anything the buyer wrote") }, ["orderId"]),
  },
  {
    name: "draft_dispute_response",
    description: "Draft the seller's answer to a PayPal dispute (fight or accept, note to PayPal). Sending it needs the seller's confirmation.",
    parameters: obj({ disputeId: S("Dispute id, e.g. PP-R-ABC-123") }, ["disputeId"]),
  },
  {
    name: "add_tracking",
    description: "Prepare adding a tracking number to an order in PayPal. The seller must confirm before it is sent.",
    parameters: obj({ orderId: S("Order id"), carrier: S("Carrier, e.g. USPS, UPS, FedEx, DHL"), trackingNumber: S("Tracking number exactly as given") }, ["orderId", "carrier", "trackingNumber"]),
  },
  {
    name: "propose_refund",
    description: "Prepare a refund to the buyer. The seller must confirm before any money moves.",
    parameters: obj({ orderId: S("Order id"), amount: N("Amount in USD"), reason: S("Short reason shown to the buyer") }, ["orderId", "amount", "reason"]),
  },
];

const LABELS: Record<string, string> = {
  get_earnings: "Looked up earnings",
  check_buyer_risk: "Checked buyer risk",
  check_scam_radar: "Ran Scam Radar",
  draft_dispute_response: "Drafted a dispute answer",
  add_tracking: "Prepared tracking",
  propose_refund: "Prepared a refund",
};

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} hours ago` : `${Math.round(h / 24)} days ago`;
}

function system(orders: Order[], disputes: any[], health: any) {
  return `You are SellerShield, an agent that keeps a small seller's PayPal money safe. The seller is not technical: use plain words, under 90 words, and end with one concrete next step.
Use tools to get facts instead of guessing. Never do money math yourself: quote the numbers the tools return.
add_tracking and propose_refund only PREPARE an action. The seller confirms it with a button under your answer, so never say it's done; say "Tap Confirm below to send it".
For draft_dispute_response, summarise the recommendation; if canSendNow is true the seller can send it with a Confirm button.
Mention a Confirm button ONLY if a tool returned "waiting_for_seller_confirmation" (or a dispute draft with canSendNow) in this reply. Otherwise, if an action would help, suggest it and ask whether to prepare it.
Only call add_tracking when the seller gave a real tracking number. Only call propose_refund when the seller asked for a refund or agreed to one.
Orders are newest first; several can share an item name, and "new", "latest" or "just sold" means the newest. If it's unclear which order the seller means, ask.
Account health: ${JSON.stringify({ score: health.score, status: health.status, disputeRate: health.rate, feePerDispute: health.feePerDispute, message: health.message })}
Orders: ${JSON.stringify(
    orders.slice(0, 30).map((o, i) => ({
      orderId: o.orderId,
      item: o.item,
      paid: o.amount,
      refunded: o.refunded?.amount || "0",
      tracking: o.tracking ? `${o.tracking.carrier} ${o.tracking.number}` : "none",
      sold: (i === 0 ? "newest, " : "") + ago(o.createdAt),
      scamRadar: o.scam?.headline,
      buyerMood: o.risk?.level,
      packingPhotos: o.proof?.filter((p) => p.good).length || 0,
    }))
  )}
Disputes: ${JSON.stringify(disputes.map((d) => ({ id: d.dispute_id, reason: d.reason, status: d.status, amount: d.dispute_amount?.value })))}`;
}

type Ctx = { orders: Order[]; pending: PendingAction[]; steps: Step[] };

async function runTool(name: string, args: any, ctx: Ctx): Promise<unknown> {
  const order = args.orderId ? ctx.orders.find((o) => o.orderId === args.orderId) : undefined;
  const needOrder = () => {
    if (!order) throw new Error(`No order with id ${args.orderId}`);
    return order;
  };
  switch (name) {
    case "get_earnings": {
      const fx = await getUsdInr();
      const list = (order ? [order] : ctx.orders).map((o) => {
        const e = earningsFor(o, fx);
        return { orderId: o.orderId, item: o.item, buyerPaid: e.buyerPaid, paypalFee: e.paypalFee, refunded: e.refunded, youKeepUsd: e.kept, rupeeEstimate: e.inrEstimate, moneyExpectedBy: e.expected.by?.slice(0, 10) ?? "nothing due", rule: e.expected.rule };
      });
      ctx.steps.push({ tool: name, label: LABELS[name], status: "done", detail: order ? order.item : `${list.length} orders` });
      return { orders: list, note: "Rupee amounts are estimates after ~3% currency loss." };
    }
    case "check_buyer_risk": {
      const o = needOrder();
      const r = await assessRisk(o.orderId, String(args.message || ""));
      ctx.steps.push({ tool: name, label: LABELS[name], status: "done", detail: `${o.item}: ${r.level} risk` });
      return r;
    }
    case "check_scam_radar": {
      const o = await backfill(needOrder());
      const notes = [o.scamNotes, args.message].filter(Boolean).join("\n---\n");
      const r = await scanOrder(o, [notes, o.buyerMessage].filter(Boolean).join("\n---\n"));
      await updateOrder(o.orderId, { scam: r, ...(args.message ? { scamNotes: notes } : {}) });
      ctx.steps.push({ tool: name, label: LABELS[name], status: "done", detail: `${o.item}: ${r.headline}` });
      return r;
    }
    case "draft_dispute_response": {
      const r = await draftDispute(String(args.disputeId));
      if (r.dispute.canSubmit && r.draft.recommendation === "fight") {
        ctx.pending.push({ type: "submit_evidence", disputeId: r.dispute.id, item: r.item || undefined, notes: r.draft.evidenceNotes, tracking: r.tracking ? { carrier: r.tracking.carrier, number: r.tracking.number } : null, photos: r.proof?.goodCount || 0 });
      }
      ctx.steps.push({ tool: name, label: LABELS[name], status: r.dispute.canSubmit ? "needs_confirm" : "done", detail: `${r.draft.recommendation === "fight" ? "Fight it" : "Accept it"}${r.dispute.canSubmit ? "" : " (PayPal isn't waiting on you for this case)"}` });
      return { ...r.draft, canSendNow: r.dispute.canSubmit, packingPhotos: r.proof?.goodCount || 0 };
    }
    case "add_tracking": {
      const o = needOrder();
      if (o.tracking) throw new Error(`${o.item} already has tracking`);
      if (!args.carrier || !args.trackingNumber) throw new Error("Carrier and tracking number are both needed");
      ctx.pending.push({ type: "add_tracking", orderId: o.orderId, item: o.item, soldAt: o.createdAt, carrier: String(args.carrier), trackingNumber: String(args.trackingNumber) });
      ctx.steps.push({ tool: name, label: LABELS[name], status: "needs_confirm", detail: `${o.item}: ${args.carrier} ${args.trackingNumber}` });
      return { status: "waiting_for_seller_confirmation" };
    }
    case "propose_refund": {
      const o = needOrder();
      const left = Number(o.amount) - Number(o.refunded?.amount || 0);
      const amount = Number(args.amount);
      if (!(amount > 0) || amount > left) throw new Error(`Refund must be between $0.01 and $${left.toFixed(2)}`);
      const keep = Math.round((earningsFor(o, null).kept - amount) * 100) / 100;
      ctx.pending.push({ type: "refund", orderId: o.orderId, item: o.item, soldAt: o.createdAt, amount: amount.toFixed(2), note: String(args.reason || "Refund from seller"), keepAfterRefund: keep });
      ctx.steps.push({ tool: name, label: LABELS[name], status: "needs_confirm", detail: `${o.item}: $${amount.toFixed(2)}` });
      return { status: "waiting_for_seller_confirmation", sellerKeepsAfterRefundUsd: keep, paypalKeepsItsFee: true };
    }
  }
  throw new Error(`Unknown tool ${name}`);
}

export async function runAgent(question: string, history: { role: "user" | "bot"; text: string }[]) {
  const [orders, health] = await Promise.all([getOrders(), getHealthSnapshot()]);
  let disputes: any[] = [];
  try {
    disputes = (await listDisputes()).items || [];
  } catch {}
  const ctx: Ctx = { orders, pending: [], steps: [] };
  const contents: GeminiContent[] = [
    ...history.slice(-8).map((m) => ({ role: m.role === "user" ? ("user" as const) : ("model" as const), parts: [{ text: String(m.text).slice(0, 800) }] })),
    { role: "user", parts: [{ text: String(question).slice(0, 1500) }] },
  ];
  const sys = system(orders, disputes, health);

  for (let turn = 0; turn < 5; turn++) {
    const reply = await generateWithTools(sys, contents, TOOLS);
    contents.push(reply);
    const calls = reply.parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const answer = reply.parts.map((p) => p.text || "").join("").trim();
      return { answer: answer || "Done.", steps: ctx.steps, actions: ctx.pending };
    }
    const responses = [];
    for (const c of calls) {
      const { name, args } = c.functionCall!;
      try {
        responses.push({ functionResponse: { name, response: { result: await runTool(name, args || {}, ctx) } } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.steps.push({ tool: name, label: LABELS[name] || name, status: "error", detail: msg });
        responses.push({ functionResponse: { name, response: { error: msg } } });
      }
    }
    contents.push({ role: "user", parts: responses });
  }
  return { answer: "That took more steps than I allow in one go. Could you ask about one thing at a time?", steps: ctx.steps, actions: ctx.pending };
}
