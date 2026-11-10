"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Camera, ImageUp, Paperclip, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api, expectedLabel, Hint, inr, money, plainReason, plainStatus, SectionTitle, type EarningsMap, type Order, type TabKey } from "./shared";
import { EarningsDialog } from "./earnings-dialog";
import { ScamBadge } from "./scam-panel";
import { ProofDialog } from "./proof-dialog";
import { RefundDialog } from "./refund-dialog";

const reveal = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.25 },
};

function OrderPicker({ orders, value, onChange, placeholder = "Choose an order" }: { orders: Order[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full bg-card">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {orders.map((o) => (
          <SelectItem key={o.orderId} value={o.orderId}>
            {o.item} · {money(o.amount)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function riskBadge(level?: string) {
  if (!level) return <span className="text-muted-foreground">Not checked</span>;
  const cls = level === "high" ? "bg-coral-soft text-coral" : level === "medium" ? "bg-marigold-soft text-marigold-ink" : "bg-shield-soft text-shield";
  const word = level === "high" ? "Likely to dispute" : level === "medium" ? "Might dispute" : "Happy enough";
  return <Badge className={cn("border-0 font-bold", cls)}>{word}</Badge>;
}

/* ---------------- Orders ---------------- */
export function OrdersPanel({ orders, earnings, onGo, onDone }: { orders: Order[]; earnings: EarningsMap; onGo: (tab: TabKey, orderId?: string) => void; onDone: () => void }) {
  const [detail, setDetail] = useState("");
  const [proofFor, setProofFor] = useState("");
  if (orders.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="font-heading text-xl font-bold">No orders yet</p>
        <p className="text-muted-foreground mt-1">Buy something in the Demo store with your sandbox buyer account. It will show up here.</p>
        <Button asChild className="mt-4">
          <a href="/store">Open the Demo store</a>
        </Button>
      </div>
    );
  }
  const picked = orders.find((o) => o.orderId === detail);
  return (
    <div className="relative overflow-x-auto -mx-2">
      {/* relative: keeps the table's absolutely positioned sr-only label inside this scroll box on phones. */}
      <table className="w-full text-sm min-w-[900px]">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="font-normal py-2 px-2">What sold</th>
            <th className="font-normal px-2">
              <span className="inline-flex items-center gap-1">
                You keep<Hint>What&apos;s left after PayPal&apos;s fee and any refunds. Tap the amount for the full breakdown in rupees.</Hint>
              </span>
            </th>
            <th className="font-normal px-2">Money expected</th>
            <th className="font-normal px-2">
              <span className="inline-flex items-center gap-1">
                Tracking<Hint>The carrier&apos;s parcel number. PayPal uses it to prove you shipped.</Hint>
              </span>
            </th>
            <th className="font-normal px-2">Buyer mood</th>
            <th className="px-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const e = earnings[o.orderId];
            const exp = expectedLabel(e);
            return (
              <tr key={o.orderId} className="border-t align-top">
                <td className="py-3 px-2">
                  <div className="font-bold">{o.item}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · paid {money(o.amount)}
                  </div>
                  {!o.tracking && !o.refunded && (
                    <button className="mt-1 block" onClick={() => onGo("scam", o.orderId)} aria-label={`Scam Radar for ${o.item}`}>
                      <ScamBadge scam={o.scam} />
                    </button>
                  )}
                </td>
                <td className="py-3 px-2">
                  {e ? (
                    <button onClick={() => setDetail(o.orderId)} className="text-left rounded-md hover:bg-muted px-1 -mx-1 underline decoration-dotted underline-offset-4">
                      <span className="font-bold tabular-nums">{money(e.kept)}</span>
                      {e.inrEstimate != null && <span className="block text-xs text-muted-foreground">≈ {inr(e.inrEstimate)} estimate</span>}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">…</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  {exp ? (
                    <span title={exp.rule}>
                      <span className={cn("font-bold", exp.kind === "hold" && "text-marigold-ink")}>{exp.date}</span>
                      <span className="block text-xs text-muted-foreground">{exp.kind === "hold" ? `up to 21-day hold, ${exp.when}` : exp.when}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{e ? "Nothing due" : "…"}</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  {o.tracking ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Truck className="size-4 text-shield shrink-0" /> {o.tracking.carrier} {o.tracking.number}
                    </span>
                  ) : o.refunded ? (
                    <span className="text-muted-foreground">Not needed</span>
                  ) : (
                    <Badge className="border-0 bg-marigold-soft text-marigold-ink font-bold">Missing</Badge>
                  )}
                </td>
                <td className="py-3 px-2" title={o.risk?.reason}>{riskBadge(o.risk?.level)}</td>
                <td className="py-3 px-2 text-right whitespace-nowrap">
                  {!o.tracking && !o.refunded && (
                    <Button size="sm" variant="outline" onClick={() => onGo("shipping", o.orderId)}>Add tracking</Button>
                  )}{" "}
                  <Button size="sm" variant="ghost" onClick={() => setProofFor(o.orderId)}>
                    <Camera /> {o.proof?.length ? `Photos (${o.proof.filter((p) => p.good).length}/${o.proof.length} good)` : "Packing photos"}
                  </Button>{" "}
                  <Button size="sm" variant="ghost" onClick={() => onGo("buyers", o.orderId)}>Buyer message</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ProofDialog order={orders.find((o) => o.orderId === proofFor)} open={!!proofFor} onOpenChange={(v) => !v && setProofFor("")} onDone={onDone} />
      <EarningsDialog order={picked} e={picked && earnings[picked.orderId]} open={!!picked} onOpenChange={(v) => !v && setDetail("")} />
    </div>
  );
}

/* ---------------- Shipping / tracking autopilot ---------------- */
export function ShippingPanel({ orders, focus, onDone }: { orders: Order[]; focus: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ mimeType: string; base64: string; name: string } | null>(null);
  const [found, setFound] = useState<any>(null);
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);
  const open = orders.filter((o) => !o.tracking && !o.refunded);

  useEffect(() => {
    if (focus) setOrderId(focus);
  }, [focus]);

  async function onFile(f?: File) {
    if (!f) return;
    const buf = await f.arrayBuffer();
    let bin = "";
    new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
    setImage({ mimeType: f.type, base64: btoa(bin), name: f.name });
  }

  async function extract() {
    setBusy(true);
    try {
      const r = await api("/api/tracking/extract", { text, image: image && { mimeType: image.mimeType, base64: image.base64 } });
      setFound(r);
      if (r.matchedOrderId) setOrderId(r.matchedOrderId);
      if (!r.trackingNumber) toast.warning("No tracking number found", { description: "Try pasting the full shipping email." });
    } catch (e: any) {
      toast.error("Couldn't read that", { description: e.message });
    }
    setBusy(false);
  }

  async function apply() {
    setBusy(true);
    try {
      await api("/api/tracking/apply", { orderId, carrier: found.carrier, trackingNumber: found.trackingNumber });
      const o = orders.find((x) => x.orderId === orderId);
      toast.success("Tracking added to PayPal", { description: `${o?.item ?? "Order"}: ${found.carrier} ${found.trackingNumber}` });
      setFound(null);
      setText("");
      setImage(null);
      onDone();
    } catch (e: any) {
      toast.error("PayPal didn't accept the tracking", { description: e.message });
    }
    setBusy(false);
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="flex flex-col gap-3">
        <SectionTitle hint="Paste the confirmation email from your carrier, or upload a photo of the label. The AI finds the carrier and tracking number for you.">
          Add tracking without typing
        </SectionTitle>
        <Textarea
          className="min-h-28 bg-card"
          placeholder="Paste your shipping confirmation email here"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Shipping email"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <ImageUp /> {image ? image.name : "Upload a label photo"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </Button>
          <Button disabled={busy || (!text && !image)} onClick={extract}>
            <Sparkles /> {busy && !found ? "Reading…" : "Find the tracking number"}
          </Button>
        </div>

        <AnimatePresence>
          {found && (
            <motion.div {...reveal} className="rounded-xl border-2 border-shield/30 bg-shield-soft/60 p-4 flex flex-col gap-3">
              <p className="font-bold">Here&apos;s what the AI found. Check it before sending.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="carrier">Carrier</Label>
                  <Input id="carrier" className="bg-card" value={found.carrier || ""} onChange={(e) => setFound({ ...found, carrier: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="tracking-no">Tracking number</Label>
                  <Input id="tracking-no" className="bg-card" value={found.trackingNumber || ""} onChange={(e) => setFound({ ...found, trackingNumber: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Which order is it for?</Label>
                <OrderPicker orders={open} value={orderId} onChange={setOrderId} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={busy || !orderId || !found.trackingNumber} onClick={apply}>
                  {busy ? "Sending…" : "Send tracking to PayPal"}
                </Button>
                <span className="text-sm text-muted-foreground">AI is {Math.round((found.confidence || 0) * 100)}% sure</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <aside className="rounded-xl bg-muted/60 p-4 self-start">
        <h3 className="font-heading font-bold text-lg">Still need tracking</h3>
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-1">None. Nice work.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {open.map((o) => (
              <li key={o.orderId} className="flex justify-between gap-2">
                <span className="truncate">{o.item}</span>
                <span className="tabular-nums text-muted-foreground">{money(o.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

/* ---------------- Unhappy buyers (pre-dispute fixer) ---------------- */
export function BuyersPanel({ orders, focus, onDone }: { orders: Order[]; focus: string; onDone: () => void }) {
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [risk, setRisk] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  useEffect(() => {
    if (focus) setOrderId(focus);
  }, [focus]);
  useEffect(() => {
    const o = orders.find((x) => x.orderId === orderId);
    if (o?.buyerMessage && !message) setMessage(o.buyerMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const order = orders.find((o) => o.orderId === orderId);

  async function analyze() {
    setBusy(true);
    try {
      const r = await api("/api/risk", { orderId, message });
      setRisk(r);
      onDone();
    } catch (e: any) {
      toast.error("Couldn't check this message", { description: e.message });
    }
    setBusy(false);
  }

  async function copyReply() {
    try {
      await navigator.clipboard.writeText(risk.reply);
      toast.success("Reply copied", { description: "Paste it into your message to the buyer." });
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  }

  const tone = risk?.level === "high" ? "border-coral/40 bg-coral-soft/60" : risk?.level === "medium" ? "border-marigold/50 bg-marigold-soft/60" : "border-shield/30 bg-shield-soft/60";
  const action: Record<string, string> = {
    reply_only: "Just reply kindly",
    partial_refund: "Offer a small refund",
    full_refund: "Refund in full",
    reship: "Send a replacement",
  };

  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      <SectionTitle hint="When a buyer complains, a quick fix is often cheaper than a dispute: you'd pay a $15 fee and could lose the whole sale.">
        Calm an unhappy buyer before they open a dispute
      </SectionTitle>
      <OrderPicker orders={orders} value={orderId} onChange={setOrderId} placeholder="Which order is the buyer writing about?" />
      <Textarea
        className="min-h-28 bg-card"
        placeholder="Paste the buyer's message, for example: It's been two weeks and nothing arrived."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        aria-label="Buyer's message"
      />
      <Button className="self-start" disabled={busy || !orderId || !message} onClick={analyze}>
        <Sparkles /> {busy ? "Reading the message…" : "Ask AI what to do"}
      </Button>

      <AnimatePresence mode="wait">
        {risk && (
          <motion.div key={risk.reply} {...reveal} className={cn("rounded-xl border-2 p-4 flex flex-col gap-3", tone)}>
            <div className="flex flex-wrap items-center gap-2">
              {riskBadge(risk.level)}
              <span className="text-sm">{risk.reason}</span>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Suggested fix</div>
              <div className="font-heading text-xl font-bold">
                {action[risk.suggestedAction] || risk.suggestedAction}
                {Number(risk.refundAmount) > 0 && ` of ${money(risk.refundAmount)}`}
              </div>
            </div>
            {risk.cost && <CostCompare cost={risk.cost} />}
            <div className="rounded-lg bg-card p-3 whitespace-pre-wrap text-sm">{risk.reply}</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyReply}>Copy reply</Button>
              {String(risk.suggestedAction).includes("refund") && (
                <Button onClick={() => setRefundOpen(true)}>Review refund of {money(risk.refundAmount)}</Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RefundDialog order={order} amount={risk?.refundAmount || ""} note={risk?.reply || ""} open={refundOpen} onOpenChange={setRefundOpen} onDone={onDone} />
    </div>
  );
}

type Cost = {
  refundAmount: number;
  paypalFeeKept: number;
  disputeFee: number;
  keepAfterRefund: number;
  keepAfterLostDispute: number;
  savedByRefunding: number;
};

/** Side by side: refund now vs. lose a dispute later. All numbers come from code, not the AI. */
function CostCompare({ cost }: { cost: Cost }) {
  const signed = (n: number) => (n < 0 ? `−${money(-n)}` : money(n));
  return (
    <div className="grid sm:grid-cols-2 gap-2 text-sm">
      <div className="rounded-lg bg-card p-3">
        <div className="text-muted-foreground">
          {cost.refundAmount > 0 ? `If you refund ${money(cost.refundAmount)} now` : "If you just reply now"}
        </div>
        <div className="font-heading text-xl font-bold tabular-nums">You keep {signed(cost.keepAfterRefund)}</div>
        <div className="text-xs text-muted-foreground">PayPal keeps its {money(cost.paypalFeeKept)} fee either way.</div>
      </div>
      <div className="rounded-lg bg-card p-3 border border-coral/30">
        <div className="text-muted-foreground">If the buyer opens a dispute and you lose</div>
        <div className="font-heading text-xl font-bold tabular-nums text-coral">You end up {signed(cost.keepAfterLostDispute)}</div>
        <div className="text-xs text-muted-foreground">Full refund plus a {money(cost.disputeFee)} dispute fee, and you may lose the item.</div>
      </div>
      {cost.savedByRefunding > 0 && (
        <p className="sm:col-span-2 font-bold text-shield">Refunding now leaves you {money(cost.savedByRefunding)} better off than losing a dispute.</p>
      )}
    </div>
  );
}

/* ---------------- Disputes ---------------- */
export function DisputesPanel({ disputes, onDone }: { disputes: any[]; onDone: () => void }) {
  const [active, setActive] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState("");

  async function draft(id: string) {
    setBusy(id);
    try {
      const r = await api(`/api/disputes/${id}/draft`, {});
      setActive(r);
      setNotes(r.draft.evidenceNotes);
    } catch (e: any) {
      toast.error("Couldn't draft a response", { description: e.message });
    }
    setBusy("");
  }

  async function submit(action: "evidence" | "accept") {
    setBusy("submit");
    try {
      const r = await api(`/api/disputes/${active.dispute.id}/submit`, { action, notes, tracking: active.tracking });
      toast.success(action === "accept" ? "Claim accepted" : "Evidence sent to PayPal", {
        description:
          action === "accept"
            ? "PayPal refunds the buyer and closes the case."
            : r.photosAttached
              ? `${r.photosAttached} packing photo${r.photosAttached === 1 ? "" : "s"} attached. PayPal will review it.`
              : r.photoError
                ? `PayPal didn't take the photos (${r.photoError}), so only the note and tracking were sent.`
                : "PayPal will review it and let you know.",
      });
      setActive(null);
      onDone();
    } catch (e: any) {
      toast.error("PayPal didn't accept that", { description: e.message });
    }
    setBusy("");
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle hint="A dispute is a buyer asking PayPal to get their money back. You can send proof (fight it) or give the money back (accept it).">
        Disputes
      </SectionTitle>
      {disputes.length === 0 && <p className="text-muted-foreground">No disputes right now. New ones can take a few minutes to show up here.</p>}
      <ul className="flex flex-col gap-2">
        {disputes.map((d) => (
          <li key={d.dispute_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <div>
              <div className="font-bold">
                {plainReason(d.reason)} · <span className="tabular-nums">{money(d.dispute_amount?.value || 0)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {plainStatus(d.status)} · case {d.dispute_id}
              </div>
            </div>
            <Button variant={d.status === "WAITING_FOR_SELLER_RESPONSE" ? "default" : "outline"} disabled={!!busy} onClick={() => draft(d.dispute_id)}>
              <Sparkles /> {busy === d.dispute_id ? "Drafting…" : "Draft my answer"}
            </Button>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {active && (
          <motion.div {...reveal} className="rounded-xl border-2 border-shield/30 bg-shield-soft/50 p-4 flex flex-col gap-3">
            <div>
              <div className="text-sm text-muted-foreground">AI suggests</div>
              <div className="font-heading text-xl font-bold">
                {active.draft.recommendation === "fight" ? "Send proof and fight it" : "Accept and refund the buyer"}
              </div>
              <p className="text-sm mt-1">{active.draft.why}</p>
            </div>
            {active.dispute.due && (
              <p className="text-sm font-bold text-coral">Reply by {new Date(active.dispute.due).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
            )}
            {active.draft.checklist?.length > 0 && (
              <ul className="list-disc pl-5 text-sm">{active.draft.checklist.map((c: string) => <li key={c}>{c}</li>)}</ul>
            )}
            {active.proof?.goodCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Paperclip className="size-4 text-shield" />
                <span className="font-bold">{active.proof.goodCount} packing photo{active.proof.goodCount === 1 ? "" : "s"} will be attached:</span>
                {active.proof.photos.map((p: any) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.file} src={`/api/proof/${active.orderId}/${p.file}`} alt={p.feedback} className="size-12 rounded-md object-cover border" />
                ))}
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="evidence">Your note to PayPal</Label>
              <Textarea id="evidence" className="min-h-32 bg-card" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!!busy} onClick={() => submit("evidence")}>Send proof to PayPal</Button>
              <Button variant="outline" disabled={!!busy} onClick={() => submit("accept")}>Accept and refund</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- PayPal updates (webhooks) ---------------- */
export function UpdatesPanel({ events }: { events: any[] }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint="PayPal tells SellerShield the moment something changes, like a new dispute or a released payment.">
        News from PayPal
      </SectionTitle>
      {events.length === 0 ? (
        <p className="text-muted-foreground">Nothing yet. Updates appear here as PayPal sends them.</p>
      ) : (
        <ul className="divide-y">
          {events.slice(0, 10).map((e) => (
            <li key={e.id} className="py-2.5">
              <div className="font-bold">{e.summary || e.type}</div>
              <div className="text-sm text-muted-foreground">{new Date(e.at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
