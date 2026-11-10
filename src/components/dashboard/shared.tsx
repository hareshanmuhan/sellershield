"use client";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type Order = {
  orderId: string;
  captureId: string;
  amount: string;
  item: string;
  buyerEmail?: string;
  createdAt: string;
  tracking?: { carrier: string; number: string };
  refunded?: { amount: string };
  buyerMessage?: string;
  risk?: { level: "low" | "medium" | "high"; reason: string };
};

export type Health = {
  sales: number;
  disputes: number;
  rate: number;
  untracked: number;
  score: number;
  disputesUntilCliff: number;
  status: "healthy" | "watch" | "danger";
  feePerDispute: number;
  responseDays: number;
  message: string;
  liveSales: number;
  liveDisputes: number;
  baseline: { sales: number; disputes: number };
};

export type TabKey = "orders" | "shipping" | "buyers" | "disputes" | "updates";

export async function api<T = any>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(
    url,
    body === undefined
      ? undefined
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}

export const money = (n: number | string) =>
  Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** How much of an order can still be refunded. */
export const refundable = (o: Order) => Math.max(0, Number(o.amount) - Number(o.refunded?.amount || 0));

/** PayPal's reason codes, said the way a seller would say them. */
export function plainReason(reason?: string) {
  const map: Record<string, string> = {
    MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Buyer says it never arrived",
    MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Buyer says it isn't as described",
    UNAUTHORISED: "Buyer says they didn't make this payment",
    CREDIT_NOT_PROCESSED: "Buyer is waiting for a refund",
    DUPLICATE_TRANSACTION: "Buyer says they paid twice",
    INCORRECT_AMOUNT: "Buyer says they were charged the wrong amount",
  };
  return map[reason || ""] || (reason || "Dispute").replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function plainStatus(status?: string) {
  const map: Record<string, string> = {
    WAITING_FOR_SELLER_RESPONSE: "Waiting for you",
    WAITING_FOR_BUYER_RESPONSE: "Waiting for the buyer",
    UNDER_REVIEW: "PayPal is reviewing",
    RESOLVED: "Closed",
    OPEN: "Open",
  };
  return map[status || ""] || (status || "").replaceAll("_", " ").toLowerCase();
}

/** Small "?" that explains a term in plain words. */
export function Hint({ children, label = "What does this mean?" }: { children: React.ReactNode; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-pine focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleHelp className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-sm leading-snug">{children}</TooltipContent>
    </Tooltip>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <h2 className="font-heading text-xl font-bold flex items-center gap-1.5">
      {children}
      {hint && <Hint>{hint}</Hint>}
    </h2>
  );
}
