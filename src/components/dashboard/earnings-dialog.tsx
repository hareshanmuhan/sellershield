"use client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Hint, expectedLabel, inr, money, type Earnings, type Order } from "./shared";

function Row({ label, value, hint, strong, minus }: { label: React.ReactNode; value: string; hint?: React.ReactNode; strong?: boolean; minus?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "border-t-2 border-pine/80 font-bold" : "border-t"}`}>
      <span className="flex items-center gap-1">
        {label}
        {hint && <Hint>{hint}</Hint>}
      </span>
      <span className={`tabular-nums ${minus ? "text-coral" : ""}`}>{value}</span>
    </div>
  );
}

/** The money story for one order: what the buyer paid, what PayPal kept, what reaches the bank. */
export function EarningsDialog({ order, e, open, onOpenChange }: { order?: Order; e?: Earnings; open: boolean; onOpenChange: (o: boolean) => void }) {
  if (!order || !e) return null;
  const exp = expectedLabel(e);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Don't auto-focus the first "?" button, or its tooltip pops open on every open. */}
      <DialogContent onOpenAutoFocus={(ev) => ev.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">What you really earn</DialogTitle>
          <DialogDescription>
            {order.item}, order {order.orderId}
          </DialogDescription>
        </DialogHeader>

        <div className="text-[15px]">
          <Row label="Buyer paid" value={money(e.buyerPaid)} />
          <Row
            label="PayPal fee"
            value={`− ${money(e.paypalFee)}`}
            minus
            hint={e.feeSource === "PayPal" ? "The exact fee PayPal charged on this sale." : `PayPal's breakdown wasn't available, so this uses the standard rate (${e.ratesAsOf}).`}
          />
          {e.refunded > 0 && (
            <Row label="Refunded to buyer" value={`− ${money(e.refunded)}`} minus hint="PayPal keeps its fee when you refund, so refunds come out of what you received." />
          )}
          <Row label="You keep (USD)" value={money(e.kept)} strong />
          <Row
            label="Currency loss, about 3%"
            value={`− ${money(e.currencyLoss)}`}
            minus
            hint="When PayPal turns dollars into rupees it uses a rate a little worse than the market rate. 3% is a typical gap."
          />
          {e.inrEstimate != null && e.fx ? (
            <Row
              label={<span>Reaches your bank <span className="text-muted-foreground font-normal">(estimate)</span></span>}
              value={`≈ ${inr(e.inrEstimate)}`}
              strong
              hint={`Uses the ${e.fx.source} rate of ₹${e.fx.rate.toFixed(2)} per dollar from ${e.fx.date}, minus the 3% currency loss. Your bank may differ.`}
            />
          ) : (
            <p className="text-sm text-muted-foreground pt-2">The rupee estimate isn&apos;t available right now because the exchange rate couldn&apos;t be loaded.</p>
          )}
        </div>

        {exp && (
          <div className={`rounded-xl p-3 ${exp.kind === "hold" ? "bg-marigold-soft" : "bg-shield-soft"}`}>
            <div className="font-bold">
              Money expected by {exp.date} <span className="font-normal text-muted-foreground">({exp.when})</span>
            </div>
            <p className="text-sm mt-0.5">{exp.rule}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Fees and rules as of {e.ratesAsOf}. Dates are a rule of thumb, not a PayPal promise.</p>
      </DialogContent>
    </Dialog>
  );
}
