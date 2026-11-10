"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api, money, SectionTitle, type Order } from "./shared";

export type Scam = NonNullable<Order["scam"]>;

const look = {
  safe: { icon: ShieldCheck, card: "border-shield/30 bg-shield-soft/50", text: "text-shield", badge: "bg-shield-soft text-shield" },
  check: { icon: ShieldQuestion, card: "border-marigold/60 bg-marigold-soft/60", text: "text-marigold-ink", badge: "bg-marigold-soft text-marigold-ink" },
  stop: { icon: ShieldAlert, card: "border-coral/40 bg-coral-soft/60", text: "text-coral", badge: "bg-coral-soft text-coral" },
} as const;

export function ScamBadge({ scam }: { scam?: Scam }) {
  if (!scam) return <span className="text-muted-foreground">Checking…</span>;
  const l = look[scam.verdict];
  return (
    <Badge className={cn("border-0 font-bold gap-1", l.badge)} title={scam.reasons.join(" ")}>
      <l.icon className="size-3.5" /> {scam.headline}
    </Badge>
  );
}

const addr = (o: Order) =>
  o.shipTo ? [o.shipTo.name, o.shipTo.line1, o.shipTo.line2, o.shipTo.city, o.shipTo.state, o.shipTo.postalCode, o.shipTo.countryCode].filter(Boolean).join(", ") : "Not known yet";

function ScamCard({ order, onDone }: { order: Order; onDone: () => void }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const s = order.scam;
  const l = s ? look[s.verdict] : null;

  async function check() {
    setBusy(true);
    try {
      const r = await api<Scam>("/api/scam", { orderId: order.orderId, message: msg || undefined });
      setMsg("");
      if (r.verdict === "safe") toast.success(`${order.item}: safe to ship`);
      else toast.warning(`${order.item}: ${r.headline.toLowerCase()}`, { description: r.reasons[0] });
      onDone();
    } catch (e: any) {
      toast.error("Scam Radar couldn't check this order", { description: e.message });
    }
    setBusy(false);
  }

  return (
    <motion.li layout className={cn("rounded-xl border-2 p-4 flex flex-col gap-3", l ? l.card : "bg-card")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-bold">
            {order.item} · <span className="tabular-nums">{money(order.amount)}</span>
          </div>
          <div className="text-sm text-muted-foreground">Ships to: {addr(order)}</div>
        </div>
        {s && l && (
          <div className={cn("flex items-center gap-1.5 font-heading text-xl font-bold", l.text)}>
            <l.icon className="size-6" /> {s.headline}
          </div>
        )}
      </div>
      {s ? (
        <>
          <ul className="list-disc pl-5 text-sm">
            {s.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="text-sm">
            <b>What to do:</b> {s.whatToDo}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Checking this order…</p>
      )}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <Textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Got a message from this buyer? Paste it here to check it too."
          aria-label={`Buyer message for ${order.item}`}
          className="min-h-16 bg-card"
        />
        <Button variant="outline" className="shrink-0 bg-card" disabled={busy} onClick={check}>
          <Sparkles /> {busy ? "Checking…" : msg ? "Check this message" : "Check again"}
        </Button>
      </div>
    </motion.li>
  );
}

export function ScamPanel({ orders, onDone }: { orders: Order[]; onDone: () => void }) {
  const toShip = orders.filter((o) => !o.tracking && !o.refunded);
  const shipped = orders.filter((o) => o.scam && (o.tracking || o.refunded));
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle hint="Scam Radar looks at the shipping address and anything the buyer wrote, using simple rules plus AI.">
        Scam Radar: check before you ship
      </SectionTitle>
      <p className="text-sm text-muted-foreground -mt-2 max-w-2xl">
        This is a smart warning, not a guarantee. It can miss scams and flag honest buyers, so use it as a second opinion.
      </p>
      {toShip.length === 0 ? (
        <p className="text-muted-foreground">Nothing waiting to ship. New orders are checked here automatically.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {toShip.map((o) => (
            <ScamCard key={o.orderId} order={o} onDone={onDone} />
          ))}
        </ul>
      )}
      {shipped.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Already shipped ({shipped.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {shipped.map((o) => (
              <li key={o.orderId} className="flex items-center justify-between gap-2">
                <span>{o.item}</span>
                <ScamBadge scam={o.scam} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
