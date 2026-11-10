"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, money, refundable, type Order } from "./shared";

/** Money only moves from here: the seller sees the amount and confirms it. */
export function RefundDialog({
  order,
  amount,
  note,
  open,
  onOpenChange,
  onDone,
}: {
  order: Order | undefined;
  amount: string;
  note: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(amount);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(amount), [amount, open]);
  if (!order) return null;
  const max = refundable(order);
  const n = Number(value);
  const valid = n > 0 && n <= max;

  async function confirm() {
    setBusy(true);
    try {
      await api("/api/refund", { orderId: order!.orderId, amount: n.toFixed(2), note });
      toast.success(`Refunded ${money(n)} to the buyer`, { description: `${order!.item}. PayPal sends it right away.` });
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error("The refund didn't go through", { description: e.message });
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Refund the buyer?</DialogTitle>
          <DialogDescription>
            This sends real money back through PayPal for <b>{order.item}</b> (order {order.orderId}, sold{" "}
            {new Date(order.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}).
            You can refund up to {money(max)}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="refund-amount">Amount (USD)</Label>
          <Input
            id="refund-amount"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!valid}
            className="text-lg tabular-nums"
          />
          {!valid && <p className="text-sm text-coral">Enter an amount between $0.01 and {money(max)}.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button onClick={confirm} disabled={!valid || busy}>
            {busy ? "Refunding…" : `Refund ${valid ? money(n) : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
